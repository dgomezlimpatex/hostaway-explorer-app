import { ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface PlanningAdvancedDetailsProps {
  children: ReactNode;
}

export const PlanningAdvancedDetails = ({ children }: PlanningAdvancedDetailsProps) => (
  <Card className="border-[#310984]/10 bg-white text-[#171321] shadow-lg shadow-[#310984]/6">
    <CardContent className="p-0">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-details" className="border-none">
          <AccordionTrigger className="min-h-[56px] px-5 text-left text-base font-semibold text-[#171321] hover:no-underline">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#310984]" />
              Ver disponibilidad, carga y diagnóstico técnico
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-5 px-4 pb-5 md:px-5">
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);
