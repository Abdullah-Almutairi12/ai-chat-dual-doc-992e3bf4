import { createContext, useContext, useState, type ReactNode } from "react";

import type { ExtractResult } from "./pdf-extract";

export type ActiveDocument = ExtractResult & {
  name: string;
  sizeKb: number;
};

type Ctx = {
  doc: ActiveDocument | null;
  setDoc: (doc: ActiveDocument | null) => void;
  clear: () => void;
};

const ActiveDocumentContext = createContext<Ctx | null>(null);

export function ActiveDocumentProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<ActiveDocument | null>(null);
  return (
    <ActiveDocumentContext.Provider value={{ doc, setDoc, clear: () => setDoc(null) }}>
      {children}
    </ActiveDocumentContext.Provider>
  );
}

export function useActiveDocument() {
  const ctx = useContext(ActiveDocumentContext);
  if (!ctx) throw new Error("useActiveDocument must be used within ActiveDocumentProvider");
  return ctx;
}
