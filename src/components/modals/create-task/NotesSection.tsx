import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface NotesTextAreaProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const NotesTextArea = ({ notes, onNotesChange }: NotesTextAreaProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Notas</Label>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Añade notas adicionales para esta tarea..."
        rows={3}
        className="resize-none"
      />
    </div>
  );
};