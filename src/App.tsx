import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorTracking } from './lib/observability/errorTracking';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { WorkspaceShell } from './components/WorkspaceShell';
import { Unauthorized } from './pages/Unauthorized';
import { LoaderCircle } from 'lucide-react';
import { QueryClientProvider } from './lib/serverState';

// Dynamic lazy imports for admin, mentor, and complex feature pages
const AdminCourses = lazy(() => import('./pages/AdminCourses').then((m) => ({ default: m.AdminCourses })));
const AdminOperations = lazy(() => import('./pages/AdminOperations').then((m) => ({ default: m.AdminOperations })));
const ReviewSubmissions = lazy(() => import('./pages/ReviewSubmissions').then((m) => ({ default: m.ReviewSubmissions })));
const MentorDashboard = lazy(() => import('./pages/MentorDashboard').then((m) => ({ default: m.MentorDashboard })));
const MentorStudents = lazy(() => import('./pages/MentorStudents').then((m) => ({ default: m.MentorStudents })));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const CommunityHub = lazy(() => import('./pages/CommunityHub').then((m) => ({ default: m.CommunityHub })));
const WorkshopsPage = lazy(() => import('./pages/WorkshopsPage').then((m) => ({ default: m.WorkshopsPage })));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate').then((m) => ({ default: m.VerifyCertificate })));

// Accessible fallback loader matching design system
function PageLoadingFallback() {
  return (
    <div
      data-testid="page-loading-fallback"
      className="flex min-h-[60vh] w-full flex-col items-center justify-center p-8 text-center"
      aria-label="Loading module"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 mb-3 animate-pulse">
        <LoaderCircle size={24} className="animate-spin text-orange-500" />
      </div>
      <p className="text-xs font-bold text-slate-500">Loading module...</p>
    </div>
  );
}

// Initialize production observability & error tracking
initErrorTracking();

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <SidebarProvider>
                <BrowserRouter>
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    <Route path="/verify-certificate" element={<VerifyCertificate />} />
                    <Route path="/credentials/:certificateNumber" element={<VerifyCertificate />} />
                    <Route path="/credentials" element={<VerifyCertificate />} />
                    <Route path="/" element={<Home />} />

                    {/* Protected Student / Mentor Routes */}
                    <Route
                      path="/student/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <StudentDashboard />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/community"
                      element={
                        <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <CommunityHub />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/messages"
                      element={
                        <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <CommunityHub />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/workshops"
                      element={
                        <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <WorkshopsPage />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/courses"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <AdminCourses />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/mentor"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <MentorDashboard />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/mentor/students"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <MentorStudents />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/review/submissions"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <ReviewSubmissions />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <AdminOperations />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/operations"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <WorkspaceShell>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <AdminOperations />
                            </Suspense>
                          </WorkspaceShell>
                        </ProtectedRoute>
                      }
                    />

                    {/* Fallback */}
                    <Route
                      path="*"
                      element={
                        <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center">
                          <div>
                            <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-500">404</p>
                            <h1 className="mt-3 text-4xl font-black text-slate-950">That frame is missing.</h1>
                            <a href="/" className="mt-6 inline-block text-sm font-bold text-orange-600">
                              Back to home
                            </a>
                          </div>
                        </div>
                      }
                    />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </SidebarProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
}

export default App;