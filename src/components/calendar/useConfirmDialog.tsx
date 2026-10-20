import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export interface ChoiceOptions extends ConfirmOptions {
  /** Second way to go on (e.g. "Asignar sin desplazar"). */
  secondaryLabel: string;
}

export type ChoiceResult = 'confirm' | 'secondary' | 'cancel';
export type ChooseFn = (options: ChoiceOptions) => Promise<ChoiceResult>;

type DialogOptions = ConfirmOptions & { secondaryLabel?: string };

/**
 * In-app replacement for window.confirm: `confirm` resolves to true or false
 * when the person answers, `choose` offers a second action, and `dialog` must
 * be rendered once on the page. Closing the dialog always means "cancel".
 */
export const useConfirmDialog = () => {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const resolveRef = useRef<((value: ChoiceResult) => void) | null>(null);

  const choose = useCallback<ChooseFn>((next) => {
    // A new question cancels a pending one instead of leaving it unresolved.
    resolveRef.current?.('cancel');
    return new Promise<ChoiceResult>((resolve) => {
      resolveRef.current = resolve;
      setOptions(next);
    });
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolveRef.current?.('cancel');
    return new Promise<boolean>((resolve) => {
      resolveRef.current = (value) => resolve(value === 'confirm');
      setOptions(next);
    });
  }, []);

  const answer = useCallback((value: ChoiceResult) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => { if (!open) answer('cancel'); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line max-h-[50vh] overflow-y-auto">{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={() => answer('cancel')}>Cancelar</AlertDialogCancel>
          {options?.secondaryLabel && (
            <AlertDialogAction
              onClick={() => answer('secondary')}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {options.secondaryLabel}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={() => answer('confirm')}
            className={cn(options?.destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {options?.confirmLabel ?? "Continuar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, choose, dialog };
};
