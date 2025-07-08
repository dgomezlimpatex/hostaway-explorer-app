import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { MobileDashboardSidebar } from './MobileDashboardSidebar';

export const MobileDashboardHeader = () => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <>
      {/* Header móvil */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="p-2">
              <Menu className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Menú de Navegación</DrawerTitle>
            </DrawerHeader>
            <MobileDashboardSidebar onNavigate={() => setOpen(false)} />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
};