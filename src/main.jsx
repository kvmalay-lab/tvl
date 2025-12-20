import React from 'react'
import ReactDOM from 'react-dom/client'
// Restore original app to reproduce and fix runtime errors
import App from './App.original.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
