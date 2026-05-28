import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useSessionHistory } from "@/hooks/use-history";
import { useSessionMutations } from "@/hooks/use-sessions";
import { Calendar, Clock, Dumbbell, Trash2, History as HistoryIcon, Activity, Check } from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceStrict } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { SessionSummary } from "@workspace/api-client-react";
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

interface MonthGroup {
  key: string;
  label: string;
  sessions: SessionSummary[];
}

function groupByMonth(sessions: SessionSummary[]): MonthGroup[] {
  const groups: Map<string, MonthGroup> = new Map();

  for (const session of sessions) {
    const date = new Date(session.completedAt ?? session.startedAt);
    const key = format(date, "yyyy-MM");
    const label = format(date, "MMMM yyyy");

    if (!groups.has(key)) {
      groups.set(key, { key, label, sessions: [] });
    }
    groups.get(key)!.sessions.push(session);
  }

  return Array.from(groups.values());
}

export default function HistoryPage() {
  const { data: sessions, isLoading } = useSessionHistory();
  const { remove } = useSessionMutations();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  const monthGroups = useMemo(
    () => (sessions?.length ? groupByMonth(sessions) : []),
    [sessions]
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Session deleted" });
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to delete session";
        toast({ title: "Error", description: message, variant: "destructive" });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <Layout title="History">
      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : monthGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <HistoryIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No workout history</h3>
            <p className="text-muted-foreground">
              Complete a workout session and it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {monthGroups.map((group) => (
              <section key={group.key}>
                <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md py-3 px-1 -mx-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold font-display text-foreground">
                      {group.label}
                    </h2>
                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                      {group.sessions.length} {group.sessions.length === 1 ? "workout" : "workouts"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 mt-1">
                  {group.sessions.map((session) => {
                    const startedAt = new Date(session.startedAt);
                    const completedAt = session.completedAt
                      ? new Date(session.completedAt)
                      : null;
                    const duration = completedAt
                      ? formatDistanceStrict(startedAt, completedAt)
                      : "\u2014";

                    return (
                      <div
                        key={session.id}
                        className="bg-card rounded-2xl card-shadow hover:card-shadow-hover transition-shadow relative overflow-hidden"
                      >
                        <div className="flex items-center">
                          <Link
                            href={`/history/${session.id}`}
                            className="block p-4 flex-1 min-w-0"
                          >
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-green-500/5 rounded-full blur-2xl pointer-events-none" />

                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="font-bold text-base leading-tight truncate">
                                {session.planName}
                              </h3>
                              {session.status === "cancelled" && (
                                <span className="text-[10px] font-semibold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                                  Cancelled
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(startedAt, "EEE, MMM d")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {duration}
                              </span>
                              <span className="flex items-center gap-1">
                                <Dumbbell className="w-3.5 h-3.5" />
                                {session.logCount} logged
                              </span>
                            </div>
                            {session.conditioningEntries && session.conditioningEntries.length > 0 && (
                              <ul className="mt-2.5 space-y-1.5">
                                {session.conditioningEntries.map((c, i) => (
                                  <li
                                    key={`${c.planSetId ?? "null"}-${i}`}
                                    className="flex items-start gap-2 text-xs bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-1.5"
                                  >
                                    <Activity className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                    <span className="flex-1 text-foreground/80 line-clamp-2 whitespace-pre-wrap leading-snug">
                                      {c.description || (
                                        <span className="italic text-muted-foreground">No description</span>
                                      )}
                                    </span>
                                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600 dark:text-green-500 flex-shrink-0">
                                      <Check className="w-3 h-3" />
                                      Done
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Link>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(session);
                            }}
                            className="p-3 mr-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workout session
              {deleteTarget?.planName ? ` (${deleteTarget.planName})` : ""} and
              all its logged data. This action cannot be undone.
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
