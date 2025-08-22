import React, { memo } from 'react';
import { TasksPageHeader } from './TasksPageHeader';
import { TasksPageContent } from './TasksPageContent';

// Memoized version of TasksPageHeader to prevent unnecessary re-renders
export const MemoizedTasksPageHeader = memo(TasksPageHeader, (prevProps, nextProps) => {
  return (
    prevProps.showPastTasks === nextProps.showPastTasks &&
    prevProps.searchTerm === nextProps.searchTerm &&
    prevProps.unassignedTasks.length === nextProps.unassignedTasks.length &&
    prevProps.onSearchChange === nextProps.onSearchChange &&
    prevProps.onTogglePastTasks === nextProps.onTogglePastTasks &&
    prevProps.onOpenCreateModal === nextProps.onOpenCreateModal &&
    prevProps.onOpenBatchModal === nextProps.onOpenBatchModal &&
    prevProps.onAssignmentComplete === nextProps.onAssignmentComplete
  );
});

// Memoized version of TasksPageContent to prevent unnecessary re-renders
export const MemoizedTasksPageContent = memo(TasksPageContent, (prevProps, nextProps) => {
  return (
    prevProps.showPastTasks === nextProps.showPastTasks &&
    prevProps.tasks.length === nextProps.tasks.length &&
    prevProps.sortedTasks.length === nextProps.sortedTasks.length &&
    prevProps.paginatedTasks.length === nextProps.paginatedTasks.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.totalPages === nextProps.totalPages &&
    JSON.stringify(prevProps.filters) === JSON.stringify(nextProps.filters) &&
    prevProps.onFiltersChange === nextProps.onFiltersChange &&
    prevProps.onShowHistory === nextProps.onShowHistory &&
    prevProps.onCreateReport === nextProps.onCreateReport &&
    prevProps.onOpenGroupedReport === nextProps.onOpenGroupedReport &&
    prevProps.onAssignMultipleCleaners === nextProps.onAssignMultipleCleaners &&
    prevProps.onPageChange === nextProps.onPageChange &&
    prevProps.onRefetch === nextProps.onRefetch
  );
});

MemoizedTasksPageHeader.displayName = 'MemoizedTasksPageHeader';
MemoizedTasksPageContent.displayName = 'MemoizedTasksPageContent';