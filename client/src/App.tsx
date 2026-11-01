import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppearanceProvider } from './context/AppearanceContext';

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const PublicInfoPage = lazy(() => import('./pages/PublicInfoPage').then((module) => ({ default: module.PublicInfoPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ResetFirstPasswordPage = lazy(() => import('./pages/ResetFirstPasswordPage').then((module) => ({ default: module.ResetFirstPasswordPage })));
const AdminPortal = lazy(() => import('./pages/AdminPortal').then((module) => ({ default: module.AdminPortal })));
const FacultyPortal = lazy(() => import('./pages/FacultyPortal').then((module) => ({ default: module.FacultyPortal })));
const StudentPortal = lazy(() => import('./pages/StudentPortal').then((module) => ({ default: module.StudentPortal })));

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppearanceProvider>
        <Suspense fallback={<main className="grid min-h-screen place-items-center bg-white dark:bg-slate-950" aria-label="Loading EduSphere"><span className="size-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></main>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PublicInfoPage page="privacy" />} />
          <Route path="/terms" element={<PublicInfoPage page="terms" />} />
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* First Login Password Reset */}
          <Route path="/reset-first-password" element={<ResetFirstPasswordPage />} />

          {/* Protected Admin Portal */}
          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']} />}>
            <Route path="/admin/*" element={<AdminPortal />} />
          </Route>

          {/* Protected Faculty Portal */}
          <Route element={<ProtectedRoute allowedRoles={['HOD', 'CLASS_INCHARGE', 'FACULTY']} />}>
            <Route path="/faculty/*" element={<FacultyPortal />} />
          </Route>

          {/* Protected Student Portal */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route path="/student/*" element={<StudentPortal />} />
          </Route>

          {/* Default Fallback Redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
        </AppearanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
