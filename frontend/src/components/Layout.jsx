import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { LogOut, Menu, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import api from '../lib/api'

const adminMenus = [
  ['/', 'Dashboard'],
  ['/products', 'Produk'],
  ['/package-categories', 'Kategori Paket'],
  ['/resellers', 'Reseller'],
  ['/orders', 'Order'],
  ['/transactions', 'Transaksi'],
  ['/reports', 'Laporan'],
]

const resellerMenus = [
  ['/orders', 'Order saya'],
  ['/transactions', 'Transaksi'],
  ['/reports', 'Laporan'],
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = typeof window !== 'undefined' ? localStorage.getItem('auth_role') : 'admin'
  const menus = useMemo(() => (role === 'reseller' ? resellerMenus : adminMenus), [role])
  const brandTitle = role === 'reseller' ? 'Reseller' : 'Ramadhan Admin'

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('reseller')
    delete api.defaults.headers.common.Authorization
    navigate('/login')
  }

  const onNavigate = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup sidebar"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 p-4 text-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link to={role === 'reseller' ? '/orders' : '/'} className="block text-xl font-semibold" onClick={onNavigate}>
            {brandTitle}
          </Link>
          <button className="rounded p-1 hover:bg-slate-800 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-2">
          {menus.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 ${isActive ? 'bg-brand-600' : 'hover:bg-slate-800'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="p-4 lg:ml-60 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={16} /> Menu
          </button>
          <p className="hidden text-sm text-slate-500 lg:block">{menus.find((item) => item[0] === location.pathname)?.[1] || 'Dashboard'}</p>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700">
            <LogOut size={16} /> Logout
          </button>
        </div>
        {children}
      </main>
    </div>
  )
}

Layout.propTypes = { children: PropTypes.node.isRequired }
