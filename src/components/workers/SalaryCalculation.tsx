import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Download, Calculator, Euro } from 'lucide-react';
import { useSalaryCalculation, useGeneratePayslip } from '@/hooks/useSalaryCalculation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalaryCalculationProps {
  cleanerId: string;
  cleanerName: string;
}

export const SalaryCalculation: React.FC<SalaryCalculationProps> = ({ 
  cleanerId, 
  cleanerName 
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const period = startDate && endDate ? {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    cleanerId,
  } : null;

  const { data: calculation, isLoading, error } = useSalaryCalculation(period);
  const generatePayslip = useGeneratePayslip();

  const handleGeneratePayslip = () => {
    if (period) {
      generatePayslip.mutate({ cleanerId, period });
    }
  };

  // Set default dates to current month
  React.useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(format(firstDay, 'yyyy-MM-dd'));
    setEndDate(format(lastDay, 'yyyy-MM-dd'));
  }, []);

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Período de Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Fecha Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Fecha Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary Calculation Results */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Calculator className="h-6 w-6 animate-spin mr-2" />
              Calculando nómina...
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-destructive text-center">
              Error al calcular la nómina: {error.message}
            </div>
          </CardContent>
        </Card>
      )}

      {calculation && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Nómina - {cleanerName}
                </span>
                <Badge variant="outline">
                  {format(calculation.period.startDate, 'MMM yyyy', { locale: es })}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hours Breakdown */}
              <div>
                <h4 className="font-semibold mb-3">Desglose de Horas</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {calculation.hours.regular}h
                    </div>
                    <div className="text-sm text-muted-foreground">Regulares</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-orange-500">
                      {calculation.hours.overtime}h
                    </div>
                    <div className="text-sm text-muted-foreground">Extra</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-500">
                      {calculation.hours.vacation}h
                    </div>
                    <div className="text-sm text-muted-foreground">Vacaciones</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">
                      {calculation.hours.total}h
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pay Breakdown */}
              <div>
                <h4 className="font-semibold mb-3">Desglose Salarial</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Pago Regular ({calculation.hours.regular}h × €{calculation.contract.hourlyRate})</span>
                    <span>€{calculation.pay.regular.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago Extra ({calculation.hours.overtime}h × €{calculation.contract.hourlyRate} × {calculation.contract.overtimeRate})</span>
                    <span>€{calculation.pay.overtime.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago Vacaciones ({calculation.hours.vacation}h × €{calculation.contract.hourlyRate})</span>
                    <span>€{calculation.pay.vacation.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Salario Bruto</span>
                    <span>€{calculation.pay.gross.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Deductions */}
              <div>
                <h4 className="font-semibold mb-3">Deducciones</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-destructive">
                    <span>Seguridad Social</span>
                    <span>-€{calculation.deductions.socialSecurity.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Impuestos</span>
                    <span>-€{calculation.deductions.taxes.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-destructive">
                    <span>Total Deducciones</span>
                    <span>-€{calculation.deductions.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Net Pay */}
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Salario Neto</span>
                  <span className="text-2xl font-bold text-primary">
                    €{calculation.netPay.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleGeneratePayslip}
                  disabled={generatePayslip.isPending}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {generatePayslip.isPending ? 'Generando...' : 'Descargar Nómina PDF'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};