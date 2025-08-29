import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SecurityConfigPanel } from "@/components/admin/security/SecurityConfigPanel";

const SecurityManagement = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Gestión de Seguridad" />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Panel de Administración
            </Link>
          </Button>
        </div>

        <SecurityConfigPanel />
      </div>
    </div>
  );
};

export default SecurityManagement;