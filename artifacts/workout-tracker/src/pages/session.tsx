import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { usePlan } from "@/hooks/use-plans";
import { useSessionMutations, useLastSession, useActiveSession } from "@/hooks/use-sessions";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Dumbbell,
  History,
  Trophy,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlanDetail, SessionLogEntry } from "@workspace/api-client-react";

interface Step {
  type: "exercise" | "set-summary" | "set-note";
  setIndex: number;
  setId: number;
  setType: string;
  exerciseIndex: number;
  exerciseId: number;
  exerciseName: string;
  measurementType: string;
  targetValue: string;
  roundNumber: number;
  totalRounds: number;
  totalSets: number;
  restSeconds: number | null;
  exerciseNames: string[];
}

function buildSteps(plan: PlanDetail): Step[] {
  const steps: Step[] = [];
  const sortedSets = [...plan.sets].sort((a, b) => a.orderIndex - b.orderIndex);

  sortedSets.forEach((set, setIndex) => {
    const sortedExercises = [...set.exercises].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );
    const exerciseNames = sortedExercises.map((e) => e.exerciseName);

    steps.push({
      type: "set-summary",
      setIndex: setIndex + 1,
      setId: set.id,
      setType: set.type,
      exerciseIndex: 0,
      exerciseId: 0,
      exerciseName: "",
      measurementType: "",
      targetValue: "",
      roundNumber: 0,
      totalRounds: set.rounds,
      totalSets: sortedSets.length,
      restSeconds: set.restSeconds ?? null,
      exerciseNames,
    });

    for (let round = 1; round <= set.rounds; round++) {
      sortedExercises.forEach((ex, exIndex) => {
        steps.push({
          type: "exercise",
          setIndex: setIndex + 1,
          setId: set.id,
          setType: set.type,
          exerciseIndex: exIndex,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          measurementType: ex.exerciseMeasurementType,
          targetValue: ex.targetValue,
          roundNumber: round,
          totalRounds: set.rounds,
          totalSets: sortedSets.length,
          restSeconds: set.restSeconds ?? null,
          exerciseNames,
        });
      });
    }

    steps.push({
      type: "set-note",
      setIndex: setIndex + 1,
      setId: set.id,
      setType: set.type,
      exerciseIndex: 0,
      exerciseId: 0,
      exerciseName: "",
      measurementType: "",
      targetValue: "",
      roundNumber: 0,
      totalRounds: set.rounds,
      totalSets: sortedSets.length,
      restSeconds: null,
      exerciseNames,
    });
  });

  return steps;
}

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

function getStorageKey(planId: number) {
  return `session-state-${planId}`;
}

interface PersistedSessionState {
  sessionId: number;
  stepIndex: number;
  logValues: Record<string, { weight: string; value: string }>;
}

function saveSessionState(planId: number, state: PersistedSessionState) {
  try {
    localStorage.setItem(getStorageKey(planId), JSON.stringify(state));
  } catch {}
}

function loadSessionState(planId: number): PersistedSessionState | null {
  try {
    const raw = localStorage.getItem(getStorageKey(planId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSessionState(planId: number) {
  try {
    localStorage.removeItem(getStorageKey(planId));
  } catch {}
}

export default function SessionPage() {
  const params = useParams<{ planId: string }>();
  const planId = Number(params.planId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: plan, isLoading: planLoading } = usePlan(planId);
  const { data: lastSessionData } = useLastSession(planId);
  const { data: activeSessionData, isLoading: activeLoading } = useActiveSession(planId);
  const { start, logEntry, complete, cancel, saveSetNote } = useSessionMutations();
  const keyboardHeight = useKeyboardHeight();

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [logValues, setLogValues] = useState<
    Record<string, { weight: string; value: string }>
  >({});
  const [setNoteValues, setSetNoteValues] = useState<Record<number, string>>({});
  const [showLastStats, setShowLastStats] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [direction, setDirection] = useState(1);
  const [initialized, setInitialized] = useState(false);

  const steps = useMemo(() => (plan ? buildSteps(plan) : []), [plan]);
  const currentStep = steps[currentStepIndex];
  const exerciseStepCount = useMemo(() => steps.filter(s => s.type === "exercise").length, [steps]);

  const stepKey = useCallback(
    (step: Step) =>
      `${step.setId}-${step.exerciseId}-${step.roundNumber}`,
    []
  );

  useEffect(() => {
    if (!plan || activeLoading || initialized || isCompleted) return;

    const persisted = loadSessionState(planId);

    if (activeSessionData?.session) {
      const existing = activeSessionData.session;
      setSessionId(existing.id);
      setStartTime(new Date(existing.startedAt));

      const restoredValues: Record<string, { weight: string; value: string }> = {};
      for (const log of existing.logs) {
        const k = `${log.planSetId}-${log.exerciseId}-${log.roundNumber}`;
        restoredValues[k] = {
          weight: log.weight != null ? String(log.weight) : "",
          value: log.value != null ? String(log.value) : "",
        };
      }

      if (persisted && persisted.sessionId === existing.id) {
        const merged = { ...restoredValues, ...persisted.logValues };
        setLogValues(merged);
        const safeIndex = Math.min(persisted.stepIndex, steps.length - 1);
        setCurrentStepIndex(Math.max(0, safeIndex));
      } else {
        setLogValues(restoredValues);
      }

      setInitialized(true);
      return;
    }

    start.mutate(planId, {
      onSuccess: (data) => {
        setSessionId(data.id);
        setStartTime(new Date());
        clearSessionState(planId);
        setInitialized(true);
      },
      onError: () => {
        toast({ title: "Failed to start session", variant: "destructive" });
        setLocation("/");
      },
    });
  }, [plan, planId, activeSessionData, activeLoading, initialized, isCompleted, steps.length]);

  useEffect(() => {
    if (sessionId && initialized && !isCompleted) {
      saveSessionState(planId, {
        sessionId,
        stepIndex: currentStepIndex,
        logValues,
      });
    }
  }, [sessionId, currentStepIndex, logValues, initialized, isCompleted, planId]);

  const saveCurrentStep = useCallback(() => {
    if (!sessionId || !currentStep || currentStep.type !== "exercise") return;
    const key = stepKey(currentStep);
    const vals = logValues[key];
    const weight = vals?.weight ? parseFloat(vals.weight) : null;
    const value = vals?.value ? parseFloat(vals.value) : null;

    if (weight !== null || value !== null) {
      logEntry.mutate({
        sessionId,
        planSetId: currentStep.setId,
        exerciseId: currentStep.exerciseId,
        roundNumber: currentStep.roundNumber,
        weight,
        value,
      });
    }
  }, [sessionId, currentStep, logValues, stepKey, logEntry]);

  const goNext = () => {
    saveCurrentStep();
    if (currentStepIndex < steps.length - 1) {
      setDirection(1);
      setCurrentStepIndex((i) => i + 1);
    } else {
      setShowFinishConfirm(true);
    }
  };

  const goPrev = () => {
    saveCurrentStep();
    if (currentStepIndex > 0) {
      setDirection(-1);
      setCurrentStepIndex((i) => i - 1);
    }
  };

  const handleFinish = () => {
    saveCurrentStep();
    if (!sessionId) return;
    complete.mutate(sessionId, {
      onSuccess: () => {
        setIsCompleted(true);
        setShowFinishConfirm(false);
        clearSessionState(planId);
      },
      onError: () => {
        toast({ title: "Failed to complete session", variant: "destructive" });
      },
    });
  };

  const handleCancel = () => {
    if (!sessionId) {
      setLocation("/");
      return;
    }
    setShowCancelConfirm(true);
  };

  const confirmCancel = () => {
    if (!sessionId) return;
    cancel.mutate(sessionId, {
      onSuccess: () => {
        clearSessionState(planId);
        setShowCancelConfirm(false);
        setLocation("/");
      },
    });
  };

  const updateValue = (field: "weight" | "value", val: string) => {
    if (!currentStep) return;
    const key = stepKey(currentStep);
    setLogValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const lastLogs = lastSessionData?.session?.logs ?? [];

  interface GroupedSetExercise {
    exerciseId: number;
    exerciseName: string;
    measurementType: string;
    rounds: SessionLogEntry[];
  }

  const getLastStatsForSet = (setId: number): GroupedSetExercise[] => {
    const currentSet = plan?.sets.find((s) => s.id === setId);
    if (!currentSet) return [];

    const currentExercises = [...currentSet.exercises].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );

    return currentExercises.map((ex) => {
      const exerciseLogs = lastLogs.filter((l) => l.exerciseId === ex.exerciseId);
      const sorted = [...exerciseLogs].sort((a, b) => a.roundNumber - b.roundNumber);
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        measurementType: ex.exerciseMeasurementType,
        rounds: sorted,
      };
    });
  };

  if (planLoading || activeLoading || start.isPending) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center max-w-md mx-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground font-medium">
            Starting workout...
          </p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const duration = startTime
      ? Math.floor((Date.now() - startTime.getTime()) / 1000)
      : 0;
    const minutes = Math.floor(duration / 60);
    const completedSteps = Object.keys(logValues).filter((k) => {
      const v = logValues[k];
      return v.weight || v.value;
    }).length;

    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center max-w-md mx-auto px-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15, delay: 0.1 }}
          className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
        >
          <Trophy className="w-12 h-12 text-green-600" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold mb-2">Workout Complete!</h1>
          <p className="text-muted-foreground mb-8">{plan?.name}</p>

          <div className="grid grid-cols-3 gap-4 mb-10 w-full">
            <div className="bg-card rounded-2xl p-4 card-shadow text-center">
              <p className="text-2xl font-bold text-primary">{exerciseStepCount}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Total Steps
              </p>
            </div>
            <div className="bg-card rounded-2xl p-4 card-shadow text-center">
              <p className="text-2xl font-bold text-primary">
                {completedSteps}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Logged
              </p>
            </div>
            <div className="bg-card rounded-2xl p-4 card-shadow text-center">
              <p className="text-2xl font-bold text-primary">{minutes}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Minutes
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => setLocation("/")}>
            Back to Plans
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!currentStep || !plan) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center max-w-md mx-auto">
        <p className="text-muted-foreground">No steps found in this plan.</p>
      </div>
    );
  }

  const currentExerciseIndex = steps.slice(0, currentStepIndex + 1).filter(s => s.type === "exercise").length;
  const progress = (currentExerciseIndex / exerciseStepCount) * 100;

  if (currentStep.type === "set-summary") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto" style={{ zIndex: 1 }}>
        <header className="flex-shrink-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleCancel}
              className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold truncate max-w-[60%]">
              {plan.name}
            </h1>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              Set {currentStep.setIndex}/{currentStep.totalSets}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto" style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStepIndex}
              custom={direction}
              initial={{ x: direction * 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -50, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Dumbbell className="w-8 h-8 text-primary" />
              </div>

              <h2 className="text-2xl font-bold mb-2">
                Set {currentStep.setIndex} of {currentStep.totalSets}
              </h2>
              <span className="inline-block bg-primary/10 text-primary text-sm font-semibold px-3 py-1 rounded-lg capitalize mb-6">
                {currentStep.setType}
              </span>

              <div className="bg-card rounded-2xl p-5 card-shadow mb-4 text-left">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Exercises</p>
                <div className="space-y-2">
                  {currentStep.exerciseNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm">{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-2xl p-4 card-shadow text-center">
                  <p className="text-2xl font-bold text-primary">{currentStep.totalRounds}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Rounds</p>
                </div>
                {currentStep.restSeconds != null && (
                  <div className="bg-card rounded-2xl p-4 card-shadow text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Timer className="w-4 h-4 text-primary" />
                      <p className="text-2xl font-bold text-primary">{currentStep.restSeconds}</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Rest (sec)</p>
                  </div>
                )}
              </div>

              {lastSessionData?.session && (
                <button
                  onClick={() => setShowLastStats(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <History className="w-4 h-4" />
                  Last Stats
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50 px-4 py-4 pb-safe">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={goPrev}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={goNext}
            >
              Start Set
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </div>

        <Modal
          isOpen={showCancelConfirm}
          onClose={() => setShowCancelConfirm(false)}
          title="Cancel Workout?"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground pt-2">
                Your logged data for this session will be lost. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Going
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmCancel}
                isLoading={cancel.isPending}
              >
                Cancel Workout
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showLastStats}
          onClose={() => setShowLastStats(false)}
          title={`Last: Set ${currentStep.setIndex}`}
        >
          <div className="space-y-4">
            {getLastStatsForSet(currentStep.setId).map((group) => (
              <div key={group.exerciseId} className="bg-muted/30 rounded-2xl overflow-hidden border border-border/50">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm">{group.exerciseName}</h3>
                </div>
                {group.rounds.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Round</span>
                      <span className="text-center">Weight</span>
                      <span className="text-right">{getMeasurementLabel(group.measurementType)}</span>
                    </div>
                    {group.rounds.map((round) => (
                      <div key={round.id} className="grid grid-cols-3 px-4 py-3 items-center">
                        <span className="text-sm font-medium text-muted-foreground">#{round.roundNumber}</span>
                        <span className="text-sm font-bold text-center">{round.weight != null ? `${round.weight} kg` : "—"}</span>
                        <span className="text-sm font-bold text-primary text-right">{round.value != null ? `${round.value} ${getMeasurementLabel(group.measurementType)}` : "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                    No data
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      </div>
    );
  }

  if (currentStep.type === "set-note" && !showFinishConfirm && !showCancelConfirm) {
    const noteVal = setNoteValues[currentStep.setId] ?? "";
    const handleSaveNote = () => {
      if (sessionId && noteVal.trim()) {
        saveSetNote.mutate({
          sessionId,
          planSetId: currentStep.setId,
          note: noteVal.trim(),
        });
      }
      goNext();
    };
    return (
      <div className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto" style={{ zIndex: 1 }}>
        <header className="flex-shrink-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleCancel}
              className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold truncate max-w-[60%]">
              {plan.name}
            </h1>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              Set {currentStep.setIndex}/{currentStep.totalSets}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </header>

        <main className="flex-1 flex flex-col p-6 overflow-y-auto" style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold font-display mb-1">Set {currentStep.setIndex} Note</h2>
            <p className="text-sm text-muted-foreground mb-6">Add an optional note for this set</p>

            <textarea
              value={noteVal}
              onChange={(e) => setSetNoteValues(prev => ({ ...prev, [currentStep.setId]: e.target.value }))}
              placeholder="e.g. Felt heavy, increase weight next time..."
              className="w-full h-32 px-4 py-3 rounded-xl border-2 border-border bg-background text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              autoFocus
            />
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={goNext}
            >
              Skip
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveNote}
              disabled={!noteVal.trim()}
            >
              Save & Continue
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const key = stepKey(currentStep);
  const currentValues = logValues[key] ?? { weight: "", value: "" };

  return (
    <div className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto" style={{ zIndex: 1 }}>
      <header className="flex-shrink-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={handleCancel}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold truncate max-w-[60%]">
            {plan.name}
          </h1>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            Round {currentStep.roundNumber}/{currentStep.totalRounds}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 overflow-y-auto" style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}>
        <div className="flex items-center gap-2 mb-6 text-xs font-semibold text-muted-foreground">
          <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
            Set {currentStep.setIndex}/{currentStep.totalSets}
          </span>
          <span className="bg-muted px-2.5 py-1 rounded-lg capitalize">
            {currentStep.setType}
          </span>
          <span className="bg-muted px-2.5 py-1 rounded-lg">
            Round {currentStep.roundNumber}/{currentStep.totalRounds}
          </span>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStepIndex}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">
                  {currentStep.exerciseName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Target: {currentStep.targetValue}{" "}
                  {getMeasurementLabel(currentStep.measurementType)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Weight (kg)"
                type="number"
                min={0}
                step={0.5}
                placeholder="0"
                value={currentValues.weight}
                onChange={(e) => updateValue("weight", e.target.value)}
                className="text-center text-lg font-bold"
              />
              <Input
                label={`Value (${getMeasurementLabel(currentStep.measurementType)})`}
                type="number"
                min={0}
                step={1}
                placeholder={String(currentStep.targetValue)}
                value={currentValues.value}
                onChange={(e) => updateValue("value", e.target.value)}
                className="text-center text-lg font-bold"
              />
            </div>

          </motion.div>
        </AnimatePresence>
      </main>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50 px-4 py-4 pb-safe">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={goPrev}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={goNext}
          >
            {currentStepIndex === steps.length - 1 ? (
              <>
                <Check className="w-5 h-5 mr-1" />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        title="Finish Workout?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to finish this workout? Make sure you've logged all your sets.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowFinishConfirm(false)}
            >
              Continue
            </Button>
            <Button
              className="flex-1"
              onClick={handleFinish}
              isLoading={complete.isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Finish
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel Workout?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              Your logged data for this session will be lost. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCancelConfirm(false)}
            >
              Keep Going
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmCancel}
              isLoading={cancel.isPending}
            >
              Cancel Workout
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
