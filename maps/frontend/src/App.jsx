import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import FloatingAddButton from './components/FloatingAddButton'
import BrowserDialogProvider from './components/BrowserDialogProvider'
import { ToastProvider } from './components/ToastProvider'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SpotsPage from './pages/SpotsPage'
import SpotDetailPage from './pages/SpotDetailPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import FriendsPage from './pages/FriendsPage'
import NotificationsPage from './pages/NotificationsPage'
import UserProfilePage from './pages/UserProfilePage'
import SavedSpotsPage from './pages/SavedSpotsPage'
import FeedPage from './pages/FeedPage'
import AddSpotPage from './pages/AddSpotPage'
import SearchPage from './pages/SearchPage'
import DirectionsPage from './pages/DirectionsPage'
import EventsPage from './pages/EventsPage'
import AddEventPage from './pages/AddEventPage'
import EventDetailPage from './pages/EventDetailPage'
import AddJourneyPage from './pages/AddJourneyPage'
import JourneyDetailPage from './pages/JourneyDetailPage'
import MyItinerariesPage from './pages/MyItinerariesPage'
import ItineraryPlannerPage from './pages/ItineraryPlannerPage'
import ItineraryDetailPage from './pages/ItineraryDetailPage'
import ItinerarySharePage from './pages/ItinerarySharePage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import OnboardingPage from './pages/OnboardingPage'

export default function App() {
  return (
    <ToastProvider>
      <BrowserDialogProvider>
        <Navbar />

       <Routes>
         <Route path="/" element={<ProtectedRoute><SpotsPage /></ProtectedRoute>} />
         <Route path="/login" element={<LoginPage />} />
         <Route path="/register" element={<RegisterPage />} />
          <Route path="/discover" element={<ProtectedRoute><SpotsPage /></ProtectedRoute>} />
         <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
         <Route path="/saved" element={<ProtectedRoute><SavedSpotsPage /></ProtectedRoute>} />
         <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
         <Route path="/user/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
         <Route path="/spot/:id" element={<ProtectedRoute><SpotDetailPage /></ProtectedRoute>} />
         <Route path="/directions" element={<ProtectedRoute><DirectionsPage /></ProtectedRoute>} />
         <Route path="/directions/:id" element={<ProtectedRoute><DirectionsPage /></ProtectedRoute>} />
          <Route path="/spot/:id/add-journey" element={<ProtectedRoute><AddJourneyPage /></ProtectedRoute>} />
          <Route path="/add-journey" element={<ProtectedRoute><AddJourneyPage /></ProtectedRoute>} />
          <Route path="/journey/:id/edit" element={<ProtectedRoute><AddJourneyPage /></ProtectedRoute>} />
          <Route path="/journey/:id" element={<ProtectedRoute><JourneyDetailPage /></ProtectedRoute>} />
         <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
         <Route path="/event/:id" element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>} />
         <Route path="/add-spot" element={<ProtectedRoute><AddSpotPage /></ProtectedRoute>} />
         <Route path="/add-event" element={<ProtectedRoute><AddEventPage /></ProtectedRoute>} />
         <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
         <Route path="/itineraries" element={<ProtectedRoute><MyItinerariesPage /></ProtectedRoute>} />
         <Route path="/itineraries/plan" element={<ProtectedRoute><ItineraryPlannerPage /></ProtectedRoute>} />
         <Route path="/itineraries/:id" element={<ProtectedRoute><ItineraryDetailPage /></ProtectedRoute>} />
         <Route path="/itineraries/share/:shareToken" element={<ItinerarySharePage />} />
          <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
       </Routes>
      <FloatingAddButton />
     </BrowserDialogProvider>
    </ToastProvider>
  )
}
