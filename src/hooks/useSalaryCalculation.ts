import { useQuery, useMutation } from '@tanstack/react-query';
import { salaryCalculationService, SalaryPeriod } from '@/services/salaryCalculationService';
import { toast } from '@/hooks/use-toast';

export const useSalaryCalculation = (period: SalaryPeriod | null) => {
  return useQuery({
    queryKey: ['salary-calculation', period?.cleanerId, period?.startDate, period?.endDate],
    queryFn: () => period ? salaryCalculationService.calculateSalary(period) : null,
    enabled: !!period,
  });
};

export const useGeneratePayslip = () => {
  return useMutation({
    mutationFn: ({ cleanerId, period }: { cleanerId: string; period: SalaryPeriod }) =>
      salaryCalculationService.generatePayslip(cleanerId, period),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nomina-${variables.cleanerId}-${variables.period.startDate.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Nómina generada",
        description: "La nómina se ha descargado exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Generate payslip error:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al generar la nómina.",
        variant: "destructive",
      });
    },
  });
};