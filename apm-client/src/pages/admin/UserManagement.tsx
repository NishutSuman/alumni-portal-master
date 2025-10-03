// src/pages/admin/UserManagement.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import {
  useGetAllUsersQuery,
  useUpdateUserRoleMutation,
  useGetVerificationStatsQuery,
  useVerifyUserMutation,
  useRejectUserMutation,
  useBulkVerifyUsersMutation,
} from '@/store/api/adminApi';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';

interface FilterState {
  search: string;
  batch: string;
  status: 'all' | 'email_pending' | 'email_verified' | 'alumni_verified' | 'rejected';
  role: 'all' | 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN';
}

// Helper function to get status badge
const getStatusBadge = (status: string) => {
  const statusConfig = {
    email_pending: { text: 'Email Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
    email_verified: { text: 'Email Verified', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
    alumni_verified: { text: 'Alumni Verified', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    rejected: { text: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.email_pending;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.text}
    </span>
  );
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    batch: '',
    status: 'all',
    role: 'all'
  });

  // API Queries
  const {
    data: userData,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers
  } = useGetAllUsersQuery({
    page: currentPage,
    limit: 20,
    search: filters.search || undefined,
    batch: filters.batch ? parseInt(filters.batch) : undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
    role: filters.role !== 'all' ? filters.role : undefined,
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError
  } = useGetVerificationStatsQuery({ timeframe: 30 });

  // API Mutations
  const [updateUserRole, { isLoading: updatingRole }] = useUpdateUserRoleMutation();
  const [verifyUser, { isLoading: verifyingUser }] = useVerifyUserMutation();
  const [rejectUser, { isLoading: rejectingUser }] = useRejectUserMutation();
  const [bulkVerifyUsers, { isLoading: bulkVerifying }] = useBulkVerifyUsersMutation();

  // Handle role update
  const handleRoleUpdate = async (userId: string, newRole: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN') => {
    // Find the user to get their name for the confirmation
    const user = users?.find(u => u.id === userId);
    const userName = user?.fullName || 'this user';
    const currentRole = user?.role || 'USER';
    
    // Show confirmation prompt
    const roleLabels = {
      'USER': 'Regular User',
      'BATCH_ADMIN': 'Batch Admin', 
      'SUPER_ADMIN': 'Super Admin'
    };
    
    const confirmed = confirm(
      `Are you sure you want to change ${userName}'s role from "${roleLabels[currentRole]}" to "${roleLabels[newRole]}"?\n\nThis action will:\n- Update their permissions immediately\n- Send them a notification about the role change\n- Cannot be undone without another manual change`
    );
    
    if (!confirmed) {
      return; // User cancelled
    }
    
    try {
      await updateUserRole({ userId, role: newRole }).unwrap();
      refetchUsers();
      alert(`✅ Successfully updated ${userName}'s role to ${roleLabels[newRole]}`);
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert(`❌ Failed to update user role: ${error?.data?.message || 'Unknown error'}`);
    }
  };

  // Handle user verification
  const handleVerifyUser = async (userId: string, notes?: string) => {
    try {
      await verifyUser({ userId, notes }).unwrap();
      refetchUsers();
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } catch (error) {
      console.error('Failed to verify user:', error);
    }
  };

  // Handle user rejection
  const handleRejectUser = async (userId: string, reason: string) => {
    try {
      await rejectUser({ userId, reason }).unwrap();
      refetchUsers();
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } catch (error) {
      console.error('Failed to reject user:', error);
    }
  };

  // Handle user unblock (remove from blacklist)
  const handleUnblockUser = async (userId: string, userEmail: string) => {
    try {
      if (!confirm(`Are you sure you want to unblock ${userEmail}? This will remove them from the blacklist and reset their verification status to pending.`)) {
        return;
      }
      
      // Call the new unblock endpoint
      const response = await api.post(`/admin/verification/users/${userId}/unblock`, {
        reason: 'Admin decided to unblock user for re-verification'
      });
      
      if (response.data.success) {
        refetchUsers();
        alert('✅ User has been unblocked successfully! They have been removed from blacklist and reset to pending verification. Admin can now approve or reject them again.');
      } else {
        console.error('Failed to unblock user:', response.data);
        alert(`❌ Failed to unblock user: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to unblock user:', error);
      const message = error?.response?.data?.message || 'Failed to unblock user';
      alert(`❌ ${message}`);
    }
  };

  // Handle bulk verification
  const handleBulkVerify = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      await bulkVerifyUsers({ 
        userIds: selectedUsers, 
        notes: 'Bulk verification by admin' 
      }).unwrap();
      refetchUsers();
      setSelectedUsers([]);
    } catch (error) {
      console.error('Failed to bulk verify users:', error);
    }
  };

  // Handle user selection (only email_verified users can be bulk verified)
  const toggleUserSelection = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user && user.userStatus === 'email_verified') {
      setSelectedUsers(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  // Handle select all (only email_verified users)
  const toggleSelectAll = () => {
    const users = userData?.users || [];
    const emailVerifiedUsers = users.filter(user => user.userStatus === 'email_verified');
    
    if (selectedUsers.length === emailVerifiedUsers.length && emailVerifiedUsers.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(emailVerifiedUsers.map(user => user.id));
    }
  };

  // Loading state
  if (usersLoading || statsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (usersError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-300">
                Failed to load user data
              </h3>
              <p className="text-red-600 dark:text-red-400 mt-1">
                Please check your connection and try again.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchUsers()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const users = userData?.users || [];
  const pagination = userData?.pagination;
  const stats = statsData;


  return (
    <div className="p-6 space-y-8 overflow-visible">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all user accounts, roles, and verification status
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && !statsError && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <ClockIcon className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 dark:text-yellow-400" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.pending?.total?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Approved</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.processed?.approved?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <XCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Rejected</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.processed?.rejected?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <UserIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.processed?.total?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700 overflow-visible">
        <div className="space-y-4 overflow-visible">
          {/* Search Input - Full width on mobile */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 pr-4 py-3 w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Dropdowns - Grid layout for mobile with proper overflow handling */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 overflow-visible relative">
            <select
              value={filters.batch}
              onChange={(e) => setFilters(prev => ({ ...prev, batch: e.target.value }))}
              className="px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Batches</option>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="email_pending">Email Pending</option>
              <option value="email_verified">Email Verified</option>
              <option value="alumni_verified">Alumni Verified</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value as any }))}
              className="px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Roles</option>
              <option value="USER">User</option>
              <option value="BATCH_ADMIN">Batch Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-blue-800 dark:text-blue-300">
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkVerify}
                  disabled={bulkVerifying}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {bulkVerifying ? 'Verifying...' : 'Bulk Verify'}
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={users.filter(u => u.userStatus === 'email_verified').length > 0 && selectedUsers.length === users.filter(u => u.userStatus === 'email_verified').length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Batch
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Registered
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <UserIcon className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No users found
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        No users match the current filter criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-3 sm:px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      disabled={user.userStatus !== 'email_verified'}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-8 sm:h-10 w-8 sm:w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <UserIcon className="h-4 sm:h-6 w-4 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.fullName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </div>
                        {/* Show batch, date, and role on mobile under user info */}
                        <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Batch {user.batch} • {new Date(user.registeredAt).toLocaleDateString()}
                        </div>
                        {/* Mobile role change */}
                        {currentUser?.role === 'SUPER_ADMIN' && (
                          <div className="lg:hidden mt-2">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleUpdate(user.id, e.target.value as any)}
                              disabled={user.userStatus !== 'alumni_verified' || updatingRole}
                              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="USER">User</option>
                              <option value="BATCH_ADMIN">Batch Admin</option>
                              <option value="SUPER_ADMIN">Super Admin</option>
                            </select>
                          </div>
                        )}
                        {currentUser?.role === 'BATCH_ADMIN' && (
                          <div className="lg:hidden mt-2 text-xs text-gray-600 dark:text-gray-400">
                            Role: {user.role.replace('_', ' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {user.batch}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.registeredAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    {getStatusBadge(user.userStatus)}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4">
                    {currentUser?.role === 'SUPER_ADMIN' ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleUpdate(user.id, e.target.value as any)}
                        disabled={user.userStatus !== 'alumni_verified' || updatingRole}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="USER">User</option>
                        <option value="BATCH_ADMIN">Batch Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    ) : (
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {user.role.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {user.userStatus === 'email_verified' && (
                        <>
                          <button
                            onClick={() => handleVerifyUser(user.id)}
                            disabled={verifyingUser}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md disabled:opacity-50"
                            title="Approve Alumni Verification"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                          {currentUser?.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleRejectUser(user.id, 'Manual rejection')}
                              disabled={rejectingUser}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md disabled:opacity-50"
                              title="Reject Alumni Verification"
                            >
                              <XCircleIcon className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                      {user.userStatus === 'rejected' && currentUser?.role === 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleUnblockUser(user.id, user.email)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                          title="Unblock User (Remove from Blacklist)"
                        >
                          <ShieldExclamationIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={pagination.page <= 1}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md disabled:opacity-50"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md disabled:opacity-50"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;