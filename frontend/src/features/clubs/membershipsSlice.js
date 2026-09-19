import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const fetchClubMembers = createAsyncThunk(
  'memberships/fetchClubMembers',
  async (clubId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/clubs/${clubId}/members`)
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

const membershipsSlice = createSlice({
  name: 'memberships',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClubMembers.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchClubMembers.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchClubMembers.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
  },
})

export default membershipsSlice.reducer
