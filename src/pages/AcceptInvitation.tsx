
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVerifyInvitation, useAcceptInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/hooks/useAuth';

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp, signIn, user } = useAuth();
  
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'signup' | 'signin' | 'accept' | 'success'>('verify');

  const verifyInvitation = useVerifyInvitation();
  const acceptInvitation = useAcceptInvitation();

  // Verificar la invitación al cargar
  useEffect(() => {
    if (!token || !email) {
      toast({
        title: 'Error',
        description: 'Enlace de invitación inválido',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    verifyInvitation.mutate(
      { token, email },
      {
        onSuccess: (isValid) => {
          if (isValid) {
            setStep('signup');
          } else {
            toast({
              title: 'Error',
              description: 'La invitación ha expirado o no es válida',
              variant: 'destructive',
            });
            navigate('/auth');
          }
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Error al verificar la invitación',
            variant: 'destructive',
          });
          navigate('/auth');
        }
      }
    );
  }, [token, email]);

  // Si el usuario ya está autenticado, ir directamente a aceptar invitación
  useEffect(() => {
    if (user && step === 'signup') {
      setStep('accept');
      handleAcceptInvitation();
    }
  }, [user, step]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Error', 
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp(email!, password, fullName);
      
      if (error) {
        // Si el usuario ya existe, intentar hacer login
        if (error.message.includes('already registered')) {
          setStep('signin');
          toast({
            title: 'Usuario existente',
            description: 'Este email ya tiene una cuenta. Por favor, inicia sesión.',
          });
        } else {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        // Después del registro, el usuario se autenticará automáticamente
        setStep('accept');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear la cuenta',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email!, password);
      
      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setStep('accept');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al iniciar sesión',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleAcceptInvitation = () => {
    if (!token) return;

    acceptInvitation.mutate(token, {
      onSuccess: () => {
        setStep('success');
        toast({
          title: 'Invitación aceptada',
          description: 'Tu cuenta ha sido activada exitosamente.',
        });
        
        // Redirigir al dashboard después de 2 segundos
        setTimeout(() => {
          navigate('/');
        }, 2000);
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error.message || 'Error al aceptar la invitación',
          variant: 'destructive',
        });
      }
    });
  };

  if (verifyInvitation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Verificando invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {step === 'signup' && 'Crear tu cuenta'}
            {step === 'signin' && 'Iniciar sesión'}
            {step === 'accept' && 'Activando cuenta...'}
            {step === 'success' && 'Cuenta activada'}
          </CardTitle>
          <CardDescription className="text-center">
            {step === 'signup' && `Completa tu registro para ${email}`}
            {step === 'signin' && `Inicia sesión con ${email}`}
            {step === 'accept' && 'Asignando permisos a tu cuenta'}
            {step === 'success' && 'Tu cuenta ha sido activada correctamente'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre completo"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email || ''}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirma tu contraseña"
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('signin')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  ¿Ya tienes cuenta? Inicia sesión
                </button>
              </div>
            </form>
          )}

          {step === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email || ''}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('signup')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  ¿No tienes cuenta? Crear una nueva
                </button>
              </div>
            </form>
          )}

          {step === 'accept' && (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p>Procesando invitación...</p>
            </div>
          )}

          {step === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                ¡Perfecto! Tu cuenta ha sido activada. Serás redirigido al dashboard en breve.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
