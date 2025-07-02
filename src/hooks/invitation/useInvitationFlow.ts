
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useVerifyInvitation, useAcceptInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/hooks/useAuth';

type InvitationStep = 'verify' | 'signup' | 'signin' | 'accept' | 'success';

export const useInvitationFlow = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp, signIn, user } = useAuth();
  const verificationExecuted = useRef(false);
  
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<InvitationStep>('verify');

  const verifyInvitation = useVerifyInvitation();
  const acceptInvitation = useAcceptInvitation();

  // Verificar la invitación al cargar (solo una vez)
  useEffect(() => {
    if (verificationExecuted.current) return;

    console.log('Starting invitation verification process');
    console.log('Token:', token);
    console.log('Email:', email);

    if (!token || !email) {
      console.error('Missing token or email');
      toast({
        title: 'Error',
        description: 'Enlace de invitación inválido - falta token o email',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    verificationExecuted.current = true;
    console.log('Calling verifyInvitation.mutate');
    
    verifyInvitation.mutate(
      { token, email },
      {
        onSuccess: (isValid) => {
          console.log('Verification success:', isValid);
          if (isValid) {
            setStep('signup');
          } else {
            console.error('Invitation is not valid');
            toast({
              title: 'Error',
              description: 'La invitación ha expirado o no es válida',
              variant: 'destructive',
            });
            navigate('/auth');
          }
        },
        onError: (error: any) => {
          console.error('Verification error:', error);
          toast({
            title: 'Error',
            description: `Error al verificar la invitación: ${error.message || 'Error desconocido'}`,
            variant: 'destructive',
          });
          navigate('/auth');
        }
      }
    );
  }, [token, email, toast, navigate]);

  // Si el usuario ya está autenticado, proceder directamente a aceptar la invitación
  useEffect(() => {
    console.log('User effect - User:', !!user, 'Step:', step);
    
    if (user && (step === 'signup' || step === 'signin')) {
      console.log('User already authenticated, proceeding to accept invitation');
      handleAcceptInvitation();
    }
  }, [user, step]);

  const handleAcceptInvitation = () => {
    if (!token) {
      console.error('No token available for accepting invitation');
      return;
    }

    console.log('Accepting invitation with token:', token);
    setStep('accept');
    
    acceptInvitation.mutate(token, {
      onSuccess: () => {
        console.log('Invitation accepted successfully');
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
        console.error('Error accepting invitation:', error);
        toast({
          title: 'Error',
          description: error.message || 'Error al aceptar la invitación',
          variant: 'destructive',
        });
        // Volver al paso anterior si hay error
        setStep('signup');
      }
    });
  };

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
      console.log('Attempting to sign up user with email:', email);
      
      // Intentar registro sin confirmación de email
      const { error } = await signUp(email!, password, fullName);
      
      if (error) {
        console.error('Sign up error:', error);
        
        // Si el usuario ya existe, cambiar a modo de inicio de sesión
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
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
        console.log('Sign up successful - proceeding to sign in automatically');
        
        // Después del registro exitoso, intentar iniciar sesión automáticamente
        const { error: signInError } = await signIn(email!, password);
        
        if (signInError) {
          console.log('Auto sign-in failed, showing sign-in form');
          setStep('signin');
          toast({
            title: 'Registro exitoso',
            description: 'Cuenta creada. Por favor, inicia sesión.',
          });
        } else {
          console.log('Auto sign-in successful');
          // El useEffect se encargará de proceder con la aceptación de la invitación
        }
      }
    } catch (error: any) {
      console.error('Unexpected sign up error:', error);
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
      console.log('Attempting to sign in user with email:', email);
      const { error } = await signIn(email!, password);
      
      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        console.log('Sign in successful');
        // El useEffect se encargará de proceder con la aceptación de la invitación
      }
    } catch (error: any) {
      console.error('Unexpected sign in error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al iniciar sesión',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return {
    token,
    email,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fullName,
    setFullName,
    isLoading,
    step,
    setStep,
    verifyInvitation,
    handleSignUp,
    handleSignIn,
    handleAcceptInvitation,
  };
};
