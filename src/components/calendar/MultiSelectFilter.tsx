import { useState, useMemo } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  allLabel: string;
  className?: string;
}

export const MultiSelectFilter = ({
  options,
  selected,
  onChange,
  placeholder,
  allLabel,
  className,
}: MultiSelectFilterProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find(o => o.id === selected[0])?.name ?? placeholder
        : `${selected.length} ${placeholder.toLowerCase()}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The clear button is a sibling of the trigger: a button inside a button
          cannot be reached with the keyboard. */}
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 w-full justify-between font-normal text-sm rounded-lg",
              selected.length > 0 && "border-primary/50 pr-12"
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            aria-label={`Quitar filtro de ${placeholder}`}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">Sin resultados</div>
          )}
          {filtered.map(option => {
            const isSelected = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent text-left",
                  isSelected && "bg-accent/50"
                )}
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate">{option.name}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="p-2 border-t flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{selected.length} seleccionados</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange([])}
            >
              Limpiar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
