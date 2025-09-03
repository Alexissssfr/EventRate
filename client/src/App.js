import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext';
import PrivateRoute from './components/auth/PrivateRoute';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Profile from './pages/Profile';
import EventList from './pages/events/EventList';
import EventDetail from './pages/events/EventDetail';
import EventCreate from './pages/events/EventCreate';
import EventEdit from './pages/events/EventEdit';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <EventProvider>
        <div className="App min-h-screen bg-gray-50">
          <Routes>
            {/* Routes publiques */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="events" element={<EventList />} />
              <Route path="events/:id" element={<EventDetail />} />
              <Route path="profile/:username" element={<Profile />} />
              
              {/* Routes privées */}
              <Route path="profile" element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              } />
              <Route path="events/create" element={
                <PrivateRoute>
                  <EventCreate />
                </PrivateRoute>
              } />
              <Route path="events/:id/edit" element={
                <PrivateRoute>
                  <EventEdit />
                </PrivateRoute>
              } />
            </Route>
            
            {/* Route 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </EventProvider>
    </AuthProvider>
  );
}

export default App;
