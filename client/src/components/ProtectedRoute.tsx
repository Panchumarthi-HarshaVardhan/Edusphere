import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleType } from '../types/auth';

interface ProtectedRouteProps {
  allowedRoles?: RoleType[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Verifying EduSphere credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If first login password reset is mandatory, force redirect
  if (user.mustResetPassword) {
    return <Navigate to="/reset-first-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to matching portal or unauthorized
    if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return <Navigate to="/admin" replace />;
    }
    if (['HOD', 'CLASS_INCHARGE', 'FACULTY'].includes(user.role)) {
      return <Navigate to="/faculty" replace />;
    }
    return <Navigate to="/student" replace />;
  }

  return <Outlet />;
};
