import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { usePlan } from "@/hooks/use-plans";
import { useUserContext } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Calendar, Save } from "lucide-react";
import { motion } from "framer-motion";
import {
  startSession,
  upsertSessionLog,
  updateSessionStatus,
} from "@workspace/api-client-react";
import type { PlanDetail } from "@workspace/api-client-react";

function getMeasurementLabel(type: string): string {
  switch (type) {
    case "seconds":
      return "sec";
    case "meters":
      return "m";
    default:
      return "reps";
  }
}

interface ExerciseRound {
  setId: number;
  exerciseId: number;
  exerciseName: string;
  measurementType: string;
  roundNumber: number;
  targetValue: string;
}

interface ExerciseGroup {
  setId: number;
  exerciseId: number;
  exerciseName: string;
  measurementType: string;
  rounds: ExerciseRound[];
}

function buildExerciseGroups(plan: PlanDetail): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const sortedSets = [...plan.sets].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const set of sortedSets) {
    const sortedExercises = [...set.exercises].sort((a, b) => a.orderIndex - b.orderIndex);

    for (const ex of sortedExercises) {
      const rounds: ExerciseRound[] = [];
      for (let r = 1; r <= set.rounds; r++) {
        rounds.push({
          setId: set.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          measurementType: ex.exerciseMeasurementType,
          roundNumber: r,
          targetValue: ex.targetValue,
        });
      }
      groups.push({
        setId: set.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        measurementType: ex.exerciseMeasurementType,
        rounds,
      });
    }
  }

  return groups;
}

export default function LogPastPage() {
  const params = useParams<{ planId: string }>();
  const planId = Number(params.planId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { activeUser } = useUserContext();
  const { data: plan, isLoading } = usePlan(planId);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [isSaving, setIsSaving] = useState(false);
  const [logValues, setLogValues] = useState<
    Record<string, { weight: string; value: string }>
  >({});

  const exerciseGroups = useMemo(
    () => (plan ? buildExerciseGroups(plan) : []),
    [plan]
  );

  const getKey = (setId: number, exerciseId: number, roundNumber: number) =>
    `${setId}-${exerciseId}-${roundNumber}`;

  const updateValue = (key: string, field: "weight" | "value", val: string) => {
    setLogValues((prev) => ({
      ...prev,
      [key]: { ...{ weight: "", value: "" }, ...prev[key], [field]: val },
    }));
  };

  const handleSave = async () => {
    if (!plan || !activeUser) return;

    const entries = Object.entries(logValues).filter(([, v]) => v.weight || v.value);
    if (entries.length === 0) {
      toast({ title: "No data entered", description: "Fill in at least one exercise round.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const startedAt = new Date(date + "T09:00:00").toISOString();
      const completedAt = new Date(date + "T10:00:00").toISOString();

      const session = await startSession({
        planId,
        userId: activeUser.id,
        startedAt,
      });

      for (const [key, vals] of entries) {
        const [setId, exerciseId, roundNumber] = key.split("-").map(Number);
        const weight = vals.weight ? parseFloat(vals.weight) : null;
        const value = vals.value ? parseFloat(vals.value) : null;

        if (weight !== null || value !== null) {
          await upsertSessionLog(session.id, {
            planSetId: setId,
            exerciseId,
            roundNumber,
            weight,
            value,
          });
        }
      }

      await updateSessionStatus(session.id, { status: "completed", completedAt });

      toast({ title: "Workout saved!" });
      setLocation("/history");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save workout";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Log Past Workout" backTo="/">
        <div className="flex justify-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout title="Log Past Workout" backTo="/">
        <div className="p-4 text-center text-muted-foreground">
          Plan not found.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={plan.name} backTo="/">
      <div className="p-4 space-y-5 pb-28">
        <div className="bg-card rounded-2xl p-4 card-shadow">
          <label className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Workout Date
              </p>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border-2 border-border bg-muted/30 text-sm font-semibold focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </label>
        </div>

        <div className="space-y-4">
          {exerciseGroups.map((group, index) => (
            <motion.div
              key={`${group.setId}-${group.exerciseId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card rounded-2xl overflow-hidden card-shadow"
            >
              <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{group.exerciseName}</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Target: {group.rounds[0]?.targetValue} {getMeasurementLabel(group.measurementType)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border/30">
                <div className="grid grid-cols-[50px_1fr_1fr] px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Round</span>
                  <span className="text-center">Weight (kg)</span>
                  <span className="text-center">
                    {getMeasurementLabel(group.measurementType)}
                  </span>
                </div>
                {group.rounds.map((round) => {
                  const key = getKey(round.setId, round.exerciseId, round.roundNumber);
                  const vals = logValues[key] ?? { weight: "", value: "" };
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[50px_1fr_1fr] gap-2 px-4 py-2 items-center"
                    >
                      <span className="text-sm font-medium text-muted-foreground">
                        #{round.roundNumber}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="0"
                        value={vals.weight}
                        onChange={(e) => updateValue(key, "weight", e.target.value)}
                        className="h-9 w-full px-2 rounded-lg border-2 border-border bg-muted/20 text-center text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder={round.targetValue}
                        value={vals.value}
                        onChange={(e) => updateValue(key, "value", e.target.value)}
                        className="h-9 w-full px-2 rounded-lg border-2 border-border bg-muted/20 text-center text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}

          {exerciseGroups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              This plan has no exercises.
            </div>
          )}
        </div>
      </div>

      {exerciseGroups.length > 0 && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50 px-4 py-4 pb-safe z-30">
          <div className="max-w-md mx-auto">
            <Button
              className="w-full gap-2"
              onClick={handleSave}
              isLoading={isSaving}
            >
              <Save className="w-4 h-4" />
              Save Workout
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
