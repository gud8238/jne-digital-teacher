import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiRequest } from "../lib/api";
import { validateBadges, type BadgeDefinition } from "../domain/badges";
type Data = {
  definitions: BadgeDefinition[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
const Context = createContext<Data | null>(null);
export function BadgeProvider({ children }: { children: ReactNode }) {
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDefinitions(validateBadges(await apiRequest("badges")));
    } catch (e) {
      setDefinitions([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <Context.Provider value={{ definitions, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useBadges() {
  const data = useContext(Context);
  if (!data) throw new Error("BadgeProvider가 필요합니다.");
  return data;
}
