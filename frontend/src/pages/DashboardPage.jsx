import { useEffect, useState } from 'react'
import { Box, Users, ShoppingBag, Wallet } from 'lucide-react'
import api from '../lib/api'

export default function DashboardPage() {
  const [stats, setStats] = useState({})
  const isReseller = localStorage.getItem('auth_role') === 'reseller'

  useEffect(() => {
    api.get('/dashboard.php').then((r) => setStats(r.data.data || {}))
  }, [])

  if (isReseller) {
    return (
      <div>
        <h1 className="mb-5 text-2xl font-bold text-slate-800">Dashboard Reseller</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 inline-flex rounded-xl bg-amber-50 p-2 text-amber-600"><ShoppingBag size={18} /></div>
            <p className="text-sm text-slate-500">Total order Anda</p>
            <p className="text-2xl font-bold text-slate-800">{stats.orders || 0}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 inline-flex rounded-xl bg-rose-50 p-2 text-rose-600"><Wallet size={18} /></div>
            <p className="text-sm text-slate-500">Nilai order (omzet)</p>
            <p className="text-2xl font-bold text-slate-800">Rp {(stats.revenue || 0).toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 inline-flex rounded-xl bg-brand-50 p-2 text-brand-600"><Box size={18} /></div>
          <p className="text-sm text-slate-500">Total Produk</p>
          <p className="text-2xl font-bold text-slate-800">{stats.products || 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600"><Users size={18} /></div>
          <p className="text-sm text-slate-500">Total Reseller</p>
          <p className="text-2xl font-bold text-slate-800">{stats.resellers || 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 inline-flex rounded-xl bg-amber-50 p-2 text-amber-600"><ShoppingBag size={18} /></div>
          <p className="text-sm text-slate-500">Total Order</p>
          <p className="text-2xl font-bold text-slate-800">{stats.orders || 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 inline-flex rounded-xl bg-rose-50 p-2 text-rose-600"><Wallet size={18} /></div>
          <p className="text-sm text-slate-500">Omzet</p>
          <p className="text-2xl font-bold text-slate-800">Rp {(stats.revenue || 0).toLocaleString('id-ID')}</p>
        </div>
      </div>
    </div>
  )
}
