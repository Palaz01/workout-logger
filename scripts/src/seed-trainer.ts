import {
  db,
  organizationsTable,
  usersTable,
  plansTable,
  sessionsTable,
  exercisesTable,
  planAssignmentsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

async function seedTrainer() {
  const passwordHash = await bcrypt.hash("admin", SALT_ROUNDS);

  let [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.name, "Default Gym"));

  if (!org) {
    [org] = await db
      .insert(organizationsTable)
      .values({ name: "Default Gym" })
      .returning();
    console.log(`Created organization "${org.name}" (id=${org.id})`);
  } else {
    console.log(`Organization "${org.name}" already exists (id=${org.id})`);
  }

  let [trainer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, "palazoli"));

  if (!trainer) {
    const [existingByRole] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, "trainer"), eq(usersTable.organizationId, org.id)));

    if (existingByRole) {
      await db
        .update(usersTable)
        .set({
          email: "barnabas.apaltinus@gmail.com",
          username: "palazoli",
          passwordHash,
          organizationId: org.id,
          emailVerified: true,
        })
        .where(eq(usersTable.id, existingByRole.id));
      trainer = { ...existingByRole, username: "palazoli", email: "barnabas.apaltinus@gmail.com", passwordHash, organizationId: org.id };
      console.log(`Updated existing trainer "${trainer.name}" (id=${trainer.id}) with auth fields`);
    } else {
      [trainer] = await db
        .insert(usersTable)
        .values({
          name: "PZoli",
          email: "barnabas.apaltinus@gmail.com",
          username: "palazoli",
          passwordHash,
          role: "trainer",
          organizationId: org.id,
          emailVerified: true,
        })
        .returning();
      console.log(`Created trainer "${trainer.name}" (id=${trainer.id})`);
    }
  } else {
    await db
      .update(usersTable)
      .set({
        email: "barnabas.apaltinus@gmail.com",
        passwordHash,
        organizationId: org.id,
        emailVerified: true,
      })
      .where(eq(usersTable.id, trainer.id));
    console.log(`Updated trainer "${trainer.name}" (id=${trainer.id}) with auth fields`);
  }

  let [anna] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, "anna"));

  if (!anna) {
    const [existingByName] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.name, "Anna"), eq(usersTable.organizationId, org.id)));

    if (existingByName) {
      await db
        .update(usersTable)
        .set({
          username: "anna",
          passwordHash,
          organizationId: org.id,
          emailVerified: true,
        })
        .where(eq(usersTable.id, existingByName.id));
      anna = { ...existingByName, username: "anna", passwordHash, organizationId: org.id };
      console.log(`Updated existing client "Anna" (id=${anna.id}) with auth fields`);
    } else {
      [anna] = await db
        .insert(usersTable)
        .values({
          name: "Anna",
          username: "anna",
          passwordHash,
          role: "client",
          organizationId: org.id,
          emailVerified: true,
        })
        .returning();
      console.log(`Created client "Anna" (id=${anna.id})`);
    }
  } else {
    await db
      .update(usersTable)
      .set({
        passwordHash,
        organizationId: org.id,
        emailVerified: true,
      })
      .where(eq(usersTable.id, anna.id));
    console.log(`Updated client "Anna" (id=${anna.id}) with auth fields`);
  }

  await db
    .update(usersTable)
    .set({ organizationId: org.id })
    .where(isNull(usersTable.organizationId));
  console.log("Set organizationId on all users without one");

  await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.emailVerified, false));
  console.log("Marked all existing users as email-verified");

  await db
    .update(plansTable)
    .set({ createdBy: trainer.id, isGlobal: true, organizationId: org.id })
    .where(isNull(plansTable.organizationId));
  console.log("Updated plans: set organizationId, createdBy, isGlobal on unassigned plans");

  await db
    .update(exercisesTable)
    .set({ organizationId: org.id })
    .where(isNull(exercisesTable.organizationId));
  console.log("Updated exercises: set organizationId on unassigned exercises");

  await db
    .update(sessionsTable)
    .set({ userId: trainer.id, organizationId: org.id })
    .where(isNull(sessionsTable.organizationId));
  console.log("Updated sessions: set organizationId and userId on unassigned sessions");

  const allPlans = await db.select({ id: plansTable.id }).from(plansTable);
  for (const plan of allPlans) {
    const existing = await db
      .select()
      .from(planAssignmentsTable)
      .where(
        and(
          eq(planAssignmentsTable.planId, plan.id),
          eq(planAssignmentsTable.userId, trainer.id)
        )
      );
    if (existing.length === 0) {
      await db
        .insert(planAssignmentsTable)
        .values({ planId: plan.id, userId: trainer.id });
      console.log(`Assigned plan ${plan.id} to trainer (id=${trainer.id})`);
    }
  }
  console.log("Plan assignments complete");
}

seedTrainer()
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
