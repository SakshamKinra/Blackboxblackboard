// src/App.js
// Root component: manages theme state and routing.
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Landing     from './pages/Landing';
import CreateBoard from './pages/CreateBoard';
import BoardPage   from './pages/BoardPage';

export default function App() {
  // ── Theme: persisted in localStorage, applied as 'dark' class on <html>
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('bb-theme');
    return saved !== null ? saved === 'dark' : true; // default: dark
  });

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('bb-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(prev => !prev);

  return (
    // Pass darkMode + toggle down via props (simple, no Context needed)
    <Router>
      <Routes>
        <Route path="/"             element={<Landing     darkMode={darkMode} toggleTheme={toggleTheme} />} />
        <Route path="/create"       element={<CreateBoard darkMode={darkMode} toggleTheme={toggleTheme} />} />
        <Route path="/board/:id"    element={<BoardPage   darkMode={darkMode} toggleTheme={toggleTheme} />} />
      </Routes>
    </Router>
  );
}
