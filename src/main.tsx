import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', (e) => {
  document.body.innerHTML += `<div style="color:red; background:white; padding:20px; z-index:9999; position:absolute; top:0;"><h1>Error:</h1><pre>${e.error?.stack || e.message}</pre></div>`;
});
window.addEventListener('unhandledrejection', (e) => {
  document.body.innerHTML += `<div style="color:red; background:white; padding:20px; z-index:9999; position:absolute; top:0;"><h1>Unhandled Promise:</h1><pre>${e.reason?.stack || e.reason}</pre></div>`;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
