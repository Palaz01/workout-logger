import { Router, type IRouter } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  db,
  exercisesTable,
  sessionsTable,
  sessionLogsTable,
  plansTable,
} from "@workspace/db";
import "../types";
import {
  CreateExerciseBody,
  ListExercisesResponse,
  GetExerciseParams,
  GetExerciseResponse,
  UpdateExerciseParams,
  UpdateExerciseBody,
  UpdateExerciseResponse,
  DeleteExerciseParams,
  GetExerciseHistoryParams,
  GetExerciseHistoryQueryParams,
  GetExerciseHistoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exercises", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const exercises = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.organizationId, orgId))
    .orderBy(exercisesTable.name);
  res.json(ListExercisesResponse.parse(exercises));
});

router.post("/exercises", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [exercise] = await db
    .insert(exercisesTable)
    .values({ ...parsed.data, organizationId: orgId })
    .returning();

  res.status(201).json(GetExerciseResponse.parse(exercise));
});

router.get("/exercises/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [exercise] = await db
    .select()
    .from(exercisesTable)
    .where(and(eq(exercisesTable.id, params.data.id), eq(exercisesTable.organizationId, orgId)));

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.json(GetExerciseResponse.parse(exercise));
});

router.put("/exercises/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = UpdateExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [exercise] = await db
    .update(exercisesTable)
    .set(parsed.data)
    .where(and(eq(exercisesTable.id, params.data.id), eq(exercisesTable.organizationId, orgId)))
    .returning();

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.json(UpdateExerciseResponse.parse(exercise));
});

router.delete("/exercises/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = DeleteExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [exercise] = await db
    .delete(exercisesTable)
    .where(and(eq(exercisesTable.id, params.data.id), eq(exercisesTable.organizationId, orgId)))
    .returning();

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/exercises/:id/history", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetExerciseHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const queryParams = GetExerciseHistoryQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { userId, since, limit } = queryParams.data;
  const effectiveLimit = limit ?? 200;

  const [exercise] = await db
    .select()
    .from(exercisesTable)
    .where(and(eq(exercisesTable.id, params.data.id), eq(exercisesTable.organizationId, orgId)));

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const conditions = [
    eq(sessionLogsTable.exerciseId, params.data.id),
    eq(sessionsTable.organizationId, orgId),
    eq(sessionsTable.userId, userId),
    eq(sessionsTable.status, "completed"),
  ];
  if (since) {
    conditions.push(gte(sessionsTable.completedAt, new Date(since)));
  }

  const rows = await db
    .select({
      sessionId: sessionsTable.id,
      sessionDate: sessionsTable.completedAt,
      planId: sessionsTable.planId,
      livePlanName: plansTable.name,
      snapshotPlanName: sessionsTable.snapshotPlanName,
      planSetId: sessionLogsTable.planSetId,
      roundNumber: sessionLogsTable.roundNumber,
      weight: sessionLogsTable.weight,
      value: sessionLogsTable.value,
      snapshotMeasurementType: sessionLogsTable.snapshotMeasurementType,
    })
    .from(sessionLogsTable)
    .innerJoin(sessionsTable, eq(sessionLogsTable.sessionId, sessionsTable.id))
    .leftJoin(plansTable, eq(sessionsTable.planId, plansTable.id))
    .where(and(...conditions))
    .orderBy(desc(sessionsTable.completedAt), sessionLogsTable.roundNumber)
    .limit(effectiveLimit);

  const entries = rows.map((row) => ({
    sessionId: row.sessionId,
    sessionDate: row.sessionDate ?? new Date(0),
    planId: row.planId ?? null,
    planName: row.snapshotPlanName ?? row.livePlanName ?? "Deleted Plan",
    planSetId: row.planSetId ?? null,
    roundNumber: row.roundNumber,
    weight: row.weight,
    value: row.value,
    measurementType:
      (row.snapshotMeasurementType as "reps" | "seconds" | "meters" | null) ??
      (exercise.measurementType as "reps" | "seconds" | "meters"),
  }));

  res.json(GetExerciseHistoryResponse.parse({ entries }));
});

export default router;
