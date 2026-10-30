import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, ApiError, clearApiSession, mutateApi } from "../lib/api";
import type { Session, User, Envelope } from "../lib/types";

interface Auth {
  user?: User;
  loading: boolean;
  error?: Error;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export const useAuth = () => {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Session provider required");
  return auth;
};
export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate, cache } = useSWRConfig();
  const [signedOut, setSignedOut] = useState(false);
  const {
    data,
    error,
    isLoading,
    mutate: refreshSession,
  } = useSWR<Envelope<Session>>(!signedOut ? "/api/auth/me" : null, api, {
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  });
  const user = signedOut ? undefined : data?.data.user;
  const clear = useCallback(() => {
    clearApiSession();
    setSignedOut(true);
    for (const key of cache.keys()) cache.delete(key);
    void mutate(() => true, undefined, { revalidate: false });
  }, [cache, mutate]);
  useEffect(() => {
    const expired = () => clear();
    const required = () => {
      void refreshSession(
        (previous) =>
          previous
            ? {
                ...previous,
                data: {
                  ...previous.data,
                  user: { ...previous.data.user, mustChangePassword: true },
                },
              }
            : previous,
        { revalidate: false },
      );
    };
    window.addEventListener("session-expired", expired);
    window.addEventListener("password-required", required);
    return () => {
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("password-required", required);
    };
  }, [clear, refreshSession]);
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!user || !data?.data.session) return;
    lastActivity.current = Date.now();
    const activity = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, activity, { passive: true }),
    );
    const session = data.data.session;
    const timer = setInterval(() => {
      if (
        Date.now() >= Date.parse(session.absoluteExpiresAt) ||
        Date.now() - lastActivity.current >= session.idleTimeoutMinutes * 60000
      )
        clear();
    }, 1000);
    return () => {
      clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, activity));
    };
  }, [user?.id, data?.data.session, clear]);
  async function refresh() {
    setSignedOut(false);
    await refreshSession();
  }
  async function login(username: string, password: string) {
    clearApiSession();
    await mutateApi<Session>("/api/auth/login", "POST", { username, password });
    let session: Envelope<Session>;
    try {
      session = await api<Session>("/api/auth/me");
    } catch (e) {
      // Login itself succeeded, so a 401 right afterwards means the browser did not keep or send the session cookie
      // (third-party cookie blocking, or a cross-site setup without SameSite=None; Secure).
      if (e instanceof ApiError && e.status === 401)
        throw new ApiError(
          401,
          "SESSION_COOKIE_NOT_KEPT",
          "You signed in, but your browser did not keep the session cookie. Allow cookies for this site (disable third-party cookie blocking for it) and try again.",
        );
      throw e;
    }
    setSignedOut(false);
    await mutate("/api/auth/me", session, { revalidate: false });
  }
  async function logout() {
    try {
      await mutateApi("/api/auth/logout", "POST");
      clear();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clear();
      else throw e;
    }
  }
  const visibleError =
    error instanceof ApiError && error.status === 401 ? undefined : error;
  return (
    <AuthContext.Provider
      value={{
        user,
        loading: !signedOut && isLoading,
        error: visibleError,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
