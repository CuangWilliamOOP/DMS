// File: src/App.js
// ----------------

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
import DocumentPreviewPage from './pages/DocumentPreviewPage';   // FIX: import halaman pratinjau

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Halaman utama */}
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

        <Route
          path="/directory/:companyName/:dirKey"
          element={
            <MainLayout>
              <CompanyDirectoryPage />
            </MainLayout>
          }
        />

        {/* FIX: route baru untuk pratinjau dokumen */}
        <Route
          path="/preview/:id"
          element={
            <MainLayout>
              <DocumentPreviewPage />
            </MainLayout>
          }
        />

        <Route
          path="/directory/:companyName/:dirKey/preview/:docCode"
          element={
            <MainLayout>
              <DocumentPreviewPage />
            </MainLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
