import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, exercisesTable } from "@workspace/db";
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

export default router;
