import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCleaners } from '@/hooks/useCleaners';
import { Users, User, UserX } from 'lucide-react';

export type AssignmentMode = 'none' | 'single' | 'distributed';

export interface BatchAssignmentConfig {
  mode: AssignmentMode;
  selectedCleanerId?: string;
  selectedCleanerIds: string[];
  autoScale: boolean;
}

interface BatchCleanerAssignmentProps {
  config: BatchAssignmentConfig;
  onConfigChange: (config: BatchAssignmentConfig) => void;
  taskCount: number;
}

export const BatchCleanerAssignment = ({
  config,
  onConfigChange,
  taskCount
}: BatchCleanerAssignmentProps) => {
  const { cleaners } = useCleaners();
  const activeCleaners = cleaners.filter(c => c.isActive);

  const handleModeChange = (mode: AssignmentMode) => {
    onConfigChange({
      ...config,
      mode,
      selectedCleanerId: mode === 'single' ? config.selectedCleanerId : undefined,
      selectedCleanerIds: mode === 'distributed' ? config.selectedCleanerIds : []
    });
  };

  const handleCleanerSelect = (cleanerId: string) => {
    onConfigChange({
      ...config,
      selectedCleanerId: cleanerId
    });
  };

  const handleCleanerToggle = (cleanerId: string, checked: boolean) => {
    const newIds = checked
      ? [...config.selectedCleanerIds, cleanerId]
      : config.selectedCleanerIds.filter(id => id !== cleanerId);
    
    onConfigChange({
      ...config,
      selectedCleanerIds: newIds
    });
  };

  const handleAutoScaleToggle = (checked: boolean) => {
    onConfigChange({
      ...config,
      autoScale: checked
    });
  };

  const getDistributionPreview = () => {
    if (config.mode !== 'distributed' || config.selectedCleanerIds.length === 0) return null;
    
    const cleanerCount = config.selectedCleanerIds.length;
    const tasksPerCleaner = Math.floor(taskCount / cleanerCount);
    const remainder = taskCount % cleanerCount;
    
    return config.selectedCleanerIds.map((id, index) => {
      const cleaner = activeCleaners.find(c => c.id === id);
      const tasks = tasksPerCleaner + (index < remainder ? 1 : 0);
      return { name: cleaner?.name || 'Desconocido', tasks };
    });
  };

  const distributionPreview = getDistributionPreview();

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <Label className="font-medium">Asignación de Tareas</Label>
      </div>

      <RadioGroup
        value={config.mode}
        onValueChange={(value) => handleModeChange(value as AssignmentMode)}
        className="space-y-3"
      >
        {/* Sin asignar */}
        <div className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
          <RadioGroupItem value="none" id="mode-none" />
          <Label htmlFor="mode-none" className="flex items-center gap-2 cursor-pointer flex-1">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-medium">Sin asignar</span>
              <p className="text-xs text-muted-foreground">Crear tareas pendientes de asignación</p>
            </div>
          </Label>
        </div>

        {/* Asignar a un cleaner */}
        <div className="space-y-2">
          <div className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
            <RadioGroupItem value="single" id="mode-single" />
            <Label htmlFor="mode-single" className="flex items-center gap-2 cursor-pointer flex-1">
              <User className="h-4 w-4 text-blue-500" />
              <div>
                <span className="font-medium">Asignar todas a un cleaner</span>
                <p className="text-xs text-muted-foreground">Todas las tareas para la misma persona</p>
              </div>
            </Label>
          </div>
          
          {config.mode === 'single' && (
            <div className="ml-8">
              <Select value={config.selectedCleanerId || ''} onValueChange={handleCleanerSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar cleaner..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCleaners.map(cleaner => (
                    <SelectItem key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Distribuir entre equipo */}
        <div className="space-y-2">
          <div className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
            <RadioGroupItem value="distributed" id="mode-distributed" />
            <Label htmlFor="mode-distributed" className="flex items-center gap-2 cursor-pointer flex-1">
              <Users className="h-4 w-4 text-green-500" />
              <div>
                <span className="font-medium">Distribuir entre equipo</span>
                <p className="text-xs text-muted-foreground">Repartir equitativamente entre varios cleaners</p>
              </div>
            </Label>
          </div>
          
          {config.mode === 'distributed' && (
            <div className="ml-8 space-y-2">
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {activeCleaners.map(cleaner => (
                  <div key={cleaner.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cleaner-${cleaner.id}`}
                      checked={config.selectedCleanerIds.includes(cleaner.id)}
                      onCheckedChange={(checked) => handleCleanerToggle(cleaner.id, !!checked)}
                    />
                    <Label htmlFor={`cleaner-${cleaner.id}`} className="text-sm cursor-pointer">
                      {cleaner.name}
                    </Label>
                  </div>
                ))}
              </div>
              
              {distributionPreview && distributionPreview.length > 0 && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <p className="font-medium mb-1">Vista previa de distribución:</p>
                  {distributionPreview.map((item, idx) => (
                    <p key={idx}>• {item.name}: {item.tasks} tareas</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </RadioGroup>

      {/* Toggle de escalado automático */}
      <div className="border-t pt-3 mt-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="auto-scale"
            checked={config.autoScale}
            onCheckedChange={(checked) => handleAutoScaleToggle(!!checked)}
          />
          <Label htmlFor="auto-scale" className="text-sm cursor-pointer">
            <span className="font-medium">Escalonar horarios automáticamente</span>
            <p className="text-xs text-muted-foreground">
              Las tareas empezarán una tras otra según su duración
            </p>
          </Label>
        </div>
      </div>
    </div>
  );
};
