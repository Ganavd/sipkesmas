import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/lib/constants/roles";

export function useRole() {
  const { role } = useAuth();
  return {
    role,
    hasRole: (target: AppRole) => role === target,
    hasAnyRole: (targets: readonly AppRole[]) => (role ? targets.includes(role) : false),
  };
}
