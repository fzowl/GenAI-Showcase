import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectWorkspace from './pages/ProjectWorkspace';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
