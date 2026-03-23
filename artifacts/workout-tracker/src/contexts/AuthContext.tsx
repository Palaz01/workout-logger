import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@workspace/api-client-react";

interface RegisterResponse {
  message: string;
  email: string;
}

interface AuthContextType {
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; username: string; password: string; organizationName: string }) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  setAuthUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => ({ message: "", email: "" }),
  logout: async () => {},
  setAuthUser: () => {},
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as Error & { status?: number; email?: string };
    err.status = res.status;
    if (data?.email) err.email = data.email;
    throw err;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((user) => setAuthUser(user))
      .catch(() => setAuthUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (loginStr: string, password: string) => {
    queryClient.clear();
    const user = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: loginStr, password }),
    });
    setAuthUser(user);
  }, [queryClient]);

  const register = useCallback(async (data: { name: string; email: string; username: string; password: string; organizationName: string }): Promise<RegisterResponse> => {
    queryClient.clear();
    const response = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response as RegisterResponse;
  }, [queryClient]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    queryClient.clear();
    setAuthUser(null);
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        authUser,
        isAuthenticated: !!authUser,
        isLoading,
        login,
        register,
        logout,
        setAuthUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
