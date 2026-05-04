import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "GET", credentials: "include" });
    } catch {
      // ignore network errors — clear session anyway
    } finally {
      queryClient.clear();
      window.location.href = "/";
    }
  };

  return {
    user: user ?? undefined,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
