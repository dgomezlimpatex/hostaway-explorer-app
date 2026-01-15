
import { useState } from 'react';
import { Loader2, Lock, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ClientPortalAuthProps {
  clientName: string;
  onAuthenticate: (pin: string) => Promise<void>;
  isLoading: boolean;
  error?: string;
}

export const ClientPortalAuth = ({
  clientName,
  onAuthenticate,
  isLoading,
  error,
}: ClientPortalAuthProps) => {
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      setLocalError('Introduce los 6 dígitos del PIN');
      return;
    }
    
    setLocalError('');
    try {
      await onAuthenticate(pin);
    } catch (e) {
      setLocalError('PIN incorrecto');
      setPin('');
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    setLocalError('');
    
    // Auto-submit when 6 digits are entered
    if (value.length === 6) {
      setTimeout(() => {
        onAuthenticate(value).catch(() => {
          setLocalError('PIN incorrecto');
          setPin('');
        });
      }, 100);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Portal de Reservas</CardTitle>
            <CardDescription className="text-lg mt-2">
              {clientName}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
              <Lock className="h-4 w-4" />
              <span className="text-sm">Introduce tu PIN de acceso</span>
            </div>
            
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={handlePinChange}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            
            {(localError || error) && (
              <p className="text-sm text-destructive mt-3">
                {localError || error}
              </p>
            )}
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || pin.length !== 6}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              'Acceder'
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Si no recuerdas tu PIN, contacta con tu supervisor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
