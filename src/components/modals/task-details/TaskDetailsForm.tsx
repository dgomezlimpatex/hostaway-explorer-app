import { Task } from "@/types/calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TaskDetailsHeader } from "./components/TaskDetailsHeader";
import { TaskScheduleSection } from "./components/TaskScheduleSection";
import { PropertyDetailsSection } from "./components/PropertyDetailsSection";
import { AmenitiesSection } from "./components/AmenitiesSection";
import { ClientInfoSection } from "./components/ClientInfoSection";
import { TaskStatusSection } from "./components/TaskStatusSection";
import { PropertyNotesSection } from "./components/PropertyNotesSection";
import { InventoryTaskIntegration } from "@/components/inventory/InventoryTaskIntegration";
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
  const [propertyData, setPropertyData] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      {task && task.propertyId && (
        <InventoryTaskIntegration 
          taskId={task.id} 
          propertyId={task.propertyId}
        />
      )}
      
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

      <ClientInfoSection clientData={clientData} />

      {isEditing && (
        <TaskStatusSection 
          formData={formData}
          onFieldChange={onFieldChange}
        />
      )}

      <PropertyNotesSection propertyData={propertyData} />
    </div>
  );
};