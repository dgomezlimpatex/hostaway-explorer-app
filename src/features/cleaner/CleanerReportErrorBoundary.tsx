import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { renderErrorDetails } from '@/utils/renderErrorDetails';

/** Keep a report failure inside the selected task. Retrying reloads its saved draft. */
export class CleanerReportErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { error: Error | null; attempt: number; componentStack: string }
> {
  state = { error: null as Error | null, attempt: 0, componentStack: '' };

  componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack || '' });
  }

  static getDerivedStateFromError(reason: unknown) {
    return { error: reason instanceof Error ? reason : new Error('No se ha podido mostrar el reporte.') };
  }

  render() {
    if (!this.state.error) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return <Dialog open onOpenChange={open => { if (!open) this.props.onClose(); }}>
      <DialogContent translate="no" lang="es" className="notranslate">
        <DialogHeader>
          <DialogTitle>No se ha podido mostrar el reporte</DialogTitle>
          <DialogDescription>El avance y las fotos que ya se guardaron en este móvil se conservan. Reabre el reporte para recuperarlos y comprueba la última foto antes de volver a adjuntarla.</DialogDescription>
        </DialogHeader>
        <details className="min-w-0 text-sm">
          <summary>Detalles técnicos</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{renderErrorDetails(this.state.error, this.state.componentStack)}</pre>
        </details>
        <Button className="min-h-11" onClick={() => this.setState(state => ({ error: null, componentStack: '', attempt: state.attempt + 1 }))}>Reabrir este reporte</Button>
        <Button variant="outline" className="min-h-11" onClick={this.props.onClose}>Volver a mis tareas</Button>
      </DialogContent>
    </Dialog>;
  }
}
