import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { translations, type Lang, type TranslationKey } from "./translations";
import { detectCountryLang } from "./geo.functions";

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
      // A saved manual choice always wins over IP detection.
      setLangState(stored);
      applyDocument(stored);
      return;
    }

    // No saved choice yet: detect the visitor's country by IP and default the
    // language accordingly (Arab country → Arabic, otherwise English).
    let active = true;
    applyDocument("en"); // sensible default while detection resolves
    detectCountryLang()
      .then((res) => {
        if (!active) return;
        // Don't override a choice the user made while detection was in flight.
        const latest = window.localStorage.getItem(STORAGE_KEY);
        if (latest === "ar" || latest === "en") return;
        setLangState(res.lang);
        applyDocument(res.lang);
      })
      .catch(() => {
        // Detection failed → stay on English default.
      });
    return () => {
      active = false;
    };
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