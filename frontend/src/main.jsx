// Punto de entrada de Vite: monta el árbol de React en el div#root del
// index.html y carga los estilos globales de la app.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
