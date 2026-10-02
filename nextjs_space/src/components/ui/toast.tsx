/**
 * src/components/ui/toast.tsx
 *
 * Sistema de toasts minimo (sin dependencias externas).
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
 *   Antes `remove()` del store solo escribia en la consola; si el
 *   dashboard fallaba, los KPIs quedaban en 0 sin aviso. Ahora
 *   cualquier mutacion del data-store (add/update/remove/
 *   performAction) puede invocar `useToast().show({...})` para
 *   informar del exito o el error al usuario.
 *
 * Diseño:
 *   - Singleton en modulo (`toastBus`) para que el data-store (que
 *     no es un componente React) pueda publicar mensajes sin
 *     necesitar hooks.
 *   - Hook `useToast()` para que cualquier componente se suscriba
 *     y renderice la cola.
 *   - `<ToastViewport />` se monta UNA vez en el root layout.
 *   - Tipos: `success`, `error`, `info`. Auto-dismiss a los 4s.
 *   - Accesible: role="status" para info/success y role="alert"
 *     para error.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toastBus as busImpl,
  type ToastMessageInput,
  type ToastVariant,
} from "./toast-bus";

// Re-export del bus y helpers para que el data-store (server-side)
// pueda usarlos sin arrastrar codigo de cliente.
export { toastBus, toastSuccess, toastError, toastInfo } from "./toast-bus";
export type { ToastMessageInput, ToastVariant } from "./toast-bus";

// -----------------------------------------------------------------------------
// Tipos UI-only (los mensajes que viven en el Provider)
// -----------------------------------------------------------------------------

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** ms hasta auto-dismiss. Default 4000. */
  durationMs?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  show: (m: Omit<ToastMessage, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

let nextId = 1;
function genId() {
  return `t-${Date.now().toString(36)}-${nextId++}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((m: ToastMessageInput & { id?: string }) => {
    const id = m.id ?? genId();
    const toast: ToastMessage = {
      id,
      variant: m.variant,
      title: m.title,
      description: m.description,
      durationMs: m.durationMs ?? 4000,
    };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  // Registra el bus global al montarse y lo desregistra al
  // desmontarse. Asi el data-store (que no es un componente) puede
  // publicar mensajes via `toastBus.show({...})`.
  useEffect(() => {
    busImpl.__register((m) => show(m));
    return () => busImpl.__unregister();
  }, [show]);

  const value = useMemo(
    () => ({ toasts, show, dismiss, clear }),
    [toasts, show, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Viewport (componente de UI)
// -----------------------------------------------------------------------------

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; icon: string; role: "status" | "alert" }
> = {
  success: {
    container: "border-emerald-500/40 bg-emerald-50 text-emerald-900",
    icon: "text-emerald-600",
    role: "status",
  },
  error: {
    container: "border-destructive/40 bg-destructive/5 text-destructive",
    icon: "text-destructive",
    role: "alert",
  },
  info: {
    container: "border-blue-500/40 bg-blue-50 text-blue-900",
    icon: "text-blue-600",
    role: "status",
  },
};

const VARIANT_ICONS: Record<
  ToastVariant,
  React.ComponentType<{ className?: string }>
> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastViewport() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      data-testid="toast-viewport"
    >
      {ctx.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => ctx.dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const style = VARIANT_STYLES[toast.variant];
  const Icon = VARIANT_ICONS[toast.variant];

  useEffect(() => {
    if (!toast.durationMs) return;
    const timer = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role={style.role}
      data-testid={`toast-${toast.variant}`}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg",
        style.container,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-xs opacity-80">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Cerrar notificacion"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// (Bus y helpers ahora viven en `./toast-bus.ts` para que el
// data-store los pueda importar sin arrastrar codigo de React.
// Este archivo solo expone el Provider y la UI.)
