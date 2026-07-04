import { createContext, useContext, useState, type ReactNode } from "react";

export type PreviewMode = null | "full" | "student";

interface StudentPreviewCtx {
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
}

const Ctx = createContext<StudentPreviewCtx>({
  previewMode: null,
  setPreviewMode: () => {},
});

export function StudentPreviewProvider({ children }: { children: ReactNode }) {
  const [previewMode, setPreviewModeState] = useState<PreviewMode>(() => {
    if (typeof window === "undefined") return null;
    try { return (sessionStorage.getItem("studentPreview") as PreviewMode) ?? null; }
    catch { return null; }
  });

  const setPreviewMode = (mode: PreviewMode) => {
    setPreviewModeState(mode);
    try {
      if (mode) sessionStorage.setItem("studentPreview", mode);
      else sessionStorage.removeItem("studentPreview");
    } catch {}
  };

  return <Ctx.Provider value={{ previewMode, setPreviewMode }}>{children}</Ctx.Provider>;
}

export function useStudentPreview() {
  return useContext(Ctx);
}
