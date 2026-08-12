import assert from 'node:assert/strict';
import { getReportPhotoUrls } from '../src/utils/reportEvidence';

export const run = () => {
  const media = [
    {
      task_report_id: 'report-1',
      media_type: 'photo' as const,
      file_url: 'https://example.test/general.jpg',
      checklist_item_id: null,
    },
    {
      task_report_id: 'report-1',
      media_type: 'photo' as const,
      file_url: 'https://example.test/subtask.jpg',
      checklist_item_id: 'additional.subtask-1',
    },
    {
      task_report_id: 'report-1',
      media_type: 'photo' as const,
      file_url: 'https://example.test/checklist.jpg',
      checklist_item_id: 'bathroom.mirror',
    },
    {
      task_report_id: 'report-1',
      media_type: 'video' as const,
      file_url: 'https://example.test/video.mp4',
      checklist_item_id: 'additional.subtask-1',
    },
    {
      task_report_id: 'report-2',
      media_type: 'photo' as const,
      file_url: 'https://example.test/other-report.jpg',
      checklist_item_id: 'additional.subtask-1',
    },
  ];

  assert.deepEqual(
    getReportPhotoUrls(media, 'report-1'),
    [
      'https://example.test/general.jpg',
      'https://example.test/subtask.jpg',
      'https://example.test/checklist.jpg',
    ],
  );

  console.log('subtask-photo-gallery-tests: OK');
};
