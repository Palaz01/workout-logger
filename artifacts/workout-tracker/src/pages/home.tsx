import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { usePlans, usePlanMutations } from "@/hooks/use-plans";
import { useUserContext } from "@/contexts/UserContext";
import { Plus, Play, MoreVertical, Edit2, Trash2, Calendar, LayoutList, ClipboardList } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function HomePage() {
  const { data: plans, isLoading } = usePlans();
  const { deletePlan } = usePlanMutations();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isTrainer } = useUserContext();
  
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

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
            <img 
              src={`${import.meta.env.BASE_URL}images/empty-plans.png`} 
              alt="No plans" 
              className="w-48 h-48 object-contain mb-6 drop-shadow-xl"
            />
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

                <Button 
                  className="w-full gap-2 shadow-none border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                  onClick={(e) => { e.stopPropagation(); setLocation(`/session/${plan.id}`); }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Workout
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
