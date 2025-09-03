import React, { createContext, useContext } from 'react';

const EventContext = createContext();

export const EventProvider = ({ children }) => {
  const value = {
    // Placeholder pour les fonctions d'événements
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
};
