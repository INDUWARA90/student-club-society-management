import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import clubsReducer from '../features/clubs/clubsSlice'
import membershipsReducer from '../features/clubs/membershipsSlice'
import eventsReducer from '../features/events/eventsSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import certificatesReducer from '../features/certificates/certificatesSlice'
import venuesReducer from '../features/venues/venuesSlice'
import themeReducer from '../features/theme/themeSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    clubs: clubsReducer,
    memberships: membershipsReducer,
    events: eventsReducer,
    notifications: notificationsReducer,
    certificates: certificatesReducer,
    venues: venuesReducer,
    theme: themeReducer,
  },
})
