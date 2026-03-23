import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { usePlan } from "@/hooks/use-plans";
import { useUserContext } from "@/contexts/UserContext";
import { Play, Edit2, Dumbbell, Timer, Repeat } from "lucide-react";

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

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);
  const [, setLocation] = useLocation();
  const { data: plan, isLoading } = usePlan(planId);
  const { isTrainer } = useUserContext();

  if (isLoading) {
    return (
      <Layout title="Plan" backTo="/">
        <div className="p-8 flex justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout title="Plan" backTo="/">
        <div className="p-8 text-center text-muted-foreground">Plan not found</div>
      </Layout>
    );
  }

  const sortedSets = [...plan.sets].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Layout
      title={plan.name}
      backTo="/"
      action={
        isTrainer ? (
          <button
            onClick={() => setLocation(`/plans/${planId}/edit`)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Edit2 className="w-5 h-5 text-primary" />
          </button>
        ) : undefined
      }
    >
      <div className="p-4 space-y-4 pb-32">
        {sortedSets.map((set, i) => {
          const sortedExercises = [...set.exercises].sort((a, b) => a.orderIndex - b.orderIndex);
          return (
            <div key={set.id} className="bg-card rounded-2xl card-shadow overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm bg-background px-2.5 py-1 rounded-md border border-border/50 shadow-sm">
                    Set {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg capitalize">
                    {set.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5" />
                    {set.rounds} {set.rounds === 1 ? "round" : "rounds"}
                  </span>
                  {set.restSeconds != null && (
                    <span className="flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" />
                      {set.restSeconds}s rest
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-2">
                {sortedExercises.map((ex) => (
                  <div key={ex.id} className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Dumbbell className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{ex.exerciseName}</p>
                      <p className="text-xs text-muted-foreground">
                        Target: {ex.targetValue} {getMeasurementLabel(ex.exerciseMeasurementType)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40 max-w-md mx-auto">
        <Button
          className="w-full h-14 text-lg shadow-xl shadow-primary/20 gap-2"
          onClick={() => setLocation(`/session/${planId}`)}
        >
          <Play className="w-5 h-5 fill-current" />
          Start Workout
        </Button>
      </div>
    </Layout>
  );
}
