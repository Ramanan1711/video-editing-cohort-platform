import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorTracking } from './lib/observability/errorTracking';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { StudentDashboard } from './pages/StudentDashboard';
import { Home } from './pages/Home';
import { AdminCourses } from './pages/AdminCourses';
import { ReviewSubmissions } from './pages/ReviewSubmissions';
import { MentorDashboard } from './pages/MentorDashboard';
import { MentorStudents } from './pages/MentorStudents';
import { AdminOperations } from './pages/AdminOperations';
import { WorkspaceShell } from './components/WorkspaceShell';
import { Unauthorized } from './pages/Unauthorized';

// Initialize production observability & error tracking
initErrorTracking();

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<Home />} />
            
            {/* Protected Student / Mentor Routes */}
            <Route 
              path="/student/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <WorkspaceShell><AdminCourses /></WorkspaceShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mentor"
              element={
                <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                  <WorkspaceShell><MentorDashboard /></WorkspaceShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mentor/students"
              element={
                <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                  <WorkspaceShell><MentorStudents /></WorkspaceShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/review/submissions"
              element={
                <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                  <WorkspaceShell><ReviewSubmissions /></WorkspaceShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <WorkspaceShell><AdminOperations /></WorkspaceShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/operations"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <WorkspaceShell><AdminOperations /></WorkspaceShell>
                </ProtectedRoute>
              }
            />
            
            {/* Fallback */}
            <Route path="*" element={<div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-orange-500">404</p><h1 className="mt-3 text-4xl font-black text-slate-950">That frame is missing.</h1><a href="/" className="mt-6 inline-block text-sm font-bold text-orange-600">Back to home</a></div></div>} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;