import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  MapPin,
  Users,
  Building2,
  Search,
  Loader2,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  trigger?: React.ReactNode;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  in_progress: 'bg-blue-100 text-blue-800',
};

export const GlobalSearch = ({ trigger }: GlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { results, isSearching, hasResults } = useGlobalSearch(search);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setSearch('');

      switch (result.type) {
        case 'task':
          navigate(`/tasks?search=${encodeURIComponent(result.title)}`);
          break;
        case 'property':
          navigate(`/properties?search=${encodeURIComponent(result.title)}`);
          break;
        case 'worker':
          navigate(`/tasks?search=${encodeURIComponent(result.title)}`);
          break;
        case 'client':
          navigate(`/clients?search=${encodeURIComponent(result.title)}`);
          break;
      }
    },
    [navigate]
  );

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setSearch('');
    }
  };

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="relative w-full justify-start text-sm text-muted-foreground gap-2"
      onClick={() => setOpen(true)}
    >
      <Search className="h-4 w-4" />
      <span className="hidden lg:inline-flex">Buscar...</span>
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );

  const iconTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setOpen(true)}
    >
      <Search className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {trigger || defaultTrigger}

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput
          placeholder="Buscar tareas, propiedades, trabajadores, clientes..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {isSearching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
            </div>
          )}

          {!isSearching && search.length >= 2 && !hasResults && (
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          )}

          {!isSearching && search.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}

          {results.tasks.length > 0 && (
            <CommandGroup heading="Tareas">
              {results.tasks.map((task) => (
                <CommandItem
                  key={`task-${task.id}`}
                  value={`task-${task.id}-${task.title}`}
                  onSelect={() => handleSelect(task)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.subtitle}</p>
                  </div>
                  {task.meta && (
                    <Badge
                      variant="secondary"
                      className={cn('text-xs shrink-0', statusColors[task.meta] || '')}
                    >
                      {task.meta}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.tasks.length > 0 && results.properties.length > 0 && <CommandSeparator />}

          {results.properties.length > 0 && (
            <CommandGroup heading="Propiedades">
              {results.properties.map((prop) => (
                <CommandItem
                  key={`prop-${prop.id}`}
                  value={`prop-${prop.id}-${prop.title}`}
                  onSelect={() => handleSelect(prop)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{prop.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{prop.subtitle}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.properties.length > 0 && results.workers.length > 0 && <CommandSeparator />}

          {results.workers.length > 0 && (
            <CommandGroup heading="Trabajadores">
              {results.workers.map((worker) => (
                <CommandItem
                  key={`worker-${worker.id}`}
                  value={`worker-${worker.id}-${worker.title}`}
                  onSelect={() => handleSelect(worker)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{worker.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{worker.subtitle}</p>
                  </div>
                  {worker.meta && (
                    <Badge
                      variant={worker.meta === 'Activo' ? 'default' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      {worker.meta}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.workers.length > 0 && results.clients.length > 0 && <CommandSeparator />}

          {results.clients.length > 0 && (
            <CommandGroup heading="Clientes">
              {results.clients.map((client) => (
                <CommandItem
                  key={`client-${client.id}`}
                  value={`client-${client.id}-${client.title}`}
                  onSelect={() => handleSelect(client)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{client.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{client.subtitle}</p>
                  </div>
                  {client.meta && (
                    <span className="text-xs text-muted-foreground shrink-0">{client.meta}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export const GlobalSearchIconTrigger = () => {
  const [open, setOpen] = useState(false);

  return (
    <GlobalSearch
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>
      }
    />
  );
};
