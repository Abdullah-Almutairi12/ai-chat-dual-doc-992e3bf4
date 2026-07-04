import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { translations, type Lang, type TranslationKey } from "./translations";

type I18nContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "pdf-assistant-lang";

function applyDocument(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = (typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (stored === "ar" || stored === "en") {
      setLangState(stored);
      applyDocument(stored);
    } else {
      applyDocument("en");
    }
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    applyDocument(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const toggleLang = () => setLang(lang === "en" ? "ar" : "en");

  const t = (key: TranslationKey) => translations[lang][key] ?? key;

  return (
    <I18nContext.Provider
      value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggleLang, t }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}