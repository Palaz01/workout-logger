import { Router, type IRouter } from "express";
import { eq, and, desc, count, inArray, sql, isNotNull } from "drizzle-orm";
import "../types";
import {
  db,
  sessionsTable,
  sessionLogsTable,
  sessionSetNotesTable,
  plansTable,
  planSetsTable,
  setExercisesTable,
  exercisesTable,
  usersTable,
} from "@workspace/db";
import {
  StartSessionBody,
  GetSessionParams,
  GetSessionResponse,
  UpdateSessionStatusParams,
  UpdateSessionStatusBody,
  UpdateSessionStatusResponse,
  UpsertSessionLogParams,
  UpsertSessionLogBody,
  UpsertSessionLogResponse,
  GetLastSessionParams,
  GetLastSessionQueryParams,
  GetLastSessionResponse,
  GetActiveSessionParams,
  GetActiveSessionQueryParams,
  GetActiveSessionResponse,
  ListSessionsQueryParams,
  UpsertSessionSetNoteParams,
  UpsertSessionSetNoteBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSessionDetail(sessionId: number) {
  const [session] = await db
    .select({
      id: sessionsTable.id,
      planId: sessionsTable.planId,
      livePlanName: plansTable.name,
      snapshotPlanName: sessionsTable.snapshotPlanName,
      userId: sessionsTable.userId,
      status: sessionsTable.status,
      startedAt: sessionsTable.startedAt,
      completedAt: sessionsTable.completedAt,
    })
    .from(sessionsTable)
    .leftJoin(plansTable, eq(sessionsTable.planId, plansTable.id))
    .where(eq(sessionsTable.id, sessionId));

  if (!session) return null;

  const rawLogs = await db
    .select({
      id: sessionLogsTable.id,
      sessionId: sessionLogsTable.sessionId,
      planSetId: sessionLogsTable.planSetId,
      exerciseId: sessionLogsTable.exerciseId,
      liveExerciseName: exercisesTable.name,
      liveExerciseMeasurementType: exercisesTable.measurementType,
      snapshotExerciseName: sessionLogsTable.snapshotExerciseName,
      snapshotMeasurementType: sessionLogsTable.snapshotMeasurementType,
      roundNumber: sessionLogsTable.roundNumber,
      weight: sessionLogsTable.weight,
      value: sessionLogsTable.value,
    })
    .from(sessionLogsTable)
    .leftJoin(exercisesTable, eq(sessionLogsTable.exerciseId, exercisesTable.id))
    .where(eq(sessionLogsTable.sessionId, sessionId));

  const isCompleted = session.status !== "active";

  const logs = rawLogs.map((log) => ({
    id: log.id,
    sessionId: log.sessionId,
    planSetId: log.planSetId ?? 0,
    exerciseId: log.exerciseId ?? 0,
    exerciseName: isCompleted
      ? (log.snapshotExerciseName ?? log.liveExerciseName ?? "Deleted Exercise")
      : (log.liveExerciseName ?? log.snapshotExerciseName ?? "Deleted Exercise"),
    exerciseMeasurementType: isCompleted
      ? (log.snapshotMeasurementType ?? log.liveExerciseMeasurementType ?? "reps")
      : (log.liveExerciseMeasurementType ?? log.snapshotMeasurementType ?? "reps"),
    roundNumber: log.roundNumber,
    weight: log.weight,
    value: log.value,
  }));

  const setNotes = await db
    .select({
      planSetId: sessionSetNotesTable.planSetId,
      note: sessionSetNotesTable.note,
    })
    .from(sessionSetNotesTable)
    .where(eq(sessionSetNotesTable.sessionId, sessionId));

  return {
    id: session.id,
    planId: session.planId ?? 0,
    planName: isCompleted
      ? (session.snapshotPlanName ?? session.livePlanName ?? "Deleted Plan")
      : (session.livePlanName ?? session.snapshotPlanName ?? "Deleted Plan"),
    userId: session.userId,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    logs,
    setNotes: setNotes.filter((n) => n.planSetId != null) as { planSetId: number; note: string }[],
  };
}

router.get("/sessions", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;
  const params = ListSessionsQueryParams.safeParse(req.query);
  const limit = params.data?.limit ?? 50;
  const offset = params.data?.offset ?? 0;
  const userId = params.data?.userId;

  const conditions = [inArray(sessionsTable.status, ["completed", "cancelled"]), eq(sessionsTable.organizationId, orgId)];
  if (userId != null) {
    conditions.push(eq(sessionsTable.userId, userId));
  }

  const rawSessions = await db
    .select({
      id: sessionsTable.id,
      planId: sessionsTable.planId,
      livePlanName: plansTable.name,
      snapshotPlanName: sessionsTable.snapshotPlanName,
      userId: sessionsTable.userId,
      status: sessionsTable.status,
      startedAt: sessionsTable.startedAt,
      completedAt: sessionsTable.completedAt,
      logCount: count(sessionLogsTable.id),
    })
    .from(sessionsTable)
    .leftJoin(plansTable, eq(sessionsTable.planId, plansTable.id))
    .leftJoin(sessionLogsTable, eq(sessionsTable.id, sessionLogsTable.sessionId))
    .where(and(...conditions))
    .groupBy(sessionsTable.id, plansTable.name, sessionsTable.snapshotPlanName)
    .orderBy(desc(sessionsTable.completedAt))
    .limit(limit)
    .offset(offset);

  const sessions = rawSessions.map((s) => {
    const isCompleted = s.status !== "active";
    return {
      id: s.id,
      planId: s.planId ?? 0,
      planName: isCompleted
        ? (s.snapshotPlanName ?? s.livePlanName ?? "Deleted Plan")
        : (s.livePlanName ?? s.snapshotPlanName ?? "Deleted Plan"),
      userId: s.userId,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      logCount: s.logCount,
    };
  });

  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const bodyWithDate = {
    ...req.body,
    ...(req.body.startedAt ? { startedAt: new Date(req.body.startedAt) } : {}),
  };
  const parsed = StartSessionBody.safeParse(bodyWithDate);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [plan] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.id, parsed.data.planId), eq(plansTable.organizationId, orgId)));

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  if (parsed.data.userId != null) {
    const [userCheck] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, parsed.data.userId), eq(usersTable.organizationId, orgId)));
    if (!userCheck) {
      res.status(400).json({ error: "User not found in your organization" });
      return;
    }
  }

  if (!parsed.data.startedAt) {
    const activeConditions = [
      eq(sessionsTable.planId, parsed.data.planId),
      eq(sessionsTable.status, "active"),
      eq(sessionsTable.organizationId, orgId),
    ];
    if (parsed.data.userId != null) {
      activeConditions.push(eq(sessionsTable.userId, parsed.data.userId));
    }

    const [existingActive] = await db
      .select()
      .from(sessionsTable)
      .where(and(...activeConditions))
      .limit(1);

    if (existingActive) {
      const detail = await getSessionDetail(existingActive.id);
      res.status(200).json(detail);
      return;
    }
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      planId: parsed.data.planId,
      userId: parsed.data.userId ?? null,
      status: "active",
      organizationId: orgId,
      ...(parsed.data.startedAt ? { startedAt: parsed.data.startedAt } : {}),
    })
    .returning();

  const detail = await getSessionDetail(session.id);
  res.status(201).json(detail);
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [sessionCheck] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, params.data.id), eq(sessionsTable.organizationId, orgId)));

  if (!sessionCheck) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const detail = await getSessionDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(GetSessionResponse.parse(detail));
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = UpdateSessionStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const bodyWithDate = {
    ...req.body,
    ...(req.body.completedAt ? { completedAt: new Date(req.body.completedAt) } : {}),
  };
  const parsed = UpdateSessionStatusBody.safeParse(bodyWithDate);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, params.data.id), eq(sessionsTable.organizationId, orgId)));

  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (existing.status !== "active") {
    res.status(400).json({ error: "Session is already " + existing.status });
    return;
  }

  if (parsed.data.status === "cancelled") {
    const [logCountResult] = await db
      .select({ cnt: count() })
      .from(sessionLogsTable)
      .where(eq(sessionLogsTable.sessionId, params.data.id));

    if (Number(logCountResult.cnt) === 0) {
      const detail = await getSessionDetail(params.data.id);
      await db.delete(sessionLogsTable).where(eq(sessionLogsTable.sessionId, params.data.id));
      await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id));
      res.json(UpdateSessionStatusResponse.parse({
        ...detail!,
        status: "cancelled",
        completedAt: parsed.data.completedAt ?? new Date(),
        deleted: true,
      }));
      return;
    }
  }

  if (existing.planId) {
    const [plan] = await db
      .select({ name: plansTable.name })
      .from(plansTable)
      .where(eq(plansTable.id, existing.planId));
    if (plan) {
      await db
        .update(sessionsTable)
        .set({ snapshotPlanName: plan.name })
        .where(eq(sessionsTable.id, params.data.id));
    }
  }

  const logsToSnapshot = await db
    .select({
      logId: sessionLogsTable.id,
      exerciseName: exercisesTable.name,
      measurementType: exercisesTable.measurementType,
    })
    .from(sessionLogsTable)
    .innerJoin(exercisesTable, eq(sessionLogsTable.exerciseId, exercisesTable.id))
    .where(eq(sessionLogsTable.sessionId, params.data.id));

  for (const logRow of logsToSnapshot) {
    await db
      .update(sessionLogsTable)
      .set({
        snapshotExerciseName: logRow.exerciseName,
        snapshotMeasurementType: logRow.measurementType,
      })
      .where(eq(sessionLogsTable.id, logRow.logId));
  }

  await db
    .update(sessionsTable)
    .set({
      status: parsed.data.status,
      completedAt: parsed.data.completedAt ?? new Date(),
    })
    .where(eq(sessionsTable.id, params.data.id));

  const detail = await getSessionDetail(params.data.id);
  res.json(UpdateSessionStatusResponse.parse(detail!));
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [existing] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, params.data.id), eq(sessionsTable.organizationId, orgId)));

  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db.delete(sessionLogsTable).where(eq(sessionLogsTable.sessionId, params.data.id));
  await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id));

  res.status(204).send();
});

