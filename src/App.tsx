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
import Calendar from './pages/Calendar';
import TwoFactorSetup from './pages/TwoFactorSetup';
import Login from './pages/Login';

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
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setRole(userSnap.data().role);
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
          <Route path="calendar" element={<ProtectedRoute allowedRoles={['editor', 'senior-editor', 'admin', 'super-admin']}><Calendar /></ProtectedRoute>} />
          <Route path="brand" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><BrandSettings /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><CompanySettings /></ProtectedRoute>} />
          <Route path="publish/:storyId" element={<ProtectedRoute allowedRoles={['senior-editor', 'admin', 'super-admin']}><Publish /></ProtectedRoute>} />
          <Route path="logs" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><AuditLogs /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute allowedRoles={['admin', 'super-admin']}><Admin /></ProtectedRoute>} />
          <Route path="security" element={<TwoFactorSetup />} />
        </Route>
      </Routes>
    </Router>
  );
}
