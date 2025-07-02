
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';

export const SuccessMessage: React.FC = () => {
  return (
    <Alert>
      <CheckCircle className="h-4 w-4" />
      <AlertDescription>
        ¡Perfecto! Tu cuenta ha sido activada. Serás redirigido al dashboard en breve.
      </AlertDescription>
    </Alert>
  );
};
