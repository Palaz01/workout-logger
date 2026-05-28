import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { usePlans, usePlanMutations } from "@/hooks/use-plans";
import { useSessionMutations } from "@/hooks/use-sessions";
import { useScheduledSessions } from "@/hooks/use-history";
import { useUserContext } from "@/contexts/UserContext";
import {
  Plus,
  Play,
  MoreVertical,
  Edit2,
  Trash2,
  Calendar,
  LayoutList,
  ClipboardList,
  ScrollText,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  isSameDay,
  startOfDay,
  isBefore,
} from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import type { SessionSummary } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { data: plans, isLoading } = usePlans();
  const { data: scheduled, isLoading: scheduledLoading } = useScheduledSessions();
  const { deletePlan } = usePlanMutations();
  const { schedule, activateScheduled, cancel } = useSessionMutations();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isTrainer } = useUserContext();

  const [tab, setTab] = useState<"scheduled" | "unscheduled">("scheduled");
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<{ id: number; name: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [cancelScheduledTarget, setCancelScheduledTarget] = useState<SessionSummary | null>(null);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    shiftWeek(dx < 0 ? 1 : -1);
  };

  const shiftWeek = (delta: number) => {
    const newStart = addWeeks(weekStart, delta);
    setWeekStart(newStart);
    const today = startOfDay(new Date());
    const todayInNewWeek =
      !isBefore(today, newStart) && isBefore(today, addDays(newStart, 7));
    setSelectedDay(todayInNewWeek ? today : newStart);
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionSummary[]>();
    if (!scheduled) return map;
    for (const s of scheduled) {
      if (!s.scheduledFor) continue;
      const key = format(startOfDay(new Date(s.scheduledFor)), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [scheduled]);

  const selectedDaySessions = useMemo(
    () => sessionsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [],
    [sessionsByDay, selectedDay]
  );

  const scheduledPlanIds = useMemo(() => {
    const set = new Set<number>();
    if (!scheduled) return set;
    const today = startOfDay(new Date());
    for (const s of scheduled) {
      if (!s.scheduledFor || s.planId == null) continue;
      const d = startOfDay(new Date(s.scheduledFor));
      if (!isBefore(d, today)) set.add(s.planId);
    }
    return set;
  }, [scheduled]);

  const unscheduledPlans = useMemo(
    () => (plans ?? []).filter((p) => !scheduledPlanIds.has(p.id)),
    [plans, scheduledPlanIds]
  );

  const handleSchedule = () => {
    if (!scheduleTarget) return;
    const date = new Date(`${scheduleDate}T09:00:00`);
    if (isNaN(date.getTime())) {
      toast({ title: "Invalid date", variant: "destructive" });
      return;
    }
    schedule.mutate(
      { planId: scheduleTarget.id, scheduledFor: date },
      {
        onSuccess: () => {
          toast({ title: "Workout scheduled", description: format(date, "EEE, MMM d, yyyy") });
          setScheduleTarget(null);
          setTab("scheduled");
          setSelectedDay(startOfDay(date));
          setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
        },
        onError: () => {
          toast({ title: "Failed to schedule", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this plan?")) {
      try {
        await deletePlan({ id });
        toast({ title: "Plan deleted" });
      } catch (e) {
        toast({ title: "Failed to delete plan", variant: "destructive" });
      }
    }
    setActiveMenuId(null);
  };

  const handleStartScheduled = (s: SessionSummary) => {
    activateScheduled.mutate(s.id, {
      onSuccess: () => {
        setLocation(`/session/${s.planId}`);
      },
      onError: () => {
        toast({ title: "Failed to start workout", variant: "destructive" });
      },
    });
  };

  const handleCancelScheduled = () => {
    if (!cancelScheduledTarget) return;
    cancel.mutate(cancelScheduledTarget.id, {
      onSuccess: () => {
        toast({ title: "Scheduled workout removed" });
        setCancelScheduledTarget(null);
      },
      onError: () => {
        toast({ title: "Failed to remove", variant: "destructive" });
        setCancelScheduledTarget(null);
      },
    });
  };

  const today = startOfDay(new Date());

  return (
    <Layout
      title="My Plans"
      action={
        isTrainer ? (
          <Link href="/plans/new">
            <Button size="icon" variant="ghost">
              <Plus className="w-6 h-6 text-primary" />
            </Button>
          </Link>
        ) : undefined
      }
    >
      <div className="p-4 pb-20 relative">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "scheduled" | "unscheduled")}>
          <TabsList className="grid grid-cols-2 w-full h-11 mb-4">
            <TabsTrigger value="scheduled" className="text-sm font-semibold">
              Scheduled
              {scheduled && scheduled.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-bold">
                  {scheduled.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unscheduled" className="text-sm font-semibold">
              Unscheduled
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="mt-0">
            <div
              className="bg-card rounded-2xl card-shadow p-3 mb-4 select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold font-display">
                  {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </span>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const count = sessionsByDay.get(key)?.length ?? 0;
                  const isSelected = isSameDay(day, selectedDay);
                  const isToday = isSameDay(day, today);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(startOfDay(day))}
                      aria-pressed={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${format(day, "EEEE, MMMM d, yyyy")}${count > 0 ? `, ${count} scheduled` : ""}`}
                      className={cn(
                        "flex flex-col items-center justify-center py-2 rounded-xl transition-all relative",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isToday
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {format(day, "EEE")}
                      </span>
                      <span className="text-base font-bold leading-tight mt-0.5">
                        {format(day, "d")}
                      </span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-primary"
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {scheduledLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : selectedDaySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <CalendarClock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold mb-1">Nothing scheduled</h3>
                <p className="text-sm text-muted-foreground">
                  No workouts on {format(selectedDay, "EEE, MMM d")}.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {selectedDaySessions.map((session) => {
                  const date = session.scheduledFor ? new Date(session.scheduledFor) : null;
                  const isPast = date ? isBefore(startOfDay(date), today) : false;
                  const isReady = date ? !isBefore(today, startOfDay(date)) : false;
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "bg-card rounded-2xl card-shadow p-4 relative overflow-hidden",
                        isPast && "opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-bold text-base leading-tight truncate flex-1 min-w-0">
                          {session.planName}
                        </h3>
                        {isPast && (
                          <span className="text-[10px] font-semibold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded flex-shrink-0 ml-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Missed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mb-3">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {date ? format(date, "EEE, MMM d, yyyy") : "\u2014"}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartScheduled(session)}
                          disabled={activateScheduled.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {isReady ? "Start now" : "Start early"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelScheduledTarget(session)}
                          className="inline-flex items-center justify-center bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm font-semibold hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="Cancel scheduled"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="unscheduled" className="mt-0">
            {isLoading || scheduledLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : unscheduledPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                  <ScrollText className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {plans && plans.length === 0 ? "No workout plans" : "All plans scheduled"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {plans && plans.length === 0
                    ? isTrainer
                      ? "Create your first workout plan to start tracking your progress."
                      : "No plans have been assigned to you yet."
                    : "Every plan has an upcoming scheduled session."}
                </p>
                {isTrainer && plans && plans.length === 0 && (
                  <Link href="/plans/new" className="w-full sm:w-auto">
                    <Button className="w-full">Create Plan</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {unscheduledPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`bg-card rounded-2xl p-5 card-shadow-hover card-shadow relative cursor-pointer ${
                      activeMenuId === plan.id ? "z-40" : ""
                    }`}
                    onClick={() => setLocation(`/plans/${plan.id}`)}
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg leading-tight mb-1">{plan.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(plan.createdAt), "MMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <LayoutList className="w-3.5 h-3.5" />
                            {plan.setCount} {plan.setCount === 1 ? "set" : "sets"}
                          </span>
                        </div>
                      </div>

                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() =>
                            setActiveMenuId(activeMenuId === plan.id ? null : plan.id)
                          }
                          className="p-1.5 -mr-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                          aria-label="Plan options"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        <AnimatePresence>
                          {activeMenuId === plan.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveMenuId(null)}
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-border/50 overflow-hidden z-50 origin-top-right"
                              >
                                {isTrainer && (
                                  <button
                                    onClick={() => {
                                      setLocation(`/plans/${plan.id}/edit`);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" /> Edit
                                  </button>
                                )}
                                {isTrainer && (
                                  <button
                                    onClick={() => {
                                      setLocation(`/log-past/${plan.id}`);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors border-t border-border/50"
                                  >
                                    <ClipboardList className="w-4 h-4" /> Log Past Workout
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setScheduleTarget({ id: plan.id, name: plan.name });
                                    setScheduleDate(format(new Date(), "yyyy-MM-dd"));
                                    setActiveMenuId(null);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors",
                                    isTrainer && "border-t border-border/50"
                                  )}
                                >
                                  <CalendarClock className="w-4 h-4" /> Schedule
                                </button>
                                {isTrainer && (
                                  <button
                                    onClick={() => handleDelete(plan.id)}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-destructive/10 text-destructive transition-colors border-t border-border/50"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </button>
                                )}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2 shadow-none border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/session/${plan.id}`);
                        }}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start Workout
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Modal
        isOpen={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        title="Schedule Workout"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Schedule <span className="font-semibold text-foreground">{scheduleTarget?.name}</span> for a future date.
          </p>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Date</label>
            <input
              type="date"
              value={scheduleDate}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setScheduleTarget(null)}
              disabled={schedule.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSchedule}
              isLoading={schedule.isPending}
            >
              Schedule
            </Button>
          </div>
        </div>
      </Modal>

      <AlertDialog
        open={!!cancelScheduledTarget}
        onOpenChange={(open) => !open && setCancelScheduledTarget(null)}
      >
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove scheduled workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the scheduled workout
              {cancelScheduledTarget?.planName ? ` (${cancelScheduledTarget.planName})` : ""}.
              You can always schedule it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelScheduled}
              disabled={cancel.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancel.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
