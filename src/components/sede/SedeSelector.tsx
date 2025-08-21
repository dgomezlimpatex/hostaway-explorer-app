import { useState } from 'react';
import { Check, ChevronsUpDown, Building2, AlertCircle, Info } from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import { useSedes } from '@/hooks/useSedes';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

  return (
    <TooltipProvider>
      {/* Estados de carga */}
      {(sedeContextLoading || userSedesLoading) && (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Cargando información de sedes...</p>
            </TooltipContent>
          </Tooltip>
          <Skeleton className="h-8 w-32" />
        </div>
      )}

      {/* Estado de error */}
      {userSedesError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Alert className="w-64">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error cargando sedes
              </AlertDescription>
            </Alert>
          </TooltipTrigger>
          <TooltipContent>
            <p>No se pudieron cargar las sedes disponibles. Intenta recargar la página.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* No hay sedes disponibles */}
      {(!userSedes || userSedes.length === 0) && !sedeContextLoading && !userSedesLoading && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Sin sedes disponibles</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>No tienes acceso a ninguna sede. Contacta al administrador.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Solo hay una sede - mostrar como badge */}
      {userSedes && userSedes.length === 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <Badge variant="secondary" className="flex items-center gap-1">
                <span>{userSedes[0].nombre}</span>
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p>Sede única asignada: <strong>{userSedes[0].nombre}</strong></p>
              <p className="text-xs text-muted-foreground">
                Código: {userSedes[0].codigo} • Ciudad: {userSedes[0].ciudad}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Selector principal - múltiples sedes */}
      {userSedes && userSedes.length > 1 && (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Building2 className="h-4 w-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Sede actualmente seleccionada para trabajar</p>
            </TooltipContent>
          </Tooltip>
          
          <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p>Haz clic para cambiar de sede</p>
                  <p className="text-xs text-muted-foreground">
                    Todos los datos se filtrarán por la sede seleccionada
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
            
            <PopoverContent className="w-64 p-0">
              <Command>
                <CommandInput placeholder="Buscar sede..." />
                <CommandEmpty>No se encontraron sedes.</CommandEmpty>
                <CommandList>
                  <CommandGroup heading={
                    <div className="flex items-center gap-2">
                      <span>Sedes disponibles</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Solo se muestran las sedes a las que tienes acceso</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  }>
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
      )}
    </TooltipProvider>
  );
};