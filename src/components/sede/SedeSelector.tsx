import { useState } from 'react';
import { Check, ChevronsUpDown, Building2, AlertCircle } from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import { useSedes } from '@/hooks/useSedes';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const SedeSelector = () => {
  const [open, setOpen] = useState(false);
  const { activeSede, setActiveSede, loading: sedeContextLoading } = useSede();
  const { userSedes, userSedesLoading, userSedesError } = useSedes();

  // Estados de carga
  if (sedeContextLoading || userSedesLoading) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  // Estado de error
  if (userSedesError) {
    return (
      <Alert className="w-64">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error cargando sedes
        </AlertDescription>
      </Alert>
    );
  }

  // No hay sedes disponibles
  if (!userSedes || userSedes.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="text-sm">Sin sedes disponibles</span>
      </div>
    );
  }

  // Solo hay una sede - mostrar como badge
  if (userSedes.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <Badge variant="secondary" className="flex items-center gap-1">
          <span>{userSedes[0].nombre}</span>
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-primary" />
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-48 justify-between"
          >
            {activeSede ? (
              <div className="flex items-center gap-2 truncate">
                <span className="truncate">{activeSede.nombre}</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {activeSede.codigo}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">Seleccionar sede...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Buscar sede..." />
            <CommandEmpty>No se encontraron sedes.</CommandEmpty>
            <CommandList>
              <CommandGroup heading="Sedes disponibles">
                {userSedes.map((sede) => (
                  <CommandItem
                    key={sede.id}
                    value={`${sede.nombre} ${sede.codigo} ${sede.ciudad}`}
                    onSelect={() => {
                      setActiveSede(sede);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sede.nombre}</span>
                        <Badge variant="outline" className="text-xs">
                          {sede.codigo}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {sede.ciudad}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        'h-4 w-4',
                        activeSede?.id === sede.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};