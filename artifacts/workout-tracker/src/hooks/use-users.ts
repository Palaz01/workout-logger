import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useUsers() {
  return useListUsers();
}

export function useUsersMutations() {
  const queryClient = useQueryClient();

  const create = useCreateUser({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    },
  });

  const update = useUpdateUser({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    },
  });

  const remove = useDeleteUser({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    },
  });

  return {
    createUser: create.mutateAsync,
    isCreating: create.isPending,
    updateUser: update.mutateAsync,
    isUpdating: update.isPending,
    deleteUser: remove.mutateAsync,
    isDeleting: remove.isPending,
  };
}
