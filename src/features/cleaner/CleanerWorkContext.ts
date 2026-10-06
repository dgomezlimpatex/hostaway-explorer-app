import { createContext, useContext } from 'react';
import type { TaskMedia } from '@/types/taskReports';

export interface CleanerWorkActions {
  uploadPhoto: (file: File, checklistItemId?: string) => Promise<TaskMedia>;
  isPreparingPhoto: boolean;
  changePhotoPreparation: (delta: number) => void;
}
export const CleanerWorkContext = createContext<CleanerWorkActions | null>(null);
export const useCleanerWorkActions = () => useContext(CleanerWorkContext);
