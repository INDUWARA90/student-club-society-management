import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notifications/me')
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const markNotificationRead = createAsyncThunk(
  'notifications/markNotificationRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      await api.post(`/notifications/${notificationId}/read`)
      return notificationId
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/notifications/read-all')
      return true
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    notificationReceived(state, action) {
      state.items.unshift(action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const notification = state.items.find((n) => n.id === action.payload)
        if (notification) notification.read = true
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => {
          n.read = true
        })
      })
  },
})

export const { notificationReceived } = notificationsSlice.actions
export default notificationsSlice.reducer
