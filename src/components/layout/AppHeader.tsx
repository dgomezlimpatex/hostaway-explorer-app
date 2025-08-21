import { Link } from 'react-router-dom';
import { Home, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { useAuth } from '@/hooks/useAuth';

interface AppHeaderProps {
  title?: string;
  showSidebarTrigger?: boolean;
}

export const AppHeader = ({ title, showSidebarTrigger = false }: AppHeaderProps) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {/* Sidebar trigger para layouts que lo necesiten */}
          {showSidebarTrigger && <SidebarTrigger />}
          
          {/* Logo y navegación principal */}
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Sistema de Gestión</span>
            </Link>
            {title && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{title}</span>
              </>
            )}
          </div>
        </div>

        {/* Selector de sede y usuario */}
        <div className="flex items-center gap-4">
          <SedeSelector />
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Hola, {user?.email}</span>
          </div>
        </div>
      </div>
    </header>
  );
};