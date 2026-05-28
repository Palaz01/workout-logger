import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetSession,
  useGetLastSession,
  useGetActiveSession,
  startSession,
  updateSessionStatus,
  upsertSessionLog,
  upsertSessionSetNote,
  deleteSession,
  getGetSessionQueryKey,
  getGetLastSessionQueryKey,
  getGetActiveSessionQueryKey,
  getListSessionsQueryKey,
} from "@workspace/api-client-react";
import { useUserContext } from "@/contexts/UserContext";

export function useSession(id: number) {
  return useGetSession(id);
}

export function useLastSession(planId: number) {
  const { activeUser } = useUserContext();
  const params = activeUser ? { userId: activeUser.id } : undefined;
  return useGetLastSession(planId, params, {
    query: {
      queryKey: getGetLastSessionQueryKey(planId, params),
      enabled: !!activeUser,
    },
  });
}

export function useActiveSession(planId: number) {
  const { activeUser } = useUserContext();
  const params = activeUser ? { userId: activeUser.id } : undefined;
  return useGetActiveSession(planId, params, {
    query: {
      queryKey: getGetActiveSessionQueryKey(planId, params),
      enabled: !!activeUser,
    },
  });
}

export function useSessionMutations() {
  const queryClient = useQueryClient();
  const { activeUser } = useUserContext();

  const start = useMutation({
    mutationFn: (planId: number) => {
      if (!activeUser) throw new Error("No active user");
      return startSession({ planId, userId: activeUser.id });
    },
  });

  const schedule = useMutation({
    mutationFn: ({ planId, scheduledFor }: { planId: number; scheduledFor: Date }) => {
      if (!activeUser) throw new Error("No active user");
      return startSession({ planId, userId: activeUser.id, scheduledFor: scheduledFor.toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    },
  });

  const activateScheduled = useMutation({
    mutationFn: (sessionId: number) =>
      updateSessionStatus(sessionId, { status: "active" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(data.id) });
      queryClient.invalidateQueries({ queryKey: getGetActiveSessionQueryKey(data.planId) });
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    },
  });

  const logEntry = useMutation({
    mutationFn: ({
      sessionId,
      ...body
    }: {
      sessionId: number;
      planSetId: number;
      exerciseId: number | null;
      roundNumber: number;
      weight: number | null;
      value: number | null;
      setDescription?: string | null;
    }) => upsertSessionLog(sessionId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: getGetSessionQueryKey(variables.sessionId),
      });
    },
  });

  const complete = useMutation({
    mutationFn: (sessionId: number) =>
      updateSessionStatus(sessionId, { status: "completed" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: getGetSessionQueryKey(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: getGetLastSessionQueryKey(data.planId),
      });
      queryClient.invalidateQueries({
        queryKey: getGetActiveSessionQueryKey(data.planId),
      });
      queryClient.invalidateQueries({
        queryKey: getListSessionsQueryKey(),
      });
    },
  });

  const cancel = useMutation({
    mutationFn: (sessionId: number) =>
      updateSessionStatus(sessionId, { status: "cancelled" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: getGetSessionQueryKey(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: getGetActiveSessionQueryKey(data.planId),
      });
      if (data.deleted) {
        queryClient.invalidateQueries({
          queryKey: getListSessionsQueryKey(),
        });
      }
    },
  });

  const remove = useMutation({
    mutationFn: (sessionId: number) => deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getListSessionsQueryKey(),
      });
    },
  });

  const saveSetNote = useMutation({
    mutationFn: ({
      sessionId,
      planSetId,
      note,
    }: {
      sessionId: number;
      planSetId: number;
      note: string;
    }) => upsertSessionSetNote(sessionId, { planSetId, note }),
  });

  return { start, schedule, activateScheduled, logEntry, complete, cancel, remove, saveSetNote };
}
