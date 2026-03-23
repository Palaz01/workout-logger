import { 
  useListExercises, 
  useCreateExercise, 
  useUpdateExercise, 
  useDeleteExercise,
  getListExercisesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useExercises() {
  return useListExercises();
}

export function useExercisesMutations() {
  const queryClient = useQueryClient();

  const createEx = useCreateExercise({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() })
    }
  });

  const updateEx = useUpdateExercise({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() })
    }
  });

  const deleteEx = useDeleteExercise({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() })
    }
  });

  return {
    createExercise: createEx.mutateAsync,
    isCreating: createEx.isPending,
    updateExercise: updateEx.mutateAsync,
    isUpdating: updateEx.isPending,
    deleteExercise: deleteEx.mutateAsync,
    isDeleting: deleteEx.isPending,
  };
}
