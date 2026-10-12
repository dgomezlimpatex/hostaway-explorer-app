import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installBrowserCompat } from './utils/browserCompat'

installBrowserCompat();

createRoot(document.getElementById("root")!).render(<App />);
