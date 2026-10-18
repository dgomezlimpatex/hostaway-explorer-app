import { createRoot } from 'react-dom/client'
import './index.css'
import { installBrowserCompat } from './utils/browserCompat'

installBrowserCompat();

const root = createRoot(document.getElementById("root")!);
// The assistant reader never mounts the management session or its side effects.
if (window.location.pathname === '/asistentes' || window.location.pathname === '/asistentes/') {
  void import('./features/assistants/AssistantReadOnlyApp').then(({default: Reader}) => root.render(<Reader />));
} else {
  void import('./App.tsx').then(({default: App}) => root.render(<App />));
}
