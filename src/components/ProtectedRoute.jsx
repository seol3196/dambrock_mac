import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import FirebaseNotice from './FirebaseNotice.jsx';
import LoadingScreen from './LoadingScreen.jsx';

function roleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  if (role === 'student') return '/student';
  return '/';
}

export default function ProtectedRoute({ allow, children }) {
  const { loading, user, role } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  if (!role) return <FirebaseNotice />;
  if (!allow.includes(role)) return <Navigate to={roleHome(role)} replace />;

  return children;
}
