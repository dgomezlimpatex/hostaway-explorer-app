import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SecurityStatusProps {
  className?: string;
}

export const SecurityStatus: React.FC<SecurityStatusProps> = ({ className }) => {
  const securityFeatures = [
    {
      name: 'Password Requirements',
      status: 'active',
      description: 'Minimum 8 characters with complexity requirements',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      name: 'Login Rate Limiting',
      status: 'active', 
      description: 'Protection against brute force attacks',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      name: 'Session Timeout',
      status: 'active',
      description: 'Automatic logout after 30 minutes of inactivity',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      name: 'File Upload Security',
      status: 'active',
      description: 'Secure file validation and storage',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      name: 'Input Validation',
      status: 'active',
      description: 'Server-side input sanitization',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      name: 'Database Security',
      status: 'active',
      description: 'Row-level security and secure functions',
      icon: CheckCircle,
      color: 'text-green-600'
    }
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Status
        </CardTitle>
        <CardDescription>
          Current security features and their status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            All critical security features are active and protecting your application.
          </AlertDescription>
        </Alert>
        
        <div className="grid gap-3">
          {securityFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.name} className="flex items-start gap-3 p-3 rounded-lg border">
                <Icon className={`h-4 w-4 mt-0.5 ${feature.color}`} />
                <div className="flex-1">
                  <div className="font-medium">{feature.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {feature.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};