import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface NoSedeWarningProps {
  userEmail?: string;
  userName?: string;
}

export const NoSedeWarning = ({ userEmail, userName }: NoSedeWarningProps) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md mx-auto">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800">
            Sin Acceso a Sedes
          </AlertTitle>
          <AlertDescription className="text-amber-700 space-y-3">
            <p>
              <strong>{userName || userEmail}</strong> no tiene acceso a ninguna sede.
            </p>
            <p>
              Para poder utilizar el sistema, necesitas que un administrador te asigne acceso a al menos una sede.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                Recargar Página
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};