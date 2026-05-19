import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import FloatingAddButton from './components/FloatingAddButton'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SpotsPage from './pages/SpotsPage'
import TrendingPage from './pages/TrendingPage'
import SpotDetailPage from './pages/SpotDetailPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import FriendsPage from './pages/FriendsPage'
import UserProfilePage from './pages/UserProfilePage'
import SavedSpotsPage from './pages/SavedSpotsPage'
import FeedPage from './pages/FeedPage'
import AddSpotPage from './pages/AddSpotPage'
import SearchPage from './pages/SearchPage'
import DirectionsPage from './pages/DirectionsPage'

export default function App() {
  return (
    <>
      <Navbar />
       <Routes>
         <Route path="/" element={<LandingPage />} />
         <Route path="/login" element={<LoginPage />} />
         <Route path="/register" element={<RegisterPage />} />
         <Route path="/spots" element={<ProtectedRoute><SpotsPage /></ProtectedRoute>} />
         <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
         <Route path="/trending" element={<ProtectedRoute><TrendingPage /></ProtectedRoute>} />
         <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
         <Route path="/saved" element={<ProtectedRoute><SavedSpotsPage /></ProtectedRoute>} />
         <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
         <Route path="/user/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
         <Route path="/spot/:id" element={<ProtectedRoute><SpotDetailPage /></ProtectedRoute>} />
         <Route path="/directions" element={<ProtectedRoute><DirectionsPage /></ProtectedRoute>} />
         <Route path="/directions/:id" element={<ProtectedRoute><DirectionsPage /></ProtectedRoute>} />
         <Route path="/add-spot" element={<ProtectedRoute><AddSpotPage /></ProtectedRoute>} />
         <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
       </Routes>
      <FloatingAddButton />
    </>
  )
}
