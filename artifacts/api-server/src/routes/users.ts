import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, sessionsTable, planAssignmentsTable } from "@workspace/db";
import { CreateUserBody, DeleteUserParams, UpdateUserBody, UpdateUserParams } from "@workspace/api-zod";
import "../types";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  if (req.user!.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can manage users" });
    return;
  }
  const orgId = req.user!.organizationId;

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      username: usersTable.username,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.organizationId, orgId))
    .orderBy(usersTable.createdAt);

  res.json(users);
});

router.post("/users", async (req, res): Promise<void> => {
  if (req.user!.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can manage users" });
    return;
  }
  const orgId = req.user!.organizationId;

  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      role: parsed.data.role ?? "client",
      organizationId: orgId,
    })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      username: usersTable.username,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      createdAt: usersTable.createdAt,
    });

  res.status(201).json(user);
});

router.put("/users/:id", async (req, res): Promise<void> => {
  if (req.user!.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can manage users" });
    return;
  }
  const orgId = req.user!.organizationId;

  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ name: body.data.name })
    .where(and(eq(usersTable.id, params.data.id), eq(usersTable.organizationId, orgId)))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      username: usersTable.username,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      createdAt: usersTable.createdAt,
    });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  if (req.user!.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can manage users" });
    return;
  }
  const orgId = req.user!.organizationId;

  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, params.data.id), eq(usersTable.organizationId, orgId)));

  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.delete(planAssignmentsTable).where(eq(planAssignmentsTable.userId, params.data.id));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, params.data.id));
  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
