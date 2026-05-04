import { Navigate, Route, Routes } from 'react-router-dom'
import PropTypes from 'prop-types'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import ResellersPage from './pages/ResellersPage'
import OrdersPage from './pages/OrdersPage'
import ReportsPage from './pages/ReportsPage'
import TransactionsPage from './pages/TransactionsPage'
import PackageCategoriesPage from './pages/PackageCategoriesPage'

function AdminDashboard() {
  if (localStorage.getItem('auth_role') === 'reseller') {
    return <Navigate to="/orders" replace />
  }
  return <DashboardPage />
}

function Protected({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}
Protected.propTypes = { children: PropTypes.node.isRequired }

function AdminOnly({ children }) {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('auth_role')
  if (!token) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/orders" replace />
  return children
}
AdminOnly.propTypes = { children: PropTypes.node.isRequired }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><Layout><AdminDashboard /></Layout></Protected>} />
      <Route path="/products" element={<AdminOnly><Layout><ProductsPage /></Layout></AdminOnly>} />
      <Route path="/resellers" element={<AdminOnly><Layout><ResellersPage /></Layout></AdminOnly>} />
      <Route path="/orders" element={<Protected><Layout><OrdersPage /></Layout></Protected>} />
      <Route path="/transactions" element={<Protected><Layout><TransactionsPage /></Layout></Protected>} />
      <Route path="/package-categories" element={<AdminOnly><Layout><PackageCategoriesPage /></Layout></AdminOnly>} />
      <Route path="/reports" element={<Protected><Layout><ReportsPage /></Layout></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
