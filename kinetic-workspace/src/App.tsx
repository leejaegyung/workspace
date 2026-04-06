import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { loadAndApplyTheme } from './lib/theme';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0e0e0e] text-white">
          <p className="text-on-surface-variant text-sm">렌더링 오류가 발생했습니다.</p>
          <button
            onClick={() => { this.setState({ error: null }); window.history.back(); }}
            className="text-primary font-bold hover:underline text-sm"
          >
            뒤로 가기
          </button>
          <details className="text-xs text-on-surface-variant/40 max-w-md text-center">
            <summary>오류 상세</summary>
            <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppProvider } from './contexts/AppContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Board } from './pages/Board';
import { ProjectDetail } from './pages/ProjectDetail';
import { ProjectBoard } from './pages/ProjectBoard';
import { Chat } from './pages/Chat';
import { Storage } from './pages/Storage';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Apply saved theme on every page load
function ThemeApplier() {
  useEffect(() => { loadAndApplyTheme(); }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <ThemeApplier />
        <AppProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectDetail /></Layout></ProtectedRoute>} />
              <Route path="/projects/:id/board" element={<ProtectedRoute><Layout><ProjectBoard /></Layout></ProtectedRoute>} />
              <Route path="/board" element={<ProtectedRoute><Layout><Board /></Layout></ProtectedRoute>} />
              <Route path="/chat"     element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
              <Route path="/storage"  element={<ProtectedRoute><Layout><Storage /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Global toast notifications */}
            <ToastContainer />
          </Router>
        </AppProvider>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
