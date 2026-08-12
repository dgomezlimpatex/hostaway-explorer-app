import { TaskMedia } from '@/types/taskReports';

/**
 * Returns every photo belonging to a report, including photos attached to
 * checklist items and additional subtasks.
 */
export const getReportPhotoUrls = (
  media: Pick<TaskMedia, 'task_report_id' | 'media_type' | 'file_url'>[],
  reportId: string,
): string[] => media
  .filter((item) => item.task_report_id === reportId && item.media_type === 'photo')
  .map((item) => item.file_url);
