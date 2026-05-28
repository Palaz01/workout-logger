import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { usePlans, usePlanMutations } from "@/hooks/use-plans";
import { useSessionMutations } from "@/hooks/use-sessions";
import { useUserContext } from "@/contexts/UserContext";
import { Plus, Play, MoreVertical, Edit2, Trash2, Calendar, LayoutList, ClipboardList, ScrollText, CalendarClock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";

export default function HomePage() {
  const { data: plans, isLoading } = usePlans();
  const { deletePlan } = usePlanMutations();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isTrainer } = useUserContext();
  const { schedule } = useSessionMutations();

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<{ id: number; name: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));

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
      <div className="p-4 space-y-4 relative pb-20">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : plans?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
              <ScrollText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No workout plans</h3>
            <p className="text-muted-foreground mb-6">
              {isTrainer
                ? "Create your first workout plan to start tracking your progress."
                : "No plans have been assigned to you yet."}
            </p>
            {isTrainer && (
              <Link href="/plans/new" className="w-full sm:w-auto">
                <Button className="w-full">Create Plan</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {plans?.map((plan) => (
              <div 
                key={plan.id} 
                className={`bg-card rounded-2xl p-5 card-shadow-hover card-shadow relative cursor-pointer ${activeMenuId === plan.id ? 'z-40' : ''}`}
                onClick={() => setLocation(`/plans/${plan.id}`)}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-1">{plan.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <LayoutList className="w-3.5 h-3.5" />
                        {plan.setCount} {plan.setCount === 1 ? 'set' : 'sets'}
                      </span>
                    </div>
                  </div>
                  
                  {isTrainer && (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === plan.id ? null : plan.id)}
                        className="p-1.5 -mr-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      <AnimatePresence>
                        {activeMenuId === plan.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-border/50 overflow-hidden z-50 origin-top-right"
                            >
                              <button 
                                onClick={() => { setLocation(`/plans/${plan.id}/edit`); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors"
                              >
                                <Edit2 className="w-4 h-4" /> Edit
                              </button>
                              <button 
                                onClick={() => { setLocation(`/log-past/${plan.id}`); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors border-t border-border/50"
                              >
                                <ClipboardList className="w-4 h-4" /> Log Past Workout
                              </button>
                              <button
                                onClick={() => {
                                  setScheduleTarget({ id: plan.id, name: plan.name });
                                  setScheduleDate(format(new Date(), "yyyy-MM-dd"));
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors border-t border-border/50"
                              >
                                <CalendarClock className="w-4 h-4" /> Schedule
                              </button>
                              <button 
                                onClick={() => handleDelete(plan.id)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-destructive/10 text-destructive transition-colors border-t border-border/50"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2 shadow-none border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                    onClick={(e) => { e.stopPropagation(); setLocation(`/session/${plan.id}`); }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Workout
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Schedule workout"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScheduleTarget({ id: plan.id, name: plan.name });
                      setScheduleDate(format(new Date(), "yyyy-MM-dd"));
                    }}
                  >
                    <CalendarClock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
    </Layout>
  );
}
