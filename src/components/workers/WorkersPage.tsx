
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowLeft, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { WorkersList } from './WorkersList';
import { CreateWorkerModal } from './CreateWorkerModal';
import { EditWorkerModal } from './EditWorkerModal';
import { WorkerDetailModal } from './WorkerDetailModal';
import { useCleaners } from '@/hooks/useCleaners';
import { Cleaner } from '@/types/calendar';

export default function WorkersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Cleaner | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Cleaner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { cleaners, isLoading } = useCleaners();

  // Filter workers based on search term (sin ordenamiento automático)
  const filteredWorkers = cleaners.filter(worker => 
    worker.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeWorkers = filteredWorkers.filter(worker => worker.isActive);
  const inactiveWorkers = filteredWorkers.filter(worker => !worker.isActive);

  const handleEditWorker = (worker: Cleaner) => {
    setEditingWorker(worker);
  };

  const handleViewWorker = (worker: Cleaner) => {
    setSelectedWorker(worker);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Menú
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-6 w-6" />
                Gestión de Trabajadores
              </h1>
              <p className="text-muted-foreground">Administra tu equipo de limpieza y arrastra para reordenar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                placeholder="Buscar trabajadores..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64" 
              />
            </div>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo Trabajador
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Trabajadores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{cleaners.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trabajadores Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeWorkers.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trabajadores Inactivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{inactiveWorkers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Workers List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Trabajadores Activos ({activeWorkers.length})</CardTitle>
              <p className="text-sm text-muted-foreground">Arrastra las filas para reordenar</p>
            </div>
          </CardHeader>
          <CardContent>
            <WorkersList 
              workers={activeWorkers} 
              isLoading={isLoading}
              onEditWorker={handleEditWorker}
              onViewWorker={handleViewWorker}
            />
          </CardContent>
        </Card>

        {/* Inactive Workers List */}
        {inactiveWorkers.length > 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-muted-foreground">Trabajadores Inactivos ({inactiveWorkers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkersList 
                workers={inactiveWorkers} 
                isLoading={isLoading}
                onEditWorker={handleEditWorker}
                onViewWorker={handleViewWorker}
              />
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        <CreateWorkerModal 
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />

        <EditWorkerModal 
          worker={editingWorker}
          open={!!editingWorker}
          onOpenChange={(open) => !open && setEditingWorker(null)}
        />

        <WorkerDetailModal 
          worker={selectedWorker}
          open={!!selectedWorker}
          onOpenChange={(open) => !open && setSelectedWorker(null)}
        />
      </div>
    </div>
  );
}
