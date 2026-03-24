import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { useExercises, useExercisesMutations } from "@/hooks/use-exercises";
import { useUserContext } from "@/contexts/UserContext";
import { Plus, Edit2, Trash2, Activity, MoreVertical, Dumbbell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Exercise, ExerciseMeasurementType } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises();
  const { createExercise, updateExercise, deleteExercise, isCreating, isUpdating } = useExercisesMutations();
  const { toast } = useToast();
  const { isTrainer } = useUserContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  
  const [name, setName] = useState("");
  const [measurementType, setMeasurementType] = useState<ExerciseMeasurementType>("reps");
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const openNewModal = () => {
    setEditingEx(null);
    setName("");
    setMeasurementType("reps");
    setIsModalOpen(true);
  };

  const openEditModal = (ex: Exercise) => {
    setEditingEx(ex);
    setName(ex.name);
    setMeasurementType(ex.measurementType);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingEx) {
        await updateExercise({ id: editingEx.id, data: { name, measurementType } });
        toast({ title: "Exercise updated" });
      } else {
        await createExercise({ data: { name, measurementType } });
        toast({ title: "Exercise created" });
      }
      setIsModalOpen(false);
    } catch (error) {
      toast({ title: "Error saving exercise", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this exercise?")) {
      try {
        await deleteExercise({ id });
        toast({ title: "Exercise deleted" });
      } catch (error) {
        toast({ title: "Error deleting exercise", variant: "destructive" });
      }
    }
  };

  return (
    <Layout 
      title="Exercises" 
      action={
        isTrainer ? (
          <Button size="icon" variant="ghost" onClick={openNewModal}>
            <Plus className="w-6 h-6 text-primary" />
          </Button>
        ) : undefined
      }
    >
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : exercises?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Dumbbell className="w-24 h-24 text-muted-foreground/30 mb-6" />
            <h3 className="text-xl font-bold mb-2">No exercises yet</h3>
            <p className="text-muted-foreground mb-6">
              {isTrainer
                ? "Build your library of exercises to use in workout plans."
                : "No exercises have been added yet."}
            </p>
            {isTrainer && (
              <Button onClick={openNewModal} className="w-full sm:w-auto">
                Create First Exercise
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {exercises?.map((ex) => (
              <div 
                key={ex.id} 
                className="bg-card rounded-2xl p-4 card-shadow flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">{ex.name}</h3>
                    <p className="text-xs font-medium text-muted-foreground capitalize mt-0.5">{ex.measurementType}</p>
                  </div>
                </div>
                {isTrainer && (
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === ex.id ? null : ex.id)}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === ex.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-border/50 overflow-hidden z-50 origin-top-right"
                          >
                            <button
                              onClick={() => { openEditModal(ex); setActiveMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors"
                            >
                              <Edit2 className="w-4 h-4" /> Edit
                            </button>
                            <button
                              onClick={() => { handleDelete(ex.id); setActiveMenuId(null); }}
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
            ))}
          </div>
        )}
      </div>

      {isTrainer && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingEx ? "Edit Exercise" : "New Exercise"}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input 
              label="Exercise Name" 
              placeholder="e.g. Bench Press" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Select
              label="Measurement Type"
              value={measurementType}
              onChange={(e) => setMeasurementType(e.target.value as ExerciseMeasurementType)}
              options={[
                { value: 'reps', label: 'Repetitions' },
                { value: 'seconds', label: 'Time (Seconds)' },
                { value: 'meters', label: 'Distance (Meters)' },
              ]}
              required
            />
            <div className="pt-2">
              <Button type="submit" className="w-full" isLoading={isCreating || isUpdating}>
                {editingEx ? "Save Changes" : "Create Exercise"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
