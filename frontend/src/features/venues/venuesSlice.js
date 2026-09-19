import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const fetchVenues = createAsyncThunk('venues/fetchVenues', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/venues')
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const createVenue = createAsyncThunk('venues/createVenue', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/venues', payload)
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const updateVenue = createAsyncThunk(
  'venues/updateVenue',
  async ({ venueId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/venues/${venueId}`, payload)
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const deactivateVenue = createAsyncThunk(
  'venues/deactivateVenue',
  async (venueId, { rejectWithValue }) => {
    try {
      await api.delete(`/venues/${venueId}`)
      return venueId
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const fetchVenueUtilization = createAsyncThunk(
  'venues/fetchVenueUtilization',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/venues/utilization')
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

const venuesSlice = createSlice({
  name: 'venues',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
    utilization: [],
    utilizationStatus: 'idle',
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVenues.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchVenues.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchVenues.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(createVenue.fulfilled, (state, action) => {
        state.items.push(action.payload)
      })
      .addCase(updateVenue.fulfilled, (state, action) => {
        const index = state.items.findIndex((v) => v.id === action.payload.id)
        if (index !== -1) state.items[index] = action.payload
      })
      .addCase(deactivateVenue.fulfilled, (state, action) => {
        state.items = state.items.filter((v) => v.id !== action.payload)
      })
      .addCase(fetchVenueUtilization.pending, (state) => {
        state.utilizationStatus = 'loading'
      })
      .addCase(fetchVenueUtilization.fulfilled, (state, action) => {
        state.utilizationStatus = 'succeeded'
        state.utilization = action.payload
      })
      .addCase(fetchVenueUtilization.rejected, (state) => {
        state.utilizationStatus = 'failed'
      })
  },
})

export default venuesSlice.reducer
