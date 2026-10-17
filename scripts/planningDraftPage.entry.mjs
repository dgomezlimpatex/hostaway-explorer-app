import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { CleaningPlanningPage } from '../src/components/cleaning-planning/CleaningPlanningPage';
import './planningDraftPageMocks.mjs';

createRoot(document.getElementById('root')).render(createElement(MemoryRouter, null, createElement(CleaningPlanningPage)));
