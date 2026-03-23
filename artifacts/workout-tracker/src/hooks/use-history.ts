import {
  useListSessions,
  useGetSession,
  getListSessionsQueryKey,
} from "@workspace/api-client-react";
import { useUserContext } from "@/contexts/UserContext";

export function useSessionHistory() {
  const { activeUser } = useUserContext();
  const params = activeUser ? { userId: activeUser.id } : undefined;
  return useListSessions(params, {
    query: {
      queryKey: getListSessionsQueryKey(params),
      enabled: !!activeUser,
    },
  });
}

export function useSessionDetail(id: number) {
  return useGetSession(id);
}
