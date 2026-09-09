import React from 'react';
import { createRoot } from 'react-dom/client';
import CampusFlowDashboard from '../CampusFlowDashboard';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CampusFlowDashboard />
  </React.StrictMode>,
);
