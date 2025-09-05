// src/components/common/Layout/AdminLayout.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const AdminLayout = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="container-guild">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gradient-guild">GUILD Admin</h1>
            </div>
            <nav className="hidden md:flex space-x-6">
              <a href="/admin/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-guild-600">Dashboard</a>
              <a href="/admin/users" className="text-gray-600 dark:text-gray-300 hover:text-guild-600">Users</a>
              <a href="/admin/events" className="text-gray-600 dark:text-gray-300 hover:text-guild-600">Events</a>
              <a href="/admin/finance" className="text-gray-600 dark:text-gray-300 hover:text-guild-600">Finance</a>
            </nav>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Admin: {user?.fullName}
              </span>
              <button onClick={logout} className="btn-outline-guild">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-guild py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout