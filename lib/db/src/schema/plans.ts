import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { exercisesTable } from "./exercises";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  isGlobal: boolean("is_global").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const planAssignmentsTable = pgTable("plan_assignments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("plan_assignment_unique_idx").on(table.planId, table.userId),
]);

export const planSetsTable = pgTable("plan_sets", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("straight"),
  rounds: integer("rounds").notNull().default(1),
  restSeconds: integer("rest_seconds"),
  orderIndex: integer("order_index").notNull(),
  description: text("description"),
});

export const setExercisesTable = pgTable("set_exercises", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").notNull().references(() => planSetsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id, { onDelete: "cascade" }),
  targetValue: text("target_value").notNull().default("10"),
  orderIndex: integer("order_index").notNull(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const insertPlanAssignmentSchema = createInsertSchema(planAssignmentsTable).omit({ id: true });
export type InsertPlanAssignment = z.infer<typeof insertPlanAssignmentSchema>;
export type PlanAssignment = typeof planAssignmentsTable.$inferSelect;

export const insertPlanSetSchema = createInsertSchema(planSetsTable).omit({ id: true });
export type InsertPlanSet = z.infer<typeof insertPlanSetSchema>;
export type PlanSet = typeof planSetsTable.$inferSelect;

export const insertSetExerciseSchema = createInsertSchema(setExercisesTable).omit({ id: true });
export type InsertSetExercise = z.infer<typeof insertSetExerciseSchema>;
export type SetExercise = typeof setExercisesTable.$inferSelect;
