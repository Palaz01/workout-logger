import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { usePlan, usePlanMutations } from "@/hooks/use-plans";
import { useExercises } from "@/hooks/use-exercises";
import { useUsers } from "@/hooks/use-users";
import { useUserContext } from "@/contexts/UserContext";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Save, Layers, Globe, Check, ChevronDown, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const planSetTypeSchema = z.enum(["straight", "superset", "triset", "other", "conditioning"]);
const setExerciseSchema = z.object({
  exerciseId: z.coerce.number().min(1, "Required"),
  targetValue: z.string().min(1, "Required").regex(/^\d+(-\d+)?$/, "Use number or range (e.g. 10 or 8-12)"),
  orderIndex: z.number().default(0),
});
const planSetSchema = z.object({
  type: planSetTypeSchema,
  rounds: z.coerce.number().min(1, "Must be > 0").default(1),
  restSeconds: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().int().min(0).nullable()
  ).default(null),
  orderIndex: z.number().default(0),
  description: z.string().nullable().default(null),
  exercises: z.array(setExerciseSchema).default([]),
}).superRefine((set, ctx) => {
  if (set.type === "conditioning") {
    if (!set.description || !set.description.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Description is required",
      });
    }
  } else if (set.exercises.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exercises"],
      message: "Need at least 1 exercise",
    });
  }
});
const planSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sets: z.array(planSetSchema).min(1, "Add at least one set"),
});
type PlanFormValues = z.infer<typeof planSchema>;

