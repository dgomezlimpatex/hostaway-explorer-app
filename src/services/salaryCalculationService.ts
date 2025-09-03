import { TimeLog, WorkerContract, SalaryCalculation } from '@/types/calendar';
import { timeLogsStorage } from './storage/timeLogsStorage';
import { workerContractsStorage } from './storage/workerContractsStorage';

export interface SalaryPeriod {
  startDate: Date;
  endDate: Date;
  cleanerId: string;
}

export class SalaryCalculationService {
  async calculateSalary(period: SalaryPeriod): Promise<SalaryCalculation> {
    const { startDate, endDate, cleanerId } = period;
    
    // Get worker contract
    const contract = await workerContractsStorage.getByCleanerId(cleanerId);
    if (!contract) {
      throw new Error('No se encontró contrato para el trabajador');
    }

    // Get time logs for the period
    const timeLogs = await timeLogsStorage.getByCleanerAndDateRange(
      cleanerId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Calculate totals
    const regularHours = this.calculateRegularHours(timeLogs, contract);
    const overtimeHours = this.calculateOvertimeHours(timeLogs, contract);
    const vacationHours = this.calculateVacationHours(timeLogs);
    
    // Calculate pay
    const regularPay = regularHours * contract.hourlyRate;
    const overtimePay = overtimeHours * contract.hourlyRate * contract.overtimeRate;
    const vacationPay = vacationHours * contract.hourlyRate;
    
    // Calculate deductions
    const socialSecurityDeduction = this.calculateSocialSecurity(regularPay + overtimePay);
    const taxDeduction = this.calculateTaxes(regularPay + overtimePay + vacationPay);
    
    const grossPay = regularPay + overtimePay + vacationPay;
    const totalDeductions = socialSecurityDeduction + taxDeduction;
    const netPay = grossPay - totalDeductions;

    return {
      cleanerId,
      period: { startDate, endDate },
      contract: {
        hourlyRate: contract.hourlyRate,
        overtimeRate: contract.overtimeRate,
        contractHoursPerWeek: contract.contractHoursPerWeek,
        vacationDaysPerYear: contract.vacationDaysPerYear,
      },
      hours: {
        regular: regularHours,
        overtime: overtimeHours,
        vacation: vacationHours,
        total: regularHours + overtimeHours + vacationHours,
      },
      pay: {
        regular: regularPay,
        overtime: overtimePay,
        vacation: vacationPay,
        gross: grossPay,
      },
      deductions: {
        socialSecurity: socialSecurityDeduction,
        taxes: taxDeduction,
        total: totalDeductions,
      },
      netPay,
      generatedAt: new Date(),
    };
  }

  private calculateRegularHours(timeLogs: TimeLog[], contract: WorkerContract): number {
    const weeklyContractHours = contract.contractHoursPerWeek;
    let totalRegularHours = 0;

    // Group by week and calculate regular hours
    const weeklyHours = this.groupByWeek(timeLogs);
    
    for (const weekHours of Object.values(weeklyHours)) {
      const weekTotal = weekHours.reduce((sum, log) => sum + (log.workedHours || 0), 0);
      totalRegularHours += Math.min(weekTotal, weeklyContractHours);
    }

    return totalRegularHours;
  }

  private calculateOvertimeHours(timeLogs: TimeLog[], contract: WorkerContract): number {
    const weeklyContractHours = contract.contractHoursPerWeek;
    let totalOvertimeHours = 0;

    // Group by week and calculate overtime hours
    const weeklyHours = this.groupByWeek(timeLogs);
    
    for (const weekHours of Object.values(weeklyHours)) {
      const weekTotal = weekHours.reduce((sum, log) => sum + (log.workedHours || 0), 0);
      if (weekTotal > weeklyContractHours) {
        totalOvertimeHours += weekTotal - weeklyContractHours;
      }
    }

    return totalOvertimeHours;
  }

  private calculateVacationHours(timeLogs: TimeLog[]): number {
    return timeLogs.reduce((sum, log) => sum + (log.vacationHoursUsed || 0), 0);
  }

  private calculateSocialSecurity(grossPay: number): number {
    // Spanish social security rate (approximate)
    return grossPay * 0.0635; // 6.35%
  }

  private calculateTaxes(grossPay: number): number {
    // Simplified tax calculation (would need proper tax brackets)
    if (grossPay <= 12450) return 0;
    if (grossPay <= 20200) return (grossPay - 12450) * 0.19;
    if (grossPay <= 35200) return 1472.5 + (grossPay - 20200) * 0.24;
    // Add more brackets as needed
    return 1472.5 + 3600 + (grossPay - 35200) * 0.30;
  }

  private groupByWeek(timeLogs: TimeLog[]): Record<string, TimeLog[]> {
    const weeks: Record<string, TimeLog[]> = {};
    
    timeLogs.forEach(log => {
      const date = new Date(log.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1); // Monday
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(log);
    });

    return weeks;
  }

  async generatePayslip(cleanerId: string, period: SalaryPeriod): Promise<Blob> {
    const calculation = await this.calculateSalary(period);
    
    // This would integrate with jsPDF for PDF generation
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Add company header
    doc.setFontSize(16);
    doc.text('Nómina - Empresa de Limpieza', 20, 20);
    
    // Add period
    doc.setFontSize(12);
    doc.text(`Período: ${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`, 20, 40);
    
    // Add salary details
    let y = 60;
    doc.text(`Horas Regulares: ${calculation.hours.regular}h`, 20, y);
    doc.text(`€${calculation.pay.regular.toFixed(2)}`, 150, y);
    
    y += 10;
    doc.text(`Horas Extra: ${calculation.hours.overtime}h`, 20, y);
    doc.text(`€${calculation.pay.overtime.toFixed(2)}`, 150, y);
    
    y += 10;
    doc.text(`Vacaciones: ${calculation.hours.vacation}h`, 20, y);
    doc.text(`€${calculation.pay.vacation.toFixed(2)}`, 150, y);
    
    y += 20;
    doc.text(`Salario Bruto:`, 20, y);
    doc.text(`€${calculation.pay.gross.toFixed(2)}`, 150, y);
    
    y += 10;
    doc.text(`Seguridad Social:`, 20, y);
    doc.text(`-€${calculation.deductions.socialSecurity.toFixed(2)}`, 150, y);
    
    y += 10;
    doc.text(`Impuestos:`, 20, y);
    doc.text(`-€${calculation.deductions.taxes.toFixed(2)}`, 150, y);
    
    y += 20;
    doc.setFontSize(14);
    doc.text(`Salario Neto:`, 20, y);
    doc.text(`€${calculation.netPay.toFixed(2)}`, 150, y);
    
    return doc.output('blob');
  }
}

export const salaryCalculationService = new SalaryCalculationService();