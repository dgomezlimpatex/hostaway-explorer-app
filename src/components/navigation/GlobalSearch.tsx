import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { entityDetailPath } from './entityLinks';
import { rememberSearchOrigin } from './useLinkedSelection';

interface GlobalSearchProps {
  trigger?: React.ReactNode;
  /** Called after a result is opened, e.g. to close the mobile menu that hosts the search. */
  onNavigate?: () => void;
}

const ITEM_PREFIX: Record<SearchResult['type'], string> = { task: 'task', property: 'prop', worker: 'worker', client: 'client' };
const itemValue = (result: SearchResult) => `${ITEM_PREFIX[result.type]}-${result.id}-${result.title}`;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  in_progress: 'bg-blue-100 text-blue-800',
};

export const GlobalSearch = ({ trigger, onNavigate }: GlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { results, isSearching, hasResults } = useGlobalSearch(search);
  // The opened detail takes focus, so closing the search must not pull it back.
  const keepFocusOnDetail = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  // Highlight the first result of every new result set, so Enter always opens a record.
  const [activeValue, setActiveValue] = useState('');
  useEffect(() => {
    const first = [...results.tasks, ...results.properties, ...results.workers, ...results.clients][0];
    setActiveValue(first ? itemValue(first) : '');
  }, [results, open]);

  const openSearch = useCallback(() => {
    keepFocusOnDetail.current = false;
    rememberSearchOrigin(document.activeElement);
    setOpen(true);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!openRef.current) rememberSearchOrigin(document.activeElement);
        keepFocusOnDetail.current = false;
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      keepFocusOnDetail.current = true;
      setOpen(false);
      setSearch('');
      // Open the exact record by its id, never by name.
      navigate(entityDetailPath(result.type, result.id));
      onNavigate?.();
    },
    [navigate, onNavigate]
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
      aria-label="Buscar en la aplicación"
      className="relative w-full justify-start text-sm text-muted-foreground gap-2"
      onClick={openSearch}
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
      onClick={openSearch}
    >
      <Search className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {trigger || defaultTrigger}

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        onCloseAutoFocus={(event) => { if (keepFocusOnDetail.current) event.preventDefault(); }}
        // Results are already filtered by the server; a second client filter on
        // the item value hid matches whose title is a code (e.g. properties).
        commandProps={{ shouldFilter: false, value: activeValue, onValueChange: setActiveValue }}
      >
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
                  value={itemValue(task)}
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
                  value={itemValue(prop)}
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
                  value={itemValue(worker)}
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
                  value={itemValue(client)}
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