export default function PlanFormPage() {
  const [, params] = useRoute("/plans/:id/edit");
  const isEdit = !!params?.id;
  const planId = isEdit ? parseInt(params.id!) : 0;
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isTrainer } = useUserContext();

  useEffect(() => {
    if (!isTrainer) {
      setLocation("/");
    }
  }, [isTrainer, setLocation]);
  
  const { data: exercises } = useExercises();
  const { data: initialPlan, isLoading: isLoadingPlan } = usePlan(planId);
  const { createPlan, updatePlan, isCreating, isUpdating } = usePlanMutations();
  const { data: users } = useUsers();

  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [assignError, setAssignError] = useState("");

  const allUsers = users ?? [];
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);

  useEffect(() => {
    if (isEdit && initialPlan) {
      setIsGlobal(initialPlan.isGlobal);
      setSelectedUserIds(initialPlan.assignedUserIds ?? []);
    }
  }, [isEdit, initialPlan]);

  const toggleUser = (userId: number) => {
    setAssignError("");
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleGlobalToggle = () => {
    setAssignError("");
    if (!isGlobal) {
      setSelectedUserIds([]);
    }
    setIsGlobal(!isGlobal);
  };

  const { control, handleSubmit, register, reset, watch, setValue } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { name: "", sets: [] }
  });

  const { fields: sets, append: appendSet, remove: removeSet, move: moveSet } = useFieldArray({
    control,
    name: "sets"
  });

  useEffect(() => {
    if (isEdit && initialPlan) {
      reset({
        name: initialPlan.name,
        sets: initialPlan.sets.map(s => ({
          type: s.type,
          rounds: s.rounds,
          restSeconds: s.restSeconds ?? null,
          orderIndex: s.orderIndex,
          description: s.description ?? null,
          exercises: s.exercises.map(e => ({
            exerciseId: e.exerciseId,
            targetValue: String(e.targetValue),
            orderIndex: e.orderIndex
          }))
        }))
      });
    } else if (!isEdit && sets.length === 0) {
      appendSet({ type: "straight", rounds: 3, restSeconds: null, orderIndex: 0, description: null, exercises: [{ exerciseId: 0, targetValue: "10", orderIndex: 0 }] });
    }
  }, [isEdit, initialPlan, reset, appendSet]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveSet(result.source.index, result.destination.index);
  };

  const onSubmit = async (data: PlanFormValues) => {
    if (!isGlobal && selectedUserIds.length === 0) {
      setAssignError("Select at least one person or choose Everyone");
      return;
    }

    const formattedData = {
      name: data.name,
      isGlobal,
      assignedUserIds: isGlobal ? [] : selectedUserIds,
      sets: data.sets.map((set, i) => ({
        type: set.type,
        rounds: set.type === "conditioning" ? 1 : set.rounds,
        restSeconds: set.restSeconds ?? null,
        orderIndex: i,
        description: set.type === "conditioning" ? (set.description?.trim() || null) : null,
        exercises: set.type === "conditioning"
          ? []
          : set.exercises.map((ex, j) => ({ exerciseId: ex.exerciseId, targetValue: ex.targetValue, orderIndex: j }))
      }))
    };

    try {
      if (isEdit) {
        await updatePlan({ id: planId, data: formattedData });
        toast({ title: "Plan updated successfully" });
      } else {
        await createPlan({ data: formattedData });
        toast({ title: "Plan created successfully" });
      }
      setLocation("/");
    } catch (e) {
      toast({ title: "Failed to save plan", variant: "destructive" });
    }
  };

  const isSaving = isCreating || isUpdating;

  if (isEdit && isLoadingPlan) {
    return <Layout title="Loading..."><div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div></Layout>;
  }

  const exerciseOptions = exercises?.map(e => ({ value: e.id, label: e.name })) || [];

  return (
    <Layout 
      title={isEdit ? "Edit Plan" : "New Plan"} 
      backTo="/"
    >
      <form id="plan-form" onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6 pb-32">
        <div className="bg-card p-5 rounded-2xl card-shadow">
          <Input 
            label="Plan Name" 
            placeholder="e.g. Push Day" 
            {...register("name")}
          />
        </div>

        <div className="bg-card p-5 rounded-2xl card-shadow space-y-3">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign to</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold",
                assignDropdownOpen ? "border-primary ring-2 ring-primary/20" : "border-border",
                assignError ? "border-destructive" : ""
              )}
            >
              <span className="flex items-center gap-2 text-foreground">
                {isGlobal ? (
                  <><Globe className="w-4 h-4 text-primary" /> Everyone</>
                ) : selectedUserIds.length > 0 ? (
                  <><Users className="w-4 h-4 text-primary" /> {selectedUserIds.length} selected</>
                ) : (
                  <span className="text-muted-foreground">Select users...</span>
                )}
              </span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", assignDropdownOpen && "rotate-180")} />
            </button>
            {assignDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAssignDropdownOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border-2 border-border shadow-lg z-50 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      handleGlobalToggle();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors border-b border-border/50",
                      isGlobal ? "bg-primary/5 text-primary" : "text-foreground hover:bg-gray-50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                      isGlobal ? "bg-primary border-primary" : "border-gray-300"
                    )}>
                      {isGlobal && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <Globe className="w-4 h-4" />
                    Everyone
                  </button>
                  {allUsers.map((user) => {
                    const selected = !isGlobal && selectedUserIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          if (isGlobal) setIsGlobal(false);
                          toggleUser(user.id);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors",
                          selected ? "bg-primary/5 text-primary" : "text-foreground hover:bg-gray-50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                          selected ? "bg-primary border-primary" : "border-gray-300"
                        )}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {user.name}
                        {user.role === "trainer" && <span className="text-xs">&#11088;</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {assignError && (
            <p className="text-xs text-destructive font-medium">{assignError}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold font-display flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Workout Sets
            </h2>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sets">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {sets.map((setField, index) => (
                    <Draggable key={setField.id} draggableId={setField.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "bg-card rounded-2xl border-2 transition-all duration-200 overflow-hidden",
                            snapshot.isDragging ? "border-primary shadow-xl shadow-primary/20 scale-[1.02] z-50 relative" : "border-border/60 card-shadow"
                          )}
                        >
                          <div className="bg-muted/50 p-3 flex items-center justify-between border-b border-border/60">
                            <div className="flex items-center gap-3">
                              <div {...provided.dragHandleProps} className="p-1 text-muted-foreground hover:text-foreground touch-none">
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <span className="font-bold text-sm bg-background px-2.5 py-1 rounded-md border border-border/50 shadow-sm">
                                Set {index + 1}
                              </span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => removeSet(index)}
                              className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <Controller
                                control={control}
                                name={`sets.${index}.type`}
                                render={({ field }) => (
                                  <Select 
                                    label="Type"
                                    options={[
                                      { value: 'straight', label: 'Straight' },
                                      { value: 'superset', label: 'Superset' },
                                      { value: 'triset', label: 'Triset' },
                                      { value: 'other', label: 'Other' },
                                      { value: 'conditioning', label: 'Conditioning' }
                                    ]}
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      const type = e.target.value;
                                      if (type === 'conditioning') {
                                        setValue(`sets.${index}.exercises`, []);
                                        setValue(`sets.${index}.rounds`, 1);
                                        return;
                                      }
                                      const currentExs = watch(`sets.${index}.exercises`);
                                      let targetCount = currentExs.length;
                                      if (type === 'straight') targetCount = 1;
                                      if (type === 'superset') targetCount = 2;
                                      if (type === 'triset') targetCount = 3;
                                      if (targetCount === 0 && type === 'other') targetCount = 1;
                                      
                                      if (targetCount > currentExs.length) {
                                        const additions = Array.from({ length: targetCount - currentExs.length }).map(() => ({ exerciseId: 0, targetValue: "10", orderIndex: 0 }));
                                        setValue(`sets.${index}.exercises`, [...currentExs, ...additions]);
                                      } else if (targetCount < currentExs.length && type !== 'other') {
                                        setValue(`sets.${index}.exercises`, currentExs.slice(0, targetCount));
                                      }
                                    }}
                                  />
                                )}
                              />
                              {watch(`sets.${index}.type`) !== 'conditioning' && (
                                <Input 
                                  type="number" 
                                  label="Rounds" 
                                  min={1}
                                  {...register(`sets.${index}.rounds`)}
                                />
                              )}
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  label="Rest"
                                  min={0}
                                  step={5}
                                  placeholder="--"
                                  {...register(`sets.${index}.restSeconds`)}
                                />
                                <span className="absolute right-3 bottom-2.5 text-xs font-semibold text-muted-foreground pointer-events-none">
                                  sec
                                </span>
                              </div>
                            </div>

                            {watch(`sets.${index}.type`) === 'conditioning' ? (
                              <div className="space-y-2 pt-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Description</label>
                                <Controller
                                  control={control}
                                  name={`sets.${index}.description`}
                                  render={({ field, fieldState }) => (
                                    <div>
                                      <textarea
                                        value={field.value ?? ""}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        placeholder="e.g. 20 min Zone 2 cardio, or AMRAP 10 min: 5 burpees + 10 squats"
                                        className="w-full min-h-24 px-4 py-3 rounded-xl border-2 border-border bg-muted/30 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                                      />
                                      {fieldState.error && (
                                        <p className="text-xs text-destructive font-medium mt-1">{fieldState.error.message}</p>
                                      )}
                                    </div>
                                  )}
                                />
                              </div>
                            ) : (
                              <div className="space-y-3 pt-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Exercises</label>
                                
                                <SetExercises 
                                  control={control} 
                                  setIndex={index} 
                                  exerciseOptions={exerciseOptions}
                                  register={register}
                                  watch={watch}
                                  exercisesData={exercises}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Button 
            type="button" 
            variant="outline" 
            className="w-full border-dashed border-2 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors h-14"
            onClick={() => appendSet({ type: "straight", rounds: 3, restSeconds: null, orderIndex: sets.length, exercises: [{ exerciseId: 0, targetValue: "10", orderIndex: 0 }] })}
          >
            <Plus className="w-5 h-5 mr-2" /> Add Next Set
          </Button>
        </div>
      </form>

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40 max-w-md mx-auto">
        <Button 
          type="submit" 
          form="plan-form" 
          className="w-full h-14 text-lg shadow-xl shadow-primary/20"
          isLoading={isSaving}
        >
          <Save className="w-5 h-5 mr-2" />
          {isEdit ? "Save Changes" : "Create Workout Plan"}
        </Button>
      </div>
    </Layout>
  );
}

