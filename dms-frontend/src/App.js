// File: src/App.js
// ----------------

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useIdleLogout from "./hooks/useIdleLogout";
import API from "./services/api";
import ColorModeProvider from "./theme/ColorModeProvider";

// Layout
import MainLayout from './layouts/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AddDocumentPage from './pages/AddDocumentPage';
import DirectoryPage from './pages/DirectoryPage';
import CompanyDirectoryPage from './pages/CompanyDirectoryPage';
import DocumentPreviewPage from './pages/DocumentPreviewPage';   // FIX: import halaman pratinjau
import RekapPage from './pages/RekapPage';
import FarmNavigationPage from './pages/FarmNavigationPage';

function App() {
  const [idleMinutes, setIdleMinutes] = useState(60); // default

  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      API.get("/user-settings/").then(({ data }) =>
        setIdleMinutes(data.idle_timeout)
      );
    }
  }, []);

  useIdleLogout(idleMinutes);

  return (
    <ColorModeProvider>
      <Router>
        <Routes>
          {/* Auth */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Fullscreen navigation map */}
          <Route path="/navigate/:estateCode" element={<FarmNavigationPage />} />

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
            path="/directory/:companyName/rekap/:rekapKey"
            element={
              <MainLayout>
                <RekapPage />
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
    </ColorModeProvider>
  );
}

export default App;
