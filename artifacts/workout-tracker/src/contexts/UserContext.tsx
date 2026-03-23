import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useListUsers } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";

interface UserContextType {
  users: User[];
  activeUser: User | null;
  setActiveUser: (user: User) => void;
  trainerUser: User | null;
  role: "trainer" | "client";
  isTrainer: boolean;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType>({
  users: [],
  activeUser: null,
  setActiveUser: () => {},
  trainerUser: null,
  role: "trainer",
  isTrainer: true,
  isLoading: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const { data: users = [], isLoading } = useListUsers();
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const isTrainer = authUser?.role === "trainer";
  const role = authUser?.role ?? "trainer";

  const trainerUser = useMemo(() => users.find((u) => u.role === "trainer") ?? null, [users]);

  useEffect(() => {
    if (users.length === 0) return;

    if (!isTrainer) {
      setActiveUserId(authUser?.id ?? null);
      return;
    }

    if (activeUserId === null) {
      setActiveUserId(trainerUser?.id ?? users[0].id);
    } else if (!users.some((u) => u.id === activeUserId)) {
      setActiveUserId(trainerUser?.id ?? users[0].id);
    }
  }, [users, activeUserId, trainerUser, isTrainer, authUser]);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) ?? null,
    [users, activeUserId]
  );

  const setActiveUser = (user: User) => {
    if (isTrainer) {
      setActiveUserId(user.id);
    }
  };

  return (
    <UserContext.Provider
      value={{
        users,
        activeUser,
        setActiveUser,
        trainerUser,
        role,
        isTrainer,
        isLoading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  return useContext(UserContext);
}
