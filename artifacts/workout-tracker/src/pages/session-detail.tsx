import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useSessionDetail } from "@/hooks/use-history";
import { useSessionMutations } from "@/hooks/use-sessions";
import { Calendar, Clock, Dumbbell, Trash2, Activity, Check } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { SessionLogEntry } from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface GroupedExercise {
  exerciseId: number;
  exerciseName: string;
  measurementType: string;
  planSetId: number;
  rounds: SessionLogEntry[];
}

interface ConditioningEntry {
  logId: number;
  planSetId: number | null;
  description: string | null;
}

function groupLogsByExercise(logs: SessionLogEntry[]): GroupedExercise[] {
  const groups = new Map<string, GroupedExercise>();

  for (const log of logs) {
    if (log.exerciseName == null) continue;
    const key = `${log.planSetId}-${log.exerciseId ?? `del-${log.planSetId}`}`;
    if (!groups.has(key)) {
      groups.set(key, {
        exerciseId: log.exerciseId ?? 0,
        exerciseName: log.exerciseName,
        measurementType: log.exerciseMeasurementType ?? "reps",
        planSetId: log.planSetId,
        rounds: [],
      });
    }
    groups.get(key)!.rounds.push(log);
  }

  for (const group of groups.values()) {
    group.rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  }

  return Array.from(groups.values());
}

function getConditioningEntries(logs: SessionLogEntry[]): ConditioningEntry[] {
  const out: ConditioningEntry[] = [];
  for (const log of logs) {
    if (log.exerciseName != null) continue;
    out.push({
      logId: log.id,
      planSetId: log.planSetId ?? null,
      description: log.setDescription ?? null,
    });
  }
  return out;
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: session, isLoading } = useSessionDetail(Number(params.id));
  const { remove } = useSessionMutations();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (!session) return;
    remove.mutate(session.id, {
      onSuccess: () => {
        toast({ title: "Session deleted" });
        setLocation("/history");
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to delete session";
        toast({ title: "Error", description: message, variant: "destructive" });
        setShowDeleteConfirm(false);
      },
    });
  };

  if (isLoading) {
    return (
      <Layout title="Session" backTo="/history">
        <div className="flex justify-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout title="Session" backTo="/history">
        <div className="p-4 text-center text-muted-foreground">
          Session not found.
        </div>
      </Layout>
    );
  }

  const startedAt = session.startedAt ? new Date(session.startedAt) : null;
  const completedAt = session.completedAt
    ? new Date(session.completedAt)
    : null;
  const duration = startedAt && completedAt
    ? formatDistanceStrict(startedAt, completedAt)
    : "—";

  const exerciseGroups = groupLogsByExercise(session.logs);
  const conditioningEntries = getConditioningEntries(session.logs);
  const setNotes = new Map<number, string>();
  for (const n of (session.setNotes ?? [])) {
    setNotes.set(n.planSetId, n.note);
  }

  const setIds = [...new Set([
    ...exerciseGroups.map(g => g.planSetId),
    ...(session.setNotes ?? []).map(n => n.planSetId),
  ])];

  return (
    <Layout title={session.planName} backTo="/history">
      <div className="p-4 space-y-5 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {startedAt ? format(startedAt, "MMM d, yyyy · h:mm a") : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {duration}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Delete session"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-3 card-shadow text-center">
            <p className="text-xl font-bold text-primary">
              {exerciseGroups.length}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Exercises
            </p>
          </div>
          <div className="bg-card rounded-xl p-3 card-shadow text-center">
            <p className="text-xl font-bold text-primary">
              {session.logs.length}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Sets Logged
            </p>
          </div>
          <div className="bg-card rounded-xl p-3 card-shadow text-center">
            <p className="text-xl font-bold text-primary">{duration}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              Duration
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {conditioningEntries.map((conditioning, idx) => (
            <motion.div
              key={`cond-${conditioning.logId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card rounded-2xl overflow-hidden card-shadow"
            >
              <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-sm">Conditioning</h3>
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                  <Check className="w-3.5 h-3.5" />
                  Completed
                </span>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {conditioning.description || (
                    <span className="text-muted-foreground italic">No description</span>
                  )}
                </p>
              </div>
            </motion.div>
          ))}
          {setIds.map((setId, setIdx) => {
            const setGroups = exerciseGroups.filter(g => g.planSetId === setId);
            const note = setNotes.get(setId);
            return (
              <div key={setId} className="space-y-3">
                {setGroups.map((group, index) => (
                  <motion.div
                    key={`${group.planSetId}-${group.exerciseId}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (setIdx + index) * 0.05 }}
                    className="bg-card rounded-2xl overflow-hidden card-shadow"
                  >
                    <div className="px-4 py-3 bg-muted/30 border-b border-border/50 flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Dumbbell className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm">{group.exerciseName}</h3>
                    </div>

                    <div className="divide-y divide-border/30">
                      <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Round</span>
                        <span className="text-center">Weight</span>
                        <span className="text-right">
                          {getMeasurementLabel(group.measurementType)}
                        </span>
                      </div>
                      {group.rounds.map((round) => (
                        <div
                          key={round.id}
                          className="grid grid-cols-3 px-4 py-3 items-center"
                        >
                          <span className="text-sm font-medium text-muted-foreground">
                            #{round.roundNumber}
                          </span>
                          <span className="text-sm font-bold text-center">
                            {round.weight != null ? `${round.weight} kg` : "—"}
                          </span>
                          <span className="text-sm font-bold text-primary text-right">
                            {round.value != null
                              ? `${round.value} ${getMeasurementLabel(group.measurementType)}`
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
                {note && (
                  <div className="bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mt-0.5 flex-shrink-0">
                      <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                    </svg>
                    <p className="text-sm text-amber-900">{note}</p>
                  </div>
                )}
              </div>
            );
          })}

          {exerciseGroups.length === 0 && conditioningEntries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No exercises were logged in this session.
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workout session and all its
              logged data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
