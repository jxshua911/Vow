import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type DialogState = { kind: 'confirm' | 'alert'; title: string; message: string; confirmLabel: string; cancelLabel: string };
type VowDialogProps = { state: DialogState | null; onResolve: (result: boolean) => void };

function VowDialog({ state, onResolve }: VowDialogProps) {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="vow-dialog-title" className="w-full max-w-md border border-vow-border bg-vow-bg p-5 shadow-2xl">
        <h2 id="vow-dialog-title" className="vow-heading text-lg text-vow-ink">{state.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-vow-muted">{state.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          {state.kind === 'confirm' && <button type="button" onClick={() => onResolve(false)} className="vow-btn-ghost">{state.cancelLabel}</button>}
          <button type="button" autoFocus onClick={() => onResolve(true)} className="vow-btn-primary">{state.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

export function useVowDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const resolve = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);
  const confirm = useCallback((message: string, title = 'Please confirm', confirmLabel = 'Confirm') => new Promise<boolean>((done) => {
    resolver.current = done;
    setState({ kind: 'confirm', title, message, confirmLabel, cancelLabel: 'Cancel' });
  }), []);
  const alert = useCallback((message: string, title = 'VOW') => new Promise<void>((done) => {
    resolver.current = () => done();
    setState({ kind: 'alert', title, message, confirmLabel: 'Got it', cancelLabel: '' });
  }), []);
  const dialog: ReactNode = <VowDialog state={state} onResolve={resolve} />;
  return { confirm, alert, dialog };
}