router.post("/sessions/:id/logs", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = UpsertSessionLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const parsed = UpsertSessionLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, params.data.id), eq(sessionsTable.organizationId, orgId)));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status !== "active") {
    res.status(400).json({ error: "Session is not active" });
    return;
  }

  const [planSet] = await db
    .select()
    .from(planSetsTable)
    .where(
      and(
        eq(planSetsTable.id, parsed.data.planSetId),
        eq(planSetsTable.planId, session.planId)
      )
    );

  if (!planSet) {
    res.status(400).json({ error: "Plan set does not belong to this session's plan" });
    return;
  }

  const [setExercise] = await db
    .select()
    .from(setExercisesTable)
    .where(
      and(
        eq(setExercisesTable.setId, parsed.data.planSetId),
        eq(setExercisesTable.exerciseId, parsed.data.exerciseId)
      )
    );

  if (!setExercise) {
    res.status(400).json({ error: "Exercise does not belong to this set" });
    return;
  }

  if (parsed.data.roundNumber < 1 || parsed.data.roundNumber > planSet.rounds) {
    res.status(400).json({ error: `Round number must be between 1 and ${planSet.rounds}` });
    return;
  }

  const [existing] = await db
    .select()
    .from(sessionLogsTable)
    .where(
      and(
        eq(sessionLogsTable.sessionId, params.data.id),
        eq(sessionLogsTable.planSetId, parsed.data.planSetId),
        eq(sessionLogsTable.exerciseId, parsed.data.exerciseId),
        eq(sessionLogsTable.roundNumber, parsed.data.roundNumber)
      )
    );

  const [exercise] = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.id, parsed.data.exerciseId));

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  let log;
  if (existing) {
    [log] = await db
      .update(sessionLogsTable)
      .set({
        weight: parsed.data.weight ?? null,
        value: parsed.data.value ?? null,
      })
      .where(eq(sessionLogsTable.id, existing.id))
      .returning();
  } else {
    [log] = await db
      .insert(sessionLogsTable)
      .values({
        sessionId: params.data.id,
        planSetId: parsed.data.planSetId,
        exerciseId: parsed.data.exerciseId,
        roundNumber: parsed.data.roundNumber,
        weight: parsed.data.weight ?? null,
        value: parsed.data.value ?? null,
      })
      .returning();
  }

  res.json(
    UpsertSessionLogResponse.parse({
      id: log.id,
      sessionId: log.sessionId,
      planSetId: log.planSetId,
      exerciseId: log.exerciseId,
      exerciseName: exercise.name,
      exerciseMeasurementType: exercise.measurementType,
      roundNumber: log.roundNumber,
      weight: log.weight,
      value: log.value,
    })
  );
});

router.post("/sessions/:id/set-note", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = UpsertSessionSetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const parsed = UpsertSessionSetNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, params.data.id), eq(sessionsTable.organizationId, orgId)));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status !== "active") {
    res.status(400).json({ error: "Session is not active" });
    return;
  }

  const [planSet] = await db
    .select()
    .from(planSetsTable)
    .where(
      and(
        eq(planSetsTable.id, parsed.data.planSetId),
        eq(planSetsTable.planId, session.planId)
      )
    );

  if (!planSet) {
    res.status(400).json({ error: "Invalid plan set for this session" });
    return;
  }

  const [existing] = await db
    .select()
    .from(sessionSetNotesTable)
    .where(
      and(
        eq(sessionSetNotesTable.sessionId, params.data.id),
        eq(sessionSetNotesTable.planSetId, parsed.data.planSetId)
      )
    );

  if (existing) {
    await db
      .update(sessionSetNotesTable)
      .set({ note: parsed.data.note })
      .where(eq(sessionSetNotesTable.id, existing.id));
  } else {
    await db.insert(sessionSetNotesTable).values({
      sessionId: params.data.id,
      planSetId: parsed.data.planSetId,
      note: parsed.data.note,
    });
  }

  res.json({ success: true });
});

router.get("/plans/:id/active-session", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetActiveSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const queryParams = GetActiveSessionQueryParams.safeParse(req.query);
  const userId = queryParams.data?.userId;

  const conditions = [
    eq(sessionsTable.planId, params.data.id),
    eq(sessionsTable.status, "active"),
    eq(sessionsTable.organizationId, orgId),
  ];
  if (userId != null) {
    conditions.push(eq(sessionsTable.userId, userId));
  }

  const [activeSession] = await db
    .select()
    .from(sessionsTable)
    .where(and(...conditions))
    .orderBy(desc(sessionsTable.startedAt))
    .limit(1);

  if (!activeSession) {
    res.json(GetActiveSessionResponse.parse({ session: null }));
    return;
  }

  const detail = await getSessionDetail(activeSession.id);
  res.json(GetActiveSessionResponse.parse({ session: detail }));
});

router.get("/plans/:id/last-session", async (req, res): Promise<void> => {
  const orgId = req.user!.organizationId;

  const params = GetLastSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const queryParams = GetLastSessionQueryParams.safeParse(req.query);
  const userId = queryParams.data?.userId;

  const conditions = [
    eq(sessionsTable.planId, params.data.id),
    eq(sessionsTable.status, "completed"),
    eq(sessionsTable.organizationId, orgId),
  ];
  if (userId != null) {
    conditions.push(eq(sessionsTable.userId, userId));
  }

  const [lastSession] = await db
    .select()
    .from(sessionsTable)
    .where(and(...conditions))
    .orderBy(desc(sessionsTable.completedAt))
    .limit(1);

  if (!lastSession) {
    res.json(GetLastSessionResponse.parse({ session: null }));
    return;
  }

  const detail = await getSessionDetail(lastSession.id);
  res.json(GetLastSessionResponse.parse({ session: detail }));
});

export default router;
