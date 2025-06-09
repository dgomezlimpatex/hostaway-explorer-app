
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, Users, Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CleaningCalendar from "@/components/CleaningCalendar";
import CleaningList from "@/components/CleaningList";
import StatsCards from "@/components/StatsCards";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Gestión de Limpiezas
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Coordina y gestiona todas las limpiezas de tus propiedades
          </p>
          
          {/* Navigation Links */}
          <div className="flex justify-center gap-4 mt-4">
            <Link to="/clients">
              <Button variant="outline" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Gestión de Clientes
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards />

        {/* Main Content */}
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-6">
            <CleaningCalendar />
          </TabsContent>

          <TabsContent value="list" className="space-y-6">
            <CleaningList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
