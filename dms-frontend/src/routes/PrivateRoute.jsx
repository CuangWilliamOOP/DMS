import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isLoggedIn } from '../utils/auth';

/* blocks access when no token */
export default function PrivateRoute() {
  return isLoggedIn() ? <Outlet /> : <Navigate to="/login" replace />;
}

/* optional: stops logged-in users from revisiting /login */
export function PublicRoute() {
  return isLoggedIn() ? <Navigate to="/home" replace /> : <Outlet />;
}
