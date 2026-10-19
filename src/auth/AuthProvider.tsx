import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "../lib/api";
import {
  validatePageData,
  validateMe,
  validateBadges,
  type Me,
  type BadgeDefinition,
  type PageData,
} from "../domain/badges";
type Auth = {
  me: Me | null;
  definitions: BadgeDefinition[];
  loading: boolean;
  error: string;
  login: (
    neisNumber: string,
    name: string,
    destination?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [me, setMe] = useState<Me | null>(null),
    [definitions, setDefinitions] = useState<BadgeDefinition[]>([]),
    [loadedPath, setLoadedPath] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const epoch = useRef(0);
  const authEpoch = useRef(0);
  const pending = useRef(new Map<string, Promise<PageData>>());
  const requestedPath = useRef<string | null>(null);
  const skipDestination = useRef<string | null>(null);
  const clearPersonal = useCallback(() => {
    authEpoch.current++;
    pending.current.clear();
    setMe(null);
    setLoading(false);
    setError("");
  }, []);
  const loadPage = useCallback(async (path: string) => {
    const current = ++epoch.current;
    const personalVersion = authEpoch.current;
    if (requestedPath.current !== path) pending.current.clear();
    requestedPath.current = path;
    setError("");
    // Deduplicate only in-flight requests, including StrictMode effect replay.
    // Every later page visit reads fresh sheet data, without a response cache.
    let request = pending.current.get(path);
    if (!request) {
      request = apiRequest("page", {
        method: "POST",
        body: JSON.stringify({ path }),
      }).then(validatePageData);
      pending.current.set(path, request);
    }
    try {
      const page = await request;
      if (current === epoch.current) {
        setDefinitions(page.definitions);
        if (personalVersion === authEpoch.current) setMe(page.me);
      }
    } catch (e) {
      if (current === epoch.current) {
        setMe(null);
        setError(e instanceof Error ? e.message : "연결을 확인해 주세요.");
      }
    } finally {
      if (pending.current.get(path) === request) pending.current.delete(path);
      if (current === epoch.current) {
        setLoading(false);
        setLoadedPath(path);
      }
    }
  }, []);
  const refresh = useCallback(() => loadPage(pathname), [loadPage, pathname]);
  useEffect(() => {
    if (skipDestination.current === pathname) skipDestination.current = null;
    else {
      skipDestination.current = null;
      void loadPage(pathname);
    }
    return () => {
      epoch.current++;
    };
  }, [pathname, loadPage]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "jne-badge-logout") clearPersonal();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearPersonal]);
  useEffect(() => {
    if (!me) return;
    const checkExpiry = () => {
      if (me.sessionExpiresAt <= Date.now()) clearPersonal();
    };
    const timer = window.setTimeout(
      clearPersonal,
      Math.max(0, me.sessionExpiresAt - Date.now()),
    );
    window.addEventListener("focus", checkExpiry);
    document.addEventListener("visibilitychange", checkExpiry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", checkExpiry);
      document.removeEventListener("visibilitychange", checkExpiry);
    };
  }, [me, clearPersonal]);
  async function login(
    neisNumber: string,
    name: string,
    destination = "/my-badges",
  ) {
    const current = ++epoch.current;
    const personalVersion = ++authEpoch.current;
    pending.current.clear();
    setMe(null);
    setError("");
    try {
      const result = await apiRequest<Me & { definitions: BadgeDefinition[] }>(
        "login",
        { method: "POST", body: JSON.stringify({ neisNumber, name }) },
      );
      const personal = validateMe(result),
        badges = validateBadges(result.definitions);
      if (current === epoch.current && personalVersion === authEpoch.current) {
        skipDestination.current = destination;
        setMe(personal);
        setDefinitions(badges);
        setLoadedPath(destination);
      }
    } catch (e) {
      if (current === epoch.current) setLoadedPath(pathname);
      throw e;
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }
  async function logout() {
    // Block stale page responses before waiting for the logout response.
    epoch.current++;
    authEpoch.current++;
    pending.current.clear();
    await apiRequest("logout", { method: "POST" });
    clearPersonal();
    try {
      localStorage.setItem("jne-badge-logout", String(Date.now()));
    } catch {
      /* Storage can be disabled. */
    }
  }
  return (
    <AuthContext.Provider
      value={{
        me,
        definitions,
        loading: loading || (!me && loadedPath !== pathname),
        error,
        login,
        logout,
        refresh,
      }}
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
