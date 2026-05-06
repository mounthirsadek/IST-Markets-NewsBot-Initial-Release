import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewsFeed from './pages/NewsFeed';
import Editor from './pages/Editor';
import Archive from './pages/Archive';
import Admin from './pages/Admin';
import BrandSettings from './pages/BrandSettings';
import CompanySettings from './pages/CompanySettings';
import Publish from './pages/Publish';
import AuditLogs from './pages/AuditLogs';
import TwoFactorSetup from './pages/TwoFactorSetup';
import Login from './pages/Login';
import HooksEditor from './pages/HooksEditor';
import TrendingPage from './pages/TrendingPage';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, role } = useAuthStore();
  
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

export default function App() {
  const { user, setUser, setRole, role } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          // Always call bootstrap on login:
          // • Ensures FIRST_ADMIN_EMAIL gets super-admin (even if doc exists with wrong role)
          // • Creates viewer doc for brand-new users
          // • Returns existing role for everyone else (no-op)
          const idToken = await user.getIdToken();
          const bootRes = await fetch('/api/admin/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          });
          if (bootRes.ok) {
            const bootData = await bootRes.json();
            setRole(bootData.role || null);
          } else {
            // Fallback: read role directly from Firestore client SDK
            try {
              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) setRole(userSnap.data().role);
            } catch { /* silent */ }
          }
        } catch {
          // Network error fallback
          try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) setRole(userSnap.data().role);
          } catch { /* silent — role stays null */ }
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setRole]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="news" element={<ProtectedRoute allowedRoles={['editor', 'senior-editor', 'admin', 'super-admin']}><NewsFeed /></ProtectedRoute>} />
          <Route path="editor/:articleId?" element={<ProtectedRoute allowedRoles={['editor', 'senior-editor', 'admin', 'super-admin']}><Editor /></ProtectedRoute>} />
          <Route path="archive" element={<Archive />} />
          <Route path="brand" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><BrandSettings /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><CompanySettings /></ProtectedRoute>} />
          <Route path="publish/:storyId" element={<ProtectedRoute allowedRoles={['senior-editor', 'admin', 'super-admin']}><Publish /></ProtectedRoute>} />
          <Route path="logs" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><AuditLogs /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><Admin /></ProtectedRoute>} />
          <Route path="hooks/:articleId?" element={<ProtectedRoute allowedRoles={['editor', 'senior-editor', 'admin', 'super-admin']}><HooksEditor /></ProtectedRoute>} />
          <Route path="trending" element={<ProtectedRoute><TrendingPage /></ProtectedRoute>} />
          <Route path="security" element={<TwoFactorSetup />} />
        </Route>
      </Routes>
    </Router>
  );
}
