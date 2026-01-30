import { useState, useCallback, KeyboardEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Square, RotateCcw, Hash } from "lucide-react";

interface PropertyGridToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvertSelection: () => void;
  onSelectRange: (start: number, end: number) => void;
}

export const PropertyGridToolbar = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onSelectRange,
}: PropertyGridToolbarProps) => {
  const [rangeInput, setRangeInput] = useState('');

  const handleRangeSubmit = useCallback(() => {
    const trimmed = rangeInput.trim();
    if (!trimmed) return;

    // Parse range like "22-35" or "22:35" or "22 35"
    const match = trimmed.match(/(\d+)\s*[-:\s]\s*(\d+)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      if (!isNaN(start) && !isNaN(end)) {
        onSelectRange(Math.min(start, end), Math.max(start, end));
        setRangeInput('');
      }
    }
  }, [rangeInput, onSelectRange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRangeSubmit();
    }
  }, [handleRangeSubmit]);

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
      {/* Quick actions */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={allSelected ? "default" : "outline"}
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="h-8"
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4 mr-1" />
              Ninguna
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4 mr-1" />
              Todas
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onInvertSelection}
          className="h-8"
          disabled={totalCount === 0}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Invertir
        </Button>
      </div>

      {/* Range selector */}
      <div className="flex items-center gap-1">
        <div className="flex items-center">
          <Hash className="h-4 w-4 text-muted-foreground mr-1" />
          <Input
            type="text"
            placeholder="22-35"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-20 h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRangeSubmit}
          className="h-8"
          disabled={!rangeInput.trim()}
        >
          Rango
        </Button>
      </div>

      {/* Selection counter */}
      <div className="flex-1 flex justify-end">
        <Badge 
          variant={selectedCount > 0 ? "default" : "secondary"}
          className="text-sm px-3 py-1"
        >
          {selectedCount} / {totalCount} seleccionadas
        </Badge>
      </div>
    </div>
  );
};
