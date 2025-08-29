import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SecurityStatusWidgetProps {
  className?: string;
}

export const SecurityStatusWidget = ({ className }: SecurityStatusWidgetProps) => {
  const [criticalIssues] = useState(1); // Security Definer View
  const [warnings] = useState(2); // OTP + Password protection

  const getStatusColor = () => {
    if (criticalIssues > 0) return 'destructive';
    if (warnings > 0) return 'warning';
    return 'success';
  };

  const getStatusIcon = () => {
    if (criticalIssues > 0) return <AlertTriangle className="w-4 h-4" />;
    if (warnings > 0) return <Shield className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (criticalIssues > 0) return 'Problemas Críticos';
    if (warnings > 0) return 'Advertencias';
    return 'Seguro';
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Estado de Seguridad</CardTitle>
        {getStatusIcon()}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <Badge variant={getStatusColor() as any} className="mb-2">
              {getStatusText()}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {criticalIssues > 0 && <div>{criticalIssues} problema(s) crítico(s)</div>}
              {warnings > 0 && <div>{warnings} advertencia(s)</div>}
              {criticalIssues === 0 && warnings === 0 && <div>Sistema seguro</div>}
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/security">
              Ver Detalles
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};