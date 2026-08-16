import { createContext, useContext } from 'react';

const NotificationDataContext = createContext({
  unreadCount: 0,
  lastNotification: null,
  notifications: [],
  connected: false,
  initialized: true,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  deleteNotification: async () => {},
});

export function NotificationProvider({ children }) {
  return (
    <NotificationDataContext.Provider
      value={{
        unreadCount: 0,
        lastNotification: null,
        notifications: [],
        connected: false,
        initialized: true,
        refresh: async () => {},
        markRead: async () => {},
        markAllRead: async () => {},
        deleteNotification: async () => {},
      }}
    >
      {children}
    </NotificationDataContext.Provider>
  );
}

export function useNotificationData() {
  return useContext(NotificationDataContext);
}
