// App-wide state: the customer's session token, language, the public price list and the home data.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";
import { api, ApiError } from "./api";
import { getItem, removeItem, setItem } from "./storage";
import { DICT, TKey } from "./i18n";
import type { Catalog, Home, Lang } from "./types";

// Layout direction is handled by the app itself (Arabic ⇄ English without restarting), so the OS must not flip it.
try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch { /* web */ }

interface S {
  ready: boolean; token: string | null; lang: Lang; rtl: boolean; t: (k: TKey) => string;
  catalog: Catalog | null; home: Home | null; homeError: string; loadingHome: boolean;
  setLang: (l: Lang) => void; signIn: (token: string) => Promise<void>; signOut: () => Promise<void>;
  refreshHome: () => Promise<void>; refreshCatalog: () => Promise<void>;
}
const Ctx = createContext<S | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>("ar");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [homeError, setHomeError] = useState("");
  const [loadingHome, setLoadingHome] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, l, cached] = await Promise.all([getItem("l997c_token"), getItem("l997c_lang"), getItem("l997c_catalog")]);
      if (l === "en" || l === "ar") setLangState(l);
      if (cached) { try { setCatalog(JSON.parse(cached)); } catch { /* ignore */ } }
      setToken(t); setReady(true);
    })();
  }, []);

  const fetchCatalog = useCallback(() => api<Catalog>("catalog", { lang }), [lang]);
  const saveCatalog = useCallback((data: Catalog) => {
    setCatalog(data);
    void setItem("l997c_catalog", JSON.stringify(data));
  }, []);
  const refreshCatalog = useCallback(async () => {
    try { saveCatalog(await fetchCatalog()); } catch { /* keep the cached copy */ }
  }, [fetchCatalog, saveCatalog]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    fetchCatalog().then((data) => { if (active) saveCatalog(data); }, () => {});
    return () => { active = false; };
  }, [ready, fetchCatalog, saveCatalog]);

  const signOut = useCallback(async () => { await removeItem("l997c_token"); setToken(null); setHome(null); }, []);
  const fetchHome = useCallback(() => api<Home>("home", {}, token), [token]);
  const saveHome = useCallback((data: Home) => {
    setHome(data);
    setHomeError("");
  }, []);
  const handleHomeError = useCallback(async (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) await signOut();
    else setHomeError(error instanceof ApiError && error.message === "offline" ? "offline" : "error");
  }, [signOut]);
  const refreshHome = useCallback(async () => {
    if (!token) return;
    setLoadingHome(true);
    try { saveHome(await fetchHome()); }
    catch (error) { await handleHomeError(error); }
    finally { setLoadingHome(false); }
  }, [token, fetchHome, saveHome, handleHomeError]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchHome().then(
      (data) => { if (active) saveHome(data); },
      (error) => { if (active) return handleHomeError(error); },
    );
    return () => { active = false; };
  }, [token, fetchHome, saveHome, handleHomeError]);

  const value = useMemo<S>(() => ({
    ready, token, lang, rtl: lang === "ar", t: (k: TKey) => DICT[lang][k] ?? String(k),
    catalog, home, homeError, loadingHome,
    setLang: (l: Lang) => { setLangState(l); setItem("l997c_lang", l); },
    signIn: async (tk: string) => { await setItem("l997c_token", tk); setToken(tk); },
    signOut, refreshHome, refreshCatalog,
  }), [ready, token, lang, catalog, home, homeError, loadingHome, signOut, refreshHome, refreshCatalog]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useSession() { const c = useContext(Ctx); if (!c) throw new Error("SessionProvider missing"); return c; }
