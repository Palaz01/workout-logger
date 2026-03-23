import { 
  useListPlans,
  useGetPlan,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  getListPlansQueryKey,
  getGetPlanQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";

export function usePlans() {
  const { activeUser } = useUserContext();
  const params = activeUser ? { userId: activeUser.id } : undefined;
  return useListPlans(params, {
    query: {
      queryKey: getListPlansQueryKey(params),
      enabled: !!activeUser,
    },
  });
}

export function usePlan(id: number) {
  return useGetPlan(id);
}

export function usePlanMutations() {
  const queryClient = useQueryClient();

  const createPlan = useCreatePlan({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() })
    }
  });

  const updatePlan = useUpdatePlan({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPlanQueryKey(variables.id) });
      }
    }
  });

  const deletePlan = useDeletePlan({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() })
    }
  });

  return {
    createPlan: createPlan.mutateAsync,
    isCreating: createPlan.isPending,
    updatePlan: updatePlan.mutateAsync,
    isUpdating: updatePlan.isPending,
    deletePlan: deletePlan.mutateAsync,
    isDeleting: deletePlan.isPending,
  };
}
