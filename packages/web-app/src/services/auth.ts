import axios from 'axios'
import { API_BASE_URL } from '../config/api'

export interface SignupRequest {
  email: string
  password: string
  name: string
  phoneNumber: string
}

export interface ConfirmSignupRequest {
  email: string
  confirmationCode: string
}

export interface SigninRequest {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

export interface User {
  username: string
  email: string
  name: string
  phoneNumber: string
}

class AuthService {
  private accessToken: string | null = null

  constructor() {
    this.accessToken = localStorage.getItem('accessToken')
  }

  async signup(data: SignupRequest): Promise<{ message: string; userId: string; status: string }> {
    const response = await axios.post(`${API_BASE_URL}/auth/signup`, data)
    return response.data
  }

  async confirmSignup(data: ConfirmSignupRequest): Promise<{ message: string; status: string }> {
    const response = await axios.post(`${API_BASE_URL}/auth/confirm`, data)
    return response.data
  }

  async signin(data: SigninRequest): Promise<AuthResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/signin`, data)
    const authData = response.data
    
    this.accessToken = authData.accessToken
    localStorage.setItem('accessToken', authData.accessToken)
    localStorage.setItem('idToken', authData.idToken)
    localStorage.setItem('refreshToken', authData.refreshToken)
    
    return authData
  }

  async verifyToken(): Promise<User> {
    if (!this.accessToken) {
      throw new Error('No access token')
    }

    const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    })
    
    return response.data
  }

  signout(): void {
    this.accessToken = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('idToken')
    localStorage.removeItem('refreshToken')
  }

  isAuthenticated(): boolean {
    return !!this.accessToken
  }

  getAccessToken(): string | null {
    return this.accessToken
  }
}

export const authService = new AuthService()