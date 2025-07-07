import { lazy } from 'react';

// Lazy loading de componentes pesados
export const LazyCleaningReportsDashboard = lazy(() => import('./CleaningReportsDashboard').then(module => ({ default: module.CleaningReportsDashboard })));
export const LazyCleaningReportsIncidents = lazy(() => import('./CleaningReportsIncidents').then(module => ({ default: module.CleaningReportsIncidents })));
export const LazyCleaningReportsGallery = lazy(() => import('./CleaningReportsGallery').then(module => ({ default: module.CleaningReportsGallery })));
export const LazyCleaningReportsAnalytics = lazy(() => import('./CleaningReportsAnalytics').then(module => ({ default: module.CleaningReportsAnalytics })));