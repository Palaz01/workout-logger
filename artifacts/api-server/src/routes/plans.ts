import { Router, type IRouter } from "express";
import { eq, and, count, inArray } from "drizzle-orm";
import "../types";
import {
  db,
  plansTable,
  planSetsTable,
  setExercisesTable,
  exercisesTable,
  planAssignmentsTable,
  usersTable,
} from "@workspace/db";
import {
  CreatePlanBody,
  ListPlansQueryParams,
  ListPlansResponse,
  GetPlanParams,
  GetPlanResponse,
  UpdatePlanParams,
  UpdatePlanBody,
  UpdatePlanResponse,
  DeletePlanParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SET_TYPE_EXERCISE_COUNTS: Record<string, number | null> = {
  straight: 1,
  superset: 2,
  triset: 3,
  other: null,
};

async function validateOrgOwnership(
  orgId: number,
  userIds: number[],
  exerciseIds: number[]
): Promise<string | null> {
  if (userIds.length > 0) {
    const orgUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, orgId), inArray(usersTable.id, userIds)));
    if (orgUsers.length !== userIds.length) {
      return "One or more assigned users do not belong to your organization";
    }
  }
  if (exerciseIds.length > 0) {
    const orgExercises = await db
      .select({ id: exercisesTable.id })
      .from(exercisesTable)
      .where(and(eq(exercisesTable.organizationId, orgId), inArray(exercisesTable.id, exerciseIds)));
    if (orgExercises.length !== exerciseIds.length) {
      return "One or more exercises do not belong to your organization";
    }
  }
  return null;
}

function validateSetExerciseCounts(sets: Array<{ type: string; exercises: unknown[] }>): string | null {
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    const expected = SET_TYPE_EXERCISE_COUNTS[s.type];
    if (expected !== null && expected !== undefined && s.exercises.length !== expected) {
      return `Set ${i + 1} (${s.type}) must have exactly ${expected} exercise(s), got ${s.exercises.length}`;
    }
    if (s.exercises.length === 0) {
      return `Set ${i + 1} must have at least one exercise`;
    }
  }
  return null;
}

async function getPlanDetail(planId: number) {
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) return null;

  const sets = await db
    .select()
    .from(planSetsTable)
    .where(eq(planSetsTable.planId, planId))
    .orderBy(planSetsTable.orderIndex);

  const setsWithExercises = await Promise.all(
    sets.map(async (s) => {
      const exercises = await db
        .select({
          id: setExercisesTable.id,
          exerciseId: setExercisesTable.exerciseId,
          exerciseName: exercisesTable.name,
          exerciseMeasurementType: exercisesTable.measurementType,
          targetValue: setExercisesTable.targetValue,
          orderIndex: setExercisesTable.orderIndex,
        })
        .from(setExercisesTable)
        .innerJoin(exercisesTable, eq(setExercisesTable.exerciseId, exercisesTable.id))
        .where(eq(setExercisesTable.setId, s.id))
        .orderBy(setExercisesTable.orderIndex);

      return {
        ...s,
        restSeconds: s.restSeconds ?? null,
        exercises,
      };
    })
  );

  const assignments = await db
    .select({ userId: planAssignmentsTable.userId })
    .from(planAssignmentsTable)
    .where(eq(planAssignmentsTable.planId, planId));

  return {
    ...plan,
    createdBy: plan.createdBy ?? null,
    assignedUserIds: assignments.map((a) => a.userId),
    sets: setsWithExercises,
  };
}

router.get("/plans", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const queryParams = ListPlansQueryParams.safeParse(req.query);
  const userId = queryParams.data?.userId;

  let planIds: number[] | null = null;

  if (userId != null) {
    const assignedPlanIds = await db
      .select({ planId: planAssignmentsTable.planId })
      .from(planAssignmentsTable)
      .where(eq(planAssignmentsTable.userId, userId));

    const assignedIds = assignedPlanIds.map((a) => a.planId);

    const globalPlans = await db
      .select({ id: plansTable.id })
      .from(plansTable)
      .where(and(eq(plansTable.isGlobal, true), eq(plansTable.organizationId, orgId)));

    const globalIds = globalPlans.map((p) => p.id);
    planIds = [...new Set([...assignedIds, ...globalIds])];

    if (planIds.length === 0) {
      res.json(ListPlansResponse.parse([]));
      return;
    }
  }

  const conditions = [eq(plansTable.organizationId, orgId)];
  if (planIds != null) {
    conditions.push(inArray(plansTable.id, planIds));
  }

  const plans = await db
    .select({
      id: plansTable.id,
      name: plansTable.name,
      createdBy: plansTable.createdBy,
      isGlobal: plansTable.isGlobal,
      createdAt: plansTable.createdAt,
      updatedAt: plansTable.updatedAt,
      setCount: count(planSetsTable.id),
    })
    .from(plansTable)
    .leftJoin(planSetsTable, eq(plansTable.id, planSetsTable.planId))
    .where(and(...conditions))
    .groupBy(plansTable.id)
    .orderBy(plansTable.createdAt);

  const plansWithAssignments = await Promise.all(
    plans.map(async (p) => {
      const assignments = await db
        .select({ userId: planAssignmentsTable.userId })
        .from(planAssignmentsTable)
        .where(eq(planAssignmentsTable.planId, p.id));
      return {
        ...p,
        createdBy: p.createdBy ?? null,
        assignedUserIds: assignments.map((a) => a.userId),
      };
    })
  );

  res.json(ListPlansResponse.parse(plansWithAssignments));
});

router.post("/plans", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const validationError = validateSetExerciseCounts(parsed.data.sets);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const isGlobal = parsed.data.isGlobal ?? false;
  const assignedUserIds = [...new Set(parsed.data.assignedUserIds ?? [])];

  if (!isGlobal && assignedUserIds.length === 0) {
    res.status(400).json({ error: "Plan must be global or assigned to at least one user" });
    return;
  }

  const allExerciseIds = [...new Set(parsed.data.sets.flatMap(s => s.exercises.map(e => e.exerciseId)))];
  const ownershipError = await validateOrgOwnership(orgId, assignedUserIds, allExerciseIds);
  if (ownershipError) {
    res.status(400).json({ error: ownershipError });
    return;
  }

  const planId = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(plansTable)
      .values({
        name: parsed.data.name,
        createdBy: req.user!.id,
        isGlobal,
        organizationId: orgId,
      })
      .returning();

    for (const setInput of parsed.data.sets) {
      const [planSet] = await tx
        .insert(planSetsTable)
        .values({
          planId: plan.id,
          type: setInput.type,
          rounds: setInput.rounds,
          restSeconds: setInput.restSeconds ?? null,
          orderIndex: setInput.orderIndex,
        })
        .returning();

      for (const exInput of setInput.exercises) {
        await tx.insert(setExercisesTable).values({
          setId: planSet.id,
          exerciseId: exInput.exerciseId,
          targetValue: exInput.targetValue,
          orderIndex: exInput.orderIndex,
        });
      }
    }

    if (assignedUserIds.length > 0) {
      await tx.insert(planAssignmentsTable).values(
        assignedUserIds.map((userId) => ({ planId: plan.id, userId }))
      );
    }

    return plan.id;
  });

  const detail = await getPlanDetail(planId);
  res.status(201).json(GetPlanResponse.parse(detail));
});

router.get("/plans/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [planCheck] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(and(eq(plansTable.id, params.data.id), eq(plansTable.organizationId, orgId)));

  if (!planCheck) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const detail = await getPlanDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  res.json(GetPlanResponse.parse(detail));
});

router.put("/plans/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = UpdatePlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const validationError = validateSetExerciseCounts(parsed.data.sets);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const [existingPlan] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.id, params.data.id), eq(plansTable.organizationId, orgId)));

  if (!existingPlan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const isGlobal = parsed.data.isGlobal ?? existingPlan.isGlobal;
  const assignedUserIds = parsed.data.assignedUserIds != null
    ? [...new Set(parsed.data.assignedUserIds)]
    : undefined;

  if (!isGlobal && assignedUserIds !== undefined && assignedUserIds.length === 0) {
    res.status(400).json({ error: "Plan must be global or assigned to at least one user" });
    return;
  }

  const allExerciseIds = [...new Set(parsed.data.sets.flatMap(s => s.exercises.map(e => e.exerciseId)))];
  const ownershipError = await validateOrgOwnership(orgId, assignedUserIds ?? [], allExerciseIds);
  if (ownershipError) {
    res.status(400).json({ error: ownershipError });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(plansTable)
      .set({ name: parsed.data.name, isGlobal })
      .where(eq(plansTable.id, params.data.id));

    await tx
      .delete(planSetsTable)
      .where(eq(planSetsTable.planId, params.data.id));

    for (const setInput of parsed.data.sets) {
      const [planSet] = await tx
        .insert(planSetsTable)
        .values({
          planId: params.data.id,
          type: setInput.type,
          rounds: setInput.rounds,
          restSeconds: setInput.restSeconds ?? null,
          orderIndex: setInput.orderIndex,
        })
        .returning();

      for (const exInput of setInput.exercises) {
        await tx.insert(setExercisesTable).values({
          setId: planSet.id,
          exerciseId: exInput.exerciseId,
          targetValue: exInput.targetValue,
          orderIndex: exInput.orderIndex,
        });
      }
    }

    if (assignedUserIds !== undefined) {
      await tx.delete(planAssignmentsTable).where(eq(planAssignmentsTable.planId, params.data.id));
      if (assignedUserIds.length > 0) {
        await tx.insert(planAssignmentsTable).values(
          assignedUserIds.map((userId) => ({ planId: params.data.id, userId }))
        );
      }
    }
  });

  const detail = await getPlanDetail(params.data.id);
  if (!detail) {
    res.status(500).json({ error: "Failed to retrieve updated plan" });
    return;
  }
  res.json(UpdatePlanResponse.parse(detail));
});

router.delete("/plans/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = DeletePlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plan] = await db
    .delete(plansTable)
    .where(and(eq(plansTable.id, params.data.id), eq(plansTable.organizationId, orgId)))
    .returning();

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
