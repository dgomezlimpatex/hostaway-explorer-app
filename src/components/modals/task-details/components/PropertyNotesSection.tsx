import React from 'react';
import { Info } from 'lucide-react';

interface PropertyNotesSectionProps {
  propertyData: any;
}

export const PropertyNotesSection = ({ propertyData }: PropertyNotesSectionProps) => {
  if (!propertyData?.notas) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-cyan-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notas de la propiedad
        </h3>
      </div>

      <div className="rounded-md border-l-2 border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20 px-3 py-2.5">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{propertyData.notas}</p>
      </div>
    </section>
  );
};
