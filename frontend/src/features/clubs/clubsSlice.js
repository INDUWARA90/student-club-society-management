import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const fetchClubs = createAsyncThunk('clubs/fetchClubs', async (category, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/clubs', { params: category ? { category } : {} })
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const createClub = createAsyncThunk('clubs/createClub', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/clubs', payload)
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const joinClub = createAsyncThunk('clubs/joinClub', async (clubId, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/clubs/${clubId}/join`)
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const fetchMyMemberships = createAsyncThunk('clubs/fetchMyMemberships', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/memberships/me')
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

const clubsSlice = createSlice({
  name: 'clubs',
  initialState: {
    items: [],
    myMemberships: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClubs.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchClubs.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchClubs.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(createClub.fulfilled, (state, action) => {
        if (action.payload.status === 'APPROVED') {
          state.items.push(action.payload)
        }
      })
      .addCase(createClub.rejected, (state, action) => {
        state.error = action.payload
      })
      .addCase(joinClub.rejected, (state, action) => {
        state.error = action.payload
      })
      .addCase(fetchMyMemberships.fulfilled, (state, action) => {
        state.myMemberships = action.payload
      })
  },
})

export const { clearError } = clubsSlice.actions
export default clubsSlice.reducer
