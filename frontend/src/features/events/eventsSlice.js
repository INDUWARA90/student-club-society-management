import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const fetchEvents = createAsyncThunk('events/fetchEvents', async (clubId, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/events', { params: clubId ? { clubId } : {} })
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const createEvent = createAsyncThunk(
  'events/createEvent',
  async ({ clubId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/clubs/${clubId}/events`, payload)
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

const eventsSlice = createSlice({
  name: 'events',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEvents.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        if (action.payload.approvalStatus !== 'PENDING' && action.payload.approvalStatus !== 'REJECTED') {
          state.items.push(action.payload)
        }
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.error = action.payload
      })
  },
})

export default eventsSlice.reducer
