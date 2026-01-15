import { Task, AdditionalTask } from "@/types/calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TaskDetailsHeader } from "./components/TaskDetailsHeader";
import { TaskScheduleSection } from "./components/TaskScheduleSection";
import { PropertyDetailsSection } from "./components/PropertyDetailsSection";
import { AmenitiesSection } from "./components/AmenitiesSection";
import { ClientInfoSection } from "./components/ClientInfoSection";
import { TaskStatusSection } from "./components/TaskStatusSection";
import { PropertyNotesSection } from "./components/PropertyNotesSection";
import { TaskNotesSection } from "./components/TaskNotesSection";
import { ExtraordinaryServiceBillingSection } from "./components/ExtraordinaryServiceBillingSection";
import { InventoryTaskIntegration } from "@/components/inventory/InventoryTaskIntegration";
import { AdditionalTasksSection } from "./AdditionalTasksSection";
import { useAuth } from "@/hooks/useAuth";
import { useAdditionalTasks } from "@/hooks/useAdditionalTasks";
interface TaskDetailsFormProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
}
export const TaskDetailsForm = ({
  task,
  isEditing,
  formData,
  onFieldChange
}: TaskDetailsFormProps) => {
  const { userRole } = useAuth();
  const { addSubtask, removeSubtask } = useAdditionalTasks();
  const [propertyData, setPropertyData] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleAddSubtask = (subtask: Omit<AdditionalTask, 'id' | 'completed' | 'addedAt' | 'addedBy'>) => {
    addSubtask({ task, subtask });
  };

  const handleRemoveSubtask = (subtaskId: string) => {
    removeSubtask({ task, subtaskId });
  };

  useEffect(() => {
    const fetchPropertyAndClientInfo = async () => {
      if (task.propertyId) {
        try {
          // Fetch complete property information
          const { data: property } = await supabase
            .from('properties')
            .select(`
              *,
              clients!inner(*)
            `)
            .eq('id', task.propertyId)
            .maybeSingle();

          if (property) {
            setPropertyData(property);
            setClientData(property.clients);
          }
        } catch (error) {
          console.error('Error fetching property data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchPropertyAndClientInfo();
  }, [task.propertyId]);


  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TaskDetailsHeader
        task={task}
        isEditing={isEditing}
        formData={formData}
        propertyData={propertyData}
        onFieldChange={onFieldChange}
      />

      <TaskScheduleSection
        task={task}
        isEditing={isEditing}
        formData={formData}
        propertyData={propertyData}
        onFieldChange={onFieldChange}
      />

      <PropertyDetailsSection propertyData={propertyData} />

      <AmenitiesSection propertyData={propertyData} />

      {/* Ocultar información del cliente para cleaners */}
      {userRole !== 'cleaner' && <ClientInfoSection clientData={clientData} />}

      {/* Mostrar información de facturación solo para servicios extraordinarios y admin/managers */}
      <ExtraordinaryServiceBillingSection task={task} />

      {isEditing && (
        <TaskStatusSection 
          formData={formData}
          onFieldChange={onFieldChange}
        />
      )}

      <TaskNotesSection
        task={task}
        isEditing={isEditing}
        formData={formData}
        onFieldChange={onFieldChange}
      />

      <PropertyNotesSection propertyData={propertyData} />

      {/* Additional Subtasks Section - visible for admin/manager */}
      <AdditionalTasksSection
        task={task}
        onAddSubtask={handleAddSubtask}
        onRemoveSubtask={handleRemoveSubtask}
        isEditing={isEditing}
      />
    </div>
  );
};