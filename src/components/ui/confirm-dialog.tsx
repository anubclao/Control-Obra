"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, XCircle, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";

export type ConfirmVariant = "default" | "danger" | "success" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  details?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** Callback asíncrono (ej. fetch). Si throwea, no cierra el modal. */
  onConfirm: () => Promise<void> | void;
}

const ICONS: Record<ConfirmVariant, React.ComponentType<{ className?: string }>> = {
  default: AlertTriangle,
  danger: XCircle,
  success: CheckCircle2,
  info: Info,
};

const VARIANT_BUTTON: Record<ConfirmVariant, "default" | "destructive"> = {
  default: "default",
  danger: "destructive",
  success: "default",
  info: "default",
};

const VARIANT_COLOR: Record<ConfirmVariant, string> = {
  default: "text-amber-600",
  danger: "text-red-600",
  success: "text-emerald-600",
  info: "text-blue-600",
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = ICONS[variant];

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await onConfirm();
      setLoading(false);
      onOpenChange(false);
    } catch (e: any) {
      setLoading(false);
      console.error("[confirm dialog]", e?.message);
      setError(e?.message ?? "No se pudo completar la acción");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Icon className={`mt-1 h-5 w-5 shrink-0 ${VARIANT_COLOR[variant]}`} />
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1.5">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {details && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            {details}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={VARIANT_BUTTON[variant]}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook helper para crear acciones con confirmación.
 * Uso:
 *   const del = useConfirm();
 *   <Button onClick={() => del.open({ ... })} />
 */

interface ConfirmState {
  open: boolean;
  title: string;
  description?: string;
  details?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm?: () => Promise<void> | void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
  });

  const open = useCallback((opts: Omit<ConfirmState, "open">) => {
    setState({ ...opts, open: true });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}
      title={state.title}
      description={state.description}
      details={state.details}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      variant={state.variant}
      onConfirm={state.onConfirm ?? (() => {})}
    />
  );

  return { open, close, dialog };
}
