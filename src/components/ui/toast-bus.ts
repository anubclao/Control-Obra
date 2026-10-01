/**
 * src/components/ui/toast-bus.ts
 *
 * Bus global de toasts sin dependencias de React.
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
 *   El data-store (lib/data-store.ts) NO es un componente React
 *   y se importa desde muchos lugares. Si importara directamente
 *   `@/components/ui/toast`, arrastraria codigo de cliente y
 *   romperia el uso server-side. Aqui exponemos solo el bus puro:
 *     - `toastBus.show({...})` desde cualquier sitio.
 *     - `toastBus.__register(showFn)` desde <ToastProvider>.
 *   Si nadie se ha registrado, el bus cae a un log estructurado
 *   en consola (asi no se pierde el mensaje en SSR/tests).
 */

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessageInput {
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs?: number;
}

type ShowFn = (m: ToastMessageInput) => string;

let registeredShow: ShowFn | null = null;

export const toastBus = {
  show(m: ToastMessageInput) {
    if (registeredShow) return registeredShow(m);
    // Fallback: log estructurado. Asi en SSR/tests o sin provider
    // montado, el mensaje al menos queda visible para el operador.
    const tag =
      m.variant === "error"
        ? "[toast:error]"
        : m.variant === "success"
          ? "[toast:success]"
          : "[toast:info]";
    // eslint-disable-next-line no-console
    console[m.variant === "error" ? "error" : "log"](
      tag,
      m.title,
      m.description ?? "",
    );
    return "";
  },
  __register(show: ShowFn) {
    registeredShow = show;
  },
  __unregister() {
    registeredShow = null;
  },
};

/** Helpers ergonomicos. */
export function toastSuccess(title: string, description?: string) {
  return toastBus.show({ variant: "success", title, description });
}

export function toastError(title: string, description?: string) {
  return toastBus.show({ variant: "error", title, description });
}

export function toastInfo(title: string, description?: string) {
  return toastBus.show({ variant: "info", title, description });
}
