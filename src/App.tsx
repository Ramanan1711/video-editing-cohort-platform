import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { StudentDashboard } from './pages/StudentDashboard';
import { Home } from './pages/Home';
import { AdminCourses } from './pages/AdminCourses';
import { ReviewSubmissions } from './pages/ReviewSubmissions';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Home />} />
          
          {/* Protected Student Routes */}
          <Route 
            path="/student/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/admin/courses"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminCourses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review/submissions"
            element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}>
                <ReviewSubmissions />
              </ProtectedRoute>
            }
          />
          
          {/* Fallback */}
          <Route path="*" element={<div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-8 text-center"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-orange-500">404</p><h1 className="mt-3 text-4xl font-black text-slate-950">That frame is missing.</h1><a href="/" className="mt-6 inline-block text-sm font-bold text-orange-600">Back to home</a></div></div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;