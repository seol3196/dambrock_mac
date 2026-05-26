import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import StudentPage from './pages/StudentPage.jsx';
import TeacherPage from './pages/TeacherPage.jsx';
import WallPage from './pages/WallPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={['admin']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allow={['teacher']}>
            <TeacherPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute allow={['student']}>
            <StudentPage />
          </ProtectedRoute>
        }
      />
      <Route path="/wall/:wallId" element={<WallPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
