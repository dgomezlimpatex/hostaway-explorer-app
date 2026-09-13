import { ChevronLeft } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/** Remains outside the sliding panel so the same button always reopens it. */
export function SidebarEdgeToggle() {
  const { open, toggleSidebar } = useSidebar();
  const label = open ? 'Ocultar menú lateral' : 'Mostrar menú lateral';

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls="app-sidebar"
      className={cn(
        'fixed top-1/2 z-40 hidden h-14 w-7 -translate-y-1/2 items-center justify-center rounded-r-xl border border-[#310984]/15 bg-white text-[#310984] shadow-[2px_2px_12px_rgba(49,9,132,0.12)] md:flex',
        'transition-[left,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#EEE8F8] hover:shadow-[2px_2px_16px_rgba(49,9,132,0.2)] motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7652C8] focus-visible:ring-offset-2',
      )}
      style={{ left: open ? 'var(--sidebar-width)' : '0px' }}
    >
      <ChevronLeft
        aria-hidden="true"
        className={cn('h-4 w-4 transition-transform duration-300 motion-reduce:transition-none', !open && 'rotate-180')}
      />
    </button>
  );
}
