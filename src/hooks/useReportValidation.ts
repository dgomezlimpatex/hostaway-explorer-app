import { useMemo } from 'react';
import { TaskChecklistTemplate } from '@/types/taskReports';

interface UseReportValidationProps {
  checklist: Record<string, any>;
  currentTemplate?: TaskChecklistTemplate;
}

interface ValidationResult {
  isValid: boolean;
  missingItems: string[];
  missingPhotos: string[];
  completionPercentage: number;
  canAutoComplete: boolean;
}

export const useReportValidation = ({
  checklist,
  currentTemplate,
}: UseReportValidationProps): ValidationResult => {
  return useMemo(() => {
    if (!currentTemplate) {
      return { 
        isValid: true, 
        missingItems: [], 
        missingPhotos: [], 
        completionPercentage: 0,
        canAutoComplete: false 
      };
    }

    const missingItems: string[] = [];
    const missingPhotos: string[] = [];
    let fullyCompletedItems = 0;
    let totalRequiredItems = 0;
    
    const totalItems = currentTemplate.checklist_items?.reduce(
      (acc, category) => acc + category.items.length, 
      0
    ) || 0;

    if (totalItems === 0) {
      return { 
        isValid: true, 
        missingItems: [], 
        missingPhotos: [], 
        completionPercentage: 0,
        canAutoComplete: false 
      };
    }

    currentTemplate.checklist_items.forEach(category => {
      category.items.forEach(item => {
        const key = `${category.id}.${item.id}`;
        const itemData = checklist[key];
        
        // Contar elementos requeridos
        if (item.required) {
          totalRequiredItems++;
          
          // Verificar si falta completar
          if (!itemData?.completed) {
            missingItems.push(item.task);
          }
        }
        
        // Verificar fotos requeridas
        if (item.photo_required && (!itemData?.media_urls || itemData.media_urls.length === 0)) {
          missingPhotos.push(item.task);
        }
        
        // Contar elementos completados correctamente
        const isExplicitlyCompleted = itemData?.completed === true;
        const hasRequiredPhoto = !item.photo_required || 
          (itemData?.media_urls && Array.isArray(itemData.media_urls) && itemData.media_urls.length > 0);
        
        if (isExplicitlyCompleted && hasRequiredPhoto) {
          fullyCompletedItems++;
        }
      });
    });

    // Calcular porcentaje de forma conservadora
    const rawPercentage = Math.round((fullyCompletedItems / totalItems) * 100);
    
    // Verificar si TODOS los elementos requeridos están completados
    const allRequiredCompleted = totalRequiredItems > 0 ? 
      currentTemplate.checklist_items.reduce((count, category) => {
        return count + category.items.filter(item => {
          if (!item.required) return false;
          const key = `${category.id}.${item.id}`;
          const itemData = checklist[key];
          const isCompleted = itemData?.completed === true;
          const hasRequiredPhoto = !item.photo_required || 
            (itemData?.media_urls && itemData.media_urls.length > 0);
          return isCompleted && hasRequiredPhoto;
        }).length;
      }, 0) === totalRequiredItems : true;

    // Solo permitir 100% si todos los requeridos están completados
    let completionPercentage = rawPercentage;
    if (rawPercentage >= 100 && !allRequiredCompleted) {
      completionPercentage = Math.min(95, rawPercentage);
    } else if (rawPercentage >= 100 && allRequiredCompleted) {
      completionPercentage = 100;
    } else {
      // Nunca auto-completar sin validación explícita
      completionPercentage = Math.min(rawPercentage, 99);
    }

    const isValid = missingItems.length === 0 && missingPhotos.length === 0;
    const canAutoComplete = completionPercentage === 100 && isValid && allRequiredCompleted;

    return {
      isValid,
      missingItems,
      missingPhotos,
      completionPercentage,
      canAutoComplete,
    };
  }, [checklist, currentTemplate]);
};