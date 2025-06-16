
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Users, MapPin, Sparkles, TrendingUp } from "lucide-react";

export const WelcomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="relative z-10 container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <Sparkles className="h-16 w-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Sistema de Gestión de
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent"> Limpieza</span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 leading-relaxed">
              Organiza y gestiona tus servicios de limpieza de manera eficiente con tecnología moderna
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12 text-white">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Calendar className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Calendario Inteligente</h3>
              <p className="text-sm text-blue-100">Programa y gestiona tareas con facilidad</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Users className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Gestión de Personal</h3>
              <p className="text-sm text-blue-100">Administra tu equipo de trabajo</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <TrendingUp className="h-8 w-8 text-purple-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Reportes Avanzados</h3>
              <p className="text-sm text-blue-100">Análisis y estadísticas detalladas</p>
            </div>
          </div>

          <Link to="/auth">
            <Button size="lg" className="text-lg px-12 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-semibold rounded-xl shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300 hover:scale-105">
              Iniciar Sesión
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
