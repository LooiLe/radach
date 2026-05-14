import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './FloatingAddButton.css';

export default function FloatingAddButton() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) return null;
  if (location.pathname === '/add-spot') return null;

  return (
    <button 
      className="fab btn-primary" 
      onClick={() => navigate('/add-spot')}
      aria-label="Add new spot"
    >
      <span className="fab-icon">+</span>
    </button>
  );
}
