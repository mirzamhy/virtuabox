import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: the booth runs a timed capture sequence that must not mount twice.
createRoot(document.getElementById('root')!).render(<App />);
