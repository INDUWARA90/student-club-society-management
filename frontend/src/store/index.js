import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import clubsReducer from '../features/clubs/clubsSlice'
import eventsReducer from '../features/events/eventsSlice'
import themeReducer from '../features/theme/themeSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    clubs: clubsReducer,
    events: eventsReducer,
    theme: themeReducer,
  },
})
