
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVerifyInvitation, useAcceptInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Mail, Clock, Loader2 } from 'lucide-react';

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signUp, signIn } = useAuth();
  const [authStep, setAuthStep] = useState<'checking' | 'signup' | 'signin' | 'accepting' | 'done'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');
  const invitationEmail = searchParams.get('email');

  const { data: isValidInvitation, isLoading: verifyingInvitation } = useVerifyInvitation(
    token || '', 
    invitationEmail || ''
  );
  const acceptInvitation = useAcceptInvitation();

  useEffect(() => {
    if (token && invitationEmail && isValidInvitation === true) {
      if (user && user.email === invitationEmail) {
        setAuthStep('accepting');
        handleAcceptInvitation();
      } else if (user && user.email !== invitationEmail) {
        setError('Debes cerrar sesión e iniciar con el email de la invitación');
      } else {
        setAuthStep('signup');
        setEmail(invitationEmail);
      }
    } else if (isValidInvitation === false) {
      setError('Invitación inválida o expirada');
    }
  }, [token, invitationEmail, isValidInvitation, user]);

  const handleAcceptInvitation = async () => {
    if (!token) return;
    
    try {
      await acceptInvitation.mutateAsync(token);
      setAuthStep('done');
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      setError(error.message || 'Error al aceptar la invitación');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !fullName) {
      setError('Por favor, completa todos los campos');
      return;
    }

    try {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        setError(error.message);
        return;
      }
      
      setAuthStep('accepting');
      // Esperamos un momento para que se complete el registro
      setTimeout(handleAcceptInvitation, 1000);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
        return;
      }
      
      setAuthStep('accepting');
      setTimeout(handleAcceptInvitation, 1000);
    } catch (error: any) {
      setError(error.message);
    }
  };

  if (!token || !invitationEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Enlace Inválido</CardTitle>
            <CardDescription>
              El enlace de invitación no es válido o está incompleto.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (verifyingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Verificando invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStep === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>¡Invitación Aceptada!</CardTitle>
            <CardDescription>
              Tu cuenta ha sido activada exitosamente. Serás redirigido en breve...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (authStep === 'accepting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Activando tu cuenta...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle>Aceptar Invitación</CardTitle>
          <CardDescription>
            Has sido invitado a unirte al sistema. Completa tu registro para activar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
              <strong>Email:</strong> {invitationEmail}
            </div>

            <div className="flex space-x-2">
              <Button
                variant={authStep === 'signup' ? 'default' : 'outline'}
                onClick={() => setAuthStep('signup')}
                className="flex-1"
              >
                Crear Cuenta
              </Button>
              <Button
                variant={authStep === 'signin' ? 'default' : 'outline'}
                onClick={() => setAuthStep('signin')}
                className="flex-1"
              >
                Ya tengo cuenta
              </Button>
            </div>

            {authStep === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Crear Cuenta y Aceptar Invitación
                </Button>
              </form>
            )}

            {authStep === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Iniciar Sesión y Aceptar Invitación
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
