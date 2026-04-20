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
import { AdditionalTasksSection } from "./AdditionalTasksSection";
import { useAuth } from "@/hooks/useAuth";
import { useAdditionalTasks } from "@/hooks/useAdditionalTasks";
import { FieldSaveStatus } from "@/hooks/useInlineFieldSave";

interface TaskDetailsFormProps {
  task: Task;
  /** When true, all editable fields are interactive (admin/manager). */
  canEdit: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
  onFieldBlur?: (field: string, value: string) => void;
  onScheduleSave?: (updates: Partial<Task>) => void;
  statusByField?: Record<string, FieldSaveStatus>;
}

export const TaskDetailsForm = ({
  task,
  canEdit,
  formData,
  onFieldChange,
  onFieldBlur,
  onScheduleSave,
  statusByField,
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
          const { data: property } = await supabase
            .from('properties')
            .select(`*, clients!inner(*)`)
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
          <div className="h-20 bg-muted rounded-lg"></div>
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-24 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TaskDetailsHeader
        task={task}
        canEdit={canEdit}
        formData={formData}
        propertyData={propertyData}
        onFieldChange={onFieldChange}
        onFieldBlur={onFieldBlur}
        statusByField={statusByField}
      />

      <div className="h-px bg-border/60" />

      {canEdit ? (
        <TaskScheduleSection
          task={task}
          formData={formData}
          propertyData={propertyData}
          onFieldChange={onFieldChange}
          onFieldBlur={onFieldBlur}
          onScheduleSave={onScheduleSave}
          statusByField={statusByField}
        />
      ) : (
        <TaskScheduleSection
          task={task}
          formData={{ ...formData, date: task.date, startTime: task.startTime, endTime: task.endTime }}
          propertyData={propertyData}
          onFieldChange={() => {}}
        />
      )}

      {canEdit && (
        <>
          <div className="h-px bg-border/60" />
          <TaskStatusSection
            formData={formData}
            onFieldChange={onFieldChange}
            onFieldBlur={onFieldBlur}
            statusByField={statusByField}
          />
        </>
      )}

      <div className="h-px bg-border/60" />

      <TaskNotesSection
        task={task}
        canEdit={canEdit}
        formData={formData}
        onFieldChange={onFieldChange}
        onFieldBlur={onFieldBlur}
        statusByField={statusByField}
      />

      <div className="h-px bg-border/60" />

      <PropertyDetailsSection propertyData={propertyData} />

      <div className="h-px bg-border/60" />

      <AmenitiesSection propertyData={propertyData} />

      {userRole !== 'cleaner' && clientData && (
        <>
          <div className="h-px bg-border/60" />
          <ClientInfoSection clientData={clientData} />
        </>
      )}

      <ExtraordinaryServiceBillingSection task={task} />

      {propertyData?.notas && (
        <>
          <div className="h-px bg-border/60" />
          <PropertyNotesSection propertyData={propertyData} />
        </>
      )}

      <AdditionalTasksSection
        task={task}
        onAddSubtask={handleAddSubtask}
        onRemoveSubtask={handleRemoveSubtask}
        isEditing={canEdit}
      />
    </div>
  );
};
