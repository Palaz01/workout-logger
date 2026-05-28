import { pgTable, text, serial, integer, timestamp, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { plansTable, planSetsTable } from "./plans";
import { exercisesTable } from "./exercises";
import { usersTable } from "./users";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => plansTable.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status", { enum: ["scheduled", "active", "completed", "cancelled"] }).notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  snapshotPlanName: text("snapshot_plan_name"),
});

export const sessionLogsTable = pgTable("session_logs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  planSetId: integer("plan_set_id").references(() => planSetsTable.id, { onDelete: "set null" }),
  exerciseId: integer("exercise_id").references(() => exercisesTable.id, { onDelete: "set null" }),
  roundNumber: integer("round_number").notNull(),
  weight: real("weight"),
  value: real("value"),
  snapshotExerciseName: text("snapshot_exercise_name"),
  snapshotMeasurementType: text("snapshot_measurement_type"),
  snapshotSetDescription: text("snapshot_set_description"),
}, (table) => [
  uniqueIndex("session_log_unique_idx").on(table.sessionId, table.planSetId, table.exerciseId, table.roundNumber),
]);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, startedAt: true, completedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

export const sessionSetNotesTable = pgTable("session_set_notes", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  planSetId: integer("plan_set_id").references(() => planSetsTable.id, { onDelete: "set null" }),
  note: text("note").notNull(),
}, (table) => [
  uniqueIndex("session_set_note_unique_idx").on(table.sessionId, table.planSetId),
]);

export const insertSessionLogSchema = createInsertSchema(sessionLogsTable).omit({ id: true });
export type InsertSessionLog = z.infer<typeof insertSessionLogSchema>;
export type SessionLog = typeof sessionLogsTable.$inferSelect;
