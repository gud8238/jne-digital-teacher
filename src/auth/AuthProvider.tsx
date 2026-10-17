import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { apiRequest, ApiError } from "../lib/api";
import { validateMe, type Me } from "../domain/badges";
type Auth = {
  me: Me | null;
  loading: boolean;
  error: string;
  login: (neisNumber: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const epoch = useRef(0);
  async function refresh() {
    const current = ++epoch.current;
    setLoading(true);
    setError("");
    try {
      const data = validateMe(await apiRequest("me"));
      if (current === epoch.current) setMe(data);
    } catch (e) {
      if (current === epoch.current) {
        setMe(null);
        if (!(e instanceof ApiError && e.status === 401))
          setError(e instanceof Error ? e.message : "연결을 확인해 주세요.");
      }
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    if (!me) return;
    function expire() {
      epoch.current++;
      setMe(null);
      setLoading(false);
      setError("");
    }
    function revalidate() {
      if (document.hidden) return;
      if (me!.sessionExpiresAt <= Date.now()) expire();
      else void refresh();
    }
    const timer = window.setTimeout(
      expire,
      Math.max(0, me.sessionExpiresAt - Date.now()),
    );
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [me]);
  async function login(neisNumber: string, name: string) {
    const current = ++epoch.current;
    setMe(null);
    setError("");
    try {
      await apiRequest("login", {
        method: "POST",
        body: JSON.stringify({ neisNumber, name }),
      });
      const data = validateMe(await apiRequest("me"));
      if (current === epoch.current) setMe(data);
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }
  async function logout() {
    await apiRequest("logout", { method: "POST" });
    epoch.current++;
    setMe(null);
    setError("");
    setLoading(false);
  }
  return (
    <AuthContext.Provider
      value={{ me, loading, error, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider가 필요합니다.");
  return value;
}
