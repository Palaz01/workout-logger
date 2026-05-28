import {
  useListExercises,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
  useGetExerciseHistory,
  getGetExerciseHistoryQueryKey,
  getListExercisesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";

export function useExercises() {
  return useListExercises();
}

export type HistoryPeriod = "2w" | "1m" | "3m" | "all";

export function periodToSince(period: HistoryPeriod): string | undefined {
  if (period === "all") return undefined;
  const now = new Date();
  const since = new Date(now);
  if (period === "2w") since.setDate(now.getDate() - 14);
  else if (period === "1m") since.setMonth(now.getMonth() - 1);
  else if (period === "3m") since.setMonth(now.getMonth() - 3);
  return since.toISOString();
}

export function useExerciseHistory(
  exerciseId: number | null,
  period: HistoryPeriod,
  enabled = true,
) {
  const { activeUser } = useUserContext();
  const since = periodToSince(period);
  const params = activeUser
    ? { userId: activeUser.id, ...(since ? { since } : {}) }
    : { userId: 0 };
  return useGetExerciseHistory(exerciseId ?? 0, params, {
    query: {
      queryKey: getGetExerciseHistoryQueryKey(exerciseId ?? 0, params),
      enabled: enabled && !!activeUser && !!exerciseId,
    },
  });
}

export function useInvalidateExerciseHistory() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        /^\/api\/exercises\/\d+\/history$/.test(q.queryKey[0] as string),
    });
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
