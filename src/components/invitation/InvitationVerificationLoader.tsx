
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface InvitationVerificationLoaderProps {
  token?: string;
}

export const InvitationVerificationLoader: React.FC<InvitationVerificationLoaderProps> = ({ token }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Verificando invitación...</p>
            <p className="text-sm text-gray-500 mt-2">Token: {token?.substring(0, 8)}...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
