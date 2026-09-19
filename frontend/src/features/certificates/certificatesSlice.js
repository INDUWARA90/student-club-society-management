import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const fetchMyCertificates = createAsyncThunk(
  'certificates/fetchMyCertificates',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/certificates/me')
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

const certificatesSlice = createSlice({
  name: 'certificates',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyCertificates.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchMyCertificates.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchMyCertificates.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
  },
})

export default certificatesSlice.reducer
