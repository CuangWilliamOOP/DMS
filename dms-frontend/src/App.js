// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import MainLayout from './layouts/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AddDocumentPage from './pages/AddDocumentPage';
import DirectoryPage from './pages/DirectoryPage';
import CompanyDirectoryPage from './pages/CompanyDirectoryPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Bila user buka '/', redirect ke '/login' */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Halaman login, tanpa layout */}
        <Route path="/login" element={<LoginPage />} />

        {/* Halaman lain yang butuh layout */}
        <Route
          path="/home"
          element={
            <MainLayout>
              <HomePage />
            </MainLayout>
          }
        />
        <Route
          path="/add"
          element={
            <MainLayout>
              <AddDocumentPage />
            </MainLayout>
          }
        />

        <Route
          path="/directory"
          element={
            <MainLayout>
              <DirectoryPage />
            </MainLayout>
          }
        />
        <Route
          path="/directory/:companyName"
          element={
            <MainLayout>
              <CompanyDirectoryPage />
            </MainLayout>
          }
        />

        {/* Opsional: Bisa tambahkan Route 404 di sini jika mau */}
      </Routes>
    </Router>
  );
}

export default App;
