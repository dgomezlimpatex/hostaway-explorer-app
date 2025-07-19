import { useState, useEffect } from 'react';
import { useAutomaticConsumption } from '@/hooks/useAutomaticConsumption';
import { AutoConsumptionStatus } from './AutoConsumptionStatus';

interface InventoryConsumptionIntegrationProps {
  taskId: string;
  propertyId: string;
  userId: string;
  onTaskCompleted?: () => void;
}

export function InventoryConsumptionIntegration({
  taskId,
  propertyId,
  userId,
  onTaskCompleted
}: InventoryConsumptionIntegrationProps) {
  const [consumptionResults, setConsumptionResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  const { processConsumption, isProcessing } = useAutomaticConsumption();

  const handleTaskCompletion = async () => {
    // Procesar consumo automático
    await processConsumption(
      { taskId, propertyId, userId },
      {
        onSuccess: (data) => {
          setConsumptionResults(data.results || []);
          setShowResults(true);
          onTaskCompleted?.();
        }
      }
    );
  };

  return (
    <>
      {showResults && (
        <AutoConsumptionStatus
          results={consumptionResults}
          isProcessing={isProcessing}
          onDismiss={() => setShowResults(false)}
        />
      )}
    </>
  );
}