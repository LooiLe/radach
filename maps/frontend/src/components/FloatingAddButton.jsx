import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './FloatingAddButton.css';

export default function FloatingAddButton() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!isAuthenticated) return null;
  if (['/add-spot', '/add-event', '/onboarding'].includes(location.pathname)) return null;

  return (
    <div className={`fab-container ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <div className="fab-menu">
          <button 
            className="fab-item" 
            onClick={() => { setIsOpen(false); navigate('/add-event'); }}
          >
            Add Event 📅
          </button>
          <button 
            className="fab-item" 
            onClick={() => { setIsOpen(false); navigate('/add-spot'); }}
          >
            Add Spot 📍
          </button>
          <button 
            className="fab-item" 
            onClick={() => { setIsOpen(false); navigate('/add-journey'); }}
          >
            Add Experience 🥾
          </button>
        </div>
      )}
      <button 
        className="fab btn-primary" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle add menu"
      >
        <span className="fab-icon">+</span>
      </button>
    </div>
  );
}
