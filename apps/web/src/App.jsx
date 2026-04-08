import { useAuth } from './context/AuthContext.jsx';
import { FullPageLoader } from './components/Spinner.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MainApp from './pages/MainApp.jsx';

export default function App() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <LoginPage />;
  return <MainApp />;
}
