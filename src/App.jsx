import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import WorkoutSession from './pages/WorkoutSession';
import History from './pages/History';

function App() {
  return (
    <Router>
      <Routes>
        {/* Pages with Layout */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/history" element={<Layout><History /></Layout>} />

        {/* Workout Session takes full screen, no sidebar */}
        <Route path="/workout" element={<WorkoutSession />} />
      </Routes>
    </Router>
  );
}

export default App;
