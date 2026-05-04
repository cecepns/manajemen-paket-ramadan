import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('admin')
  const [form, setForm] = useState({ username: '', password: '' })

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (mode === 'admin') {
        const { data } = await api.post('/login', form)
        const token = (data?.data?.token || '').trim()
        localStorage.setItem('token', token)
        localStorage.setItem('auth_role', 'admin')
        localStorage.removeItem('reseller')
        api.defaults.headers.common.Authorization = `Bearer ${token}`
        toast.success('Login berhasil')
        navigate('/')
      } else {
        const { data } = await api.post('/reseller_login', form)
        const token = (data?.data?.token || '').trim()
        localStorage.setItem('token', token)
        localStorage.setItem('auth_role', 'reseller')
        if (data?.data?.reseller) {
          localStorage.setItem('reseller', JSON.stringify(data.data.reseller))
        }
        api.defaults.headers.common.Authorization = `Bearer ${token}`
        toast.success('Login reseller berhasil')
        navigate('/orders')
      }
    } catch {
      toast.error('Login gagal')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-slate-900 p-6">
      <form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onSubmit={submit}>
        <h1 className="mb-4 text-2xl font-bold">{mode === 'admin' ? 'Login Admin' : 'Login Reseller'}</h1>
        <div className="mb-4 flex gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-semibold ${mode === 'admin' ? 'bg-white shadow' : 'text-slate-600'}`}
            onClick={() => setMode('admin')}
          >
            Admin
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-semibold ${mode === 'reseller' ? 'bg-white shadow' : 'text-slate-600'}`}
            onClick={() => setMode('reseller')}
          >
            Reseller
          </button>
        </div>
        <input
          className="mb-3 w-full rounded-lg border p-3"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          type="password"
          className="mb-4 w-full rounded-lg border p-3"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white">Masuk</button>
      </form>
    </div>
  )
}
