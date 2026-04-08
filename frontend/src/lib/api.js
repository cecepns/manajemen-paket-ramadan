import axios from 'axios'
import API_BASE_URL from '../utils/apiBaseUrl'

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')?.trim()
  if (token) {
    config.headers = config.headers || {}
    if (typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`)
    } else {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export default api
