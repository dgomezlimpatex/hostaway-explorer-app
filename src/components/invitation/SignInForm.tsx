
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SignInFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToSignUp: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  email,
  password,
  isLoading,
  onPasswordChange,
  onSubmit,
  onSwitchToSignUp,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
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
          onChange={(e) => onPasswordChange(e.target.value)}
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
          onClick={onSwitchToSignUp}
          className="text-sm text-blue-600 hover:underline"
        >
          ¿No tienes cuenta? Crear una nueva
        </button>
      </div>
    </form>
  );
};
