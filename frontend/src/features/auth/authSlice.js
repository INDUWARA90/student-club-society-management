import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import api from '../../api/axios'

const storedToken = localStorage.getItem('accessToken')
const storedUser = localStorage.getItem('user')

const initialState = {
  token: storedToken || null,
  user: storedUser ? JSON.parse(storedUser) : null,
  status: 'idle',
  error: null,
}

function persist(token, user) {
  localStorage.setItem('accessToken', token)
  localStorage.setItem('user', JSON.stringify(user))
}

function extractErrorMessage(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.'
}

export const register = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/register', payload)
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', payload)
    return data
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (payload, { rejectWithValue }) => {
    try {
      await api.post('/auth/forgot-password', payload)
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (payload, { rejectWithValue }) => {
    try {
      await api.post('/auth/reset-password', payload)
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const verifyEmail = createAsyncThunk('auth/verifyEmail', async (token, { rejectWithValue }) => {
  try {
    await api.post('/auth/verify-email', { token })
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error))
  }
})

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/auth/resend-verification')
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/auth/me/profile', payload)
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

export const updateProfileImage = createAsyncThunk(
  'auth/updateProfileImage',
  async (profileImageB64, { rejectWithValue }) => {
    try {
      const { data } = await api.put('/auth/me/profile-image', { profileImageB64 })
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error))
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null
      state.user = null
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
    },
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.token = action.payload.accessToken
        state.user = action.payload.user
        persist(action.payload.accessToken, action.payload.user)
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.token = action.payload.accessToken
        state.user = action.payload.user
        persist(action.payload.accessToken, action.payload.user)
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(forgotPassword.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.status = 'succeeded'
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(resetPassword.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = 'succeeded'
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload
        localStorage.setItem('user', JSON.stringify(action.payload))
      })
      .addCase(updateProfileImage.fulfilled, (state, action) => {
        state.user = action.payload
        localStorage.setItem('user', JSON.stringify(action.payload))
      })
  },
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
