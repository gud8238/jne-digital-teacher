import { useAuth } from "../auth/AuthProvider";
// One page snapshot supplies both badge definitions and personal status.
export function useBadges() {
  const { definitions, loading, error, refresh } = useAuth();
  return { definitions, loading, error, refresh };
}