interface SetExercisesProps {
  control: ReturnType<typeof useForm<PlanFormValues>>["control"];
  setIndex: number;
  exerciseOptions: { value: number; label: string }[];
  register: ReturnType<typeof useForm<PlanFormValues>>["register"];
  watch: ReturnType<typeof useForm<PlanFormValues>>["watch"];
  exercisesData: Array<{ id: number; name: string; measurementType: string }> | undefined;
}

function SetExercises({ control, setIndex, exerciseOptions, register, watch, exercisesData }: SetExercisesProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `sets.${setIndex}.exercises`
  });

  const setType = watch(`sets.${setIndex}.type`);
  const canAddMore = setType === 'other' || 
    (setType === 'straight' && fields.length < 1) ||
    (setType === 'superset' && fields.length < 2) ||
    (setType === 'triset' && fields.length < 3);

  return (
    <div className="space-y-2">
      {fields.map((field, exIndex) => {
        const selectedExId = watch(`sets.${setIndex}.exercises.${exIndex}.exerciseId`);
        const exDetail = exercisesData?.find((e) => e.id === Number(selectedExId));
        const unit = exDetail?.measurementType === 'seconds' ? 'sec' : exDetail?.measurementType === 'meters' ? 'm' : 'reps';

        return (
          <div key={field.id} className="flex gap-2 items-start relative">
            <div className="flex-1">
              <Controller
                control={control}
                name={`sets.${setIndex}.exercises.${exIndex}.exerciseId`}
                render={({ field }) => (
                  <Select 
                    options={exerciseOptions}
                    {...field}
                    className="h-11 bg-muted/30"
                  />
                )}
              />
            </div>
            <div className="w-24 relative">
              <Input 
                type="text"
                inputMode="text"
                placeholder="10"
                {...register(`sets.${setIndex}.exercises.${exIndex}.targetValue`)}
                className="h-11 pr-8 bg-muted/30 text-center font-bold"
              />
              {selectedExId > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                  {unit}
                </span>
              )}
            </div>
            {setType === 'other' && fields.length > 1 && (
              <button 
                type="button" 
                onClick={() => remove(exIndex)}
                className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
      
      {canAddMore && (
        <button 
          type="button"
          onClick={() => append({ exerciseId: 0, targetValue: "10", orderIndex: fields.length })}
          className="w-full h-10 mt-1 rounded-xl border border-dashed border-border flex items-center justify-center text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Exercise to Set
        </button>
      )}
    </div>
  );
}
