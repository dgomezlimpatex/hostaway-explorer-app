
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvitationVerificationLoader } from '@/components/invitation/InvitationVerificationLoader';
import { SignUpForm } from '@/components/invitation/SignUpForm';
import { SignInForm } from '@/components/invitation/SignInForm';
import { ProcessingLoader } from '@/components/invitation/ProcessingLoader';
import { SuccessMessage } from '@/components/invitation/SuccessMessage';
import { useInvitationFlow } from '@/hooks/invitation/useInvitationFlow';

const AcceptInvitation = () => {
  const {
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
  } = useInvitationFlow();

  if (verifyInvitation.isPending) {
    return <InvitationVerificationLoader token={token || undefined} />;
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
            <SignUpForm
              email={email || ''}
              fullName={fullName}
              password={password}
              confirmPassword={confirmPassword}
              isLoading={isLoading}
              onFullNameChange={setFullName}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleSignUp}
              onSwitchToSignIn={() => setStep('signin')}
            />
          )}

          {step === 'signin' && (
            <SignInForm
              email={email || ''}
              password={password}
              isLoading={isLoading}
              onPasswordChange={setPassword}
              onSubmit={handleSignIn}
              onSwitchToSignUp={() => setStep('signup')}
            />
          )}

          {step === 'accept' && <ProcessingLoader />}

          {step === 'success' && <SuccessMessage />}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
