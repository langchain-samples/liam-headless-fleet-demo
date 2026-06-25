"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastCtx {
  toast: (t: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const Ctx = React.createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const toneStyles: Record<ToastTone, { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-good" />, bar: "bg-good" },
  error: { icon: <AlertTriangle className="h-5 w-5 text-bad" />, bar: "bg-bad" },
  info: { icon: <Info className="h-5 w-5 text-navy-400" />, bar: "bg-navy-400" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { ...t, id }]);
      setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const value = React.useMemo<ToastCtx>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: "success", title, description }),
      error: (title, description) => toast({ tone: "error", title, description }),
      info: (title, description) => toast({ tone: "info", title, description }),
    }),
    [toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
            {items.map((t) => (
              <div
                key={t.id}
                className="dm-fade-in relative flex gap-3 overflow-hidden rounded-[12px] border border-line bg-card p-3.5 pr-9 shadow-lg"
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", toneStyles[t.tone].bar)} />
                <div className="mt-0.5 shrink-0">{toneStyles[t.tone].icon}</div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{t.title}</p>
                  {t.description && <p className="mt-0.5 break-words text-[12px] text-ink-faint">{t.description}</p>}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="dm-focus absolute right-2 top-2.5 rounded p-1 text-ink-faint hover:bg-paper-2"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
