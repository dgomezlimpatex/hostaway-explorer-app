import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Property } from '@/types/property';
import { PropertyDetailPanel } from './PropertyDetailPanel';
import { usePropertyInlineEdit } from './usePropertyInlineEdit';

export interface PropertyEditorStatus {
  dirty: boolean;
  saving: boolean;
  message: string;
  discard: () => void;
}

/** Keep the form and its in-flight save alive independently of the visible panel. */
export function PropertyEditorSession({ property, clientName, active, visible, desktop, onClose, onStatus }: {
  property: Property;
  clientName: string;
  active: boolean;
  visible: boolean;
  desktop: boolean;
  onClose: () => void;
  onStatus: (id: string, status: PropertyEditorStatus) => void;
}) {
  const editor = usePropertyInlineEdit(property);
  useEffect(() => {
    onStatus(property.id, { dirty: editor.dirty, saving: editor.saving, message: editor.message, discard: editor.discard });
  }, [property.id, editor.dirty, editor.saving, editor.message, editor.discard, onStatus]);

  if (!visible) return null;
  const panel = <PropertyDetailPanel property={property} clientName={clientName} active={active} editor={editor} />;
  if (desktop) return panel;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-0 pt-10">
      <DialogTitle className="sr-only">Ficha de {property.nombre}</DialogTitle>
      <DialogDescription className="sr-only">Características, servicio y limpiezas de la propiedad.</DialogDescription>
      {panel}
    </DialogContent>
  </Dialog>;
}
