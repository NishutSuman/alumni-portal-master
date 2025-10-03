// src/pages/admin/BlacklistManagement.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldExclamationIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface BlacklistedEmail {
  id: string;
  email: string;
  reason: string;
  isActive: boolean;
  blacklistedAt: string;
  blacklistedBy: {
    id: string;
    name: string;
    role: string;
  };
  removedAt?: string;
  removedBy?: {
    id: string;
    name: string;
    role: string;
  };
  removedReason?: string;
  status: 'ACTIVE' | 'REMOVED';
  daysSinceBlacklisted: number;
}

interface BlacklistStats {
  activeBlacklist: number;
  removedFromBlacklist: number;
  totalBlacklisted: number;
  last24Hours: number;
}

const BlacklistManagement = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<BlacklistedEmail[]>([]);
  const [stats, setStats] = useState<BlacklistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<BlacklistedEmail | null>(null);
  const [newEmailData, setNewEmailData] = useState({ email: '', reason: '' });
  const [removeReason, setRemoveReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Check if user is super admin
  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Access Denied
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Only Super Admins can access blacklist management.
          </p>
        </div>
      </div>
    );
  }

  const fetchBlacklistData = async () => {
    try {
      setLoading(true);
      
      const [emailsResponse, statsResponse] = await Promise.all([
        api.get(`/admin/verification/blacklist?page=${currentPage}&limit=20&search=${searchTerm}&status=${statusFilter}`),
        api.get('/admin/verification/blacklist/stats')
      ]);

      if (emailsResponse.data.success) {
        setEmails(emailsResponse.data.data.emails);
        setTotalPages(emailsResponse.data.data.pagination.totalPages);
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data.summary);
      }
    } catch (error: any) {
      console.error('Error fetching blacklist data:', error);
      const message = error?.response?.data?.message || 'Failed to load blacklist data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlacklistData();
  }, [currentPage, searchTerm, statusFilter]);

  const handleAddToBlacklist = async () => {
    if (!newEmailData.email || !newEmailData.reason) {
      toast.error('Email and reason are required');
      return;
    }

    setProcessing(true);
    try {
      const response = await api.post('/admin/verification/blacklist', newEmailData);

      if (response.data.success) {
        toast.success('Email added to blacklist successfully');
        setShowAddModal(false);
        setNewEmailData({ email: '', reason: '' });
        fetchBlacklistData();
      } else {
        toast.error(response.data.message || 'Failed to add email to blacklist');
      }
    } catch (error: any) {
      console.error('Add to blacklist error:', error);
      const message = error?.response?.data?.message || 'Failed to add email to blacklist';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveFromBlacklist = async () => {
    if (!selectedEmail || !removeReason) {
      toast.error('Reason for removal is required');
      return;
    }

    setProcessing(true);
    try {
      const response = await api.delete(`/admin/verification/blacklist/${selectedEmail.id}`, {
        data: { reason: removeReason }
      });

      if (response.data.success) {
        toast.success('Email removed from blacklist successfully - User can now register again');
        setShowRemoveModal(false);
        setSelectedEmail(null);
        setRemoveReason('');
        fetchBlacklistData();
      } else {
        toast.error(response.data.message || 'Failed to remove email from blacklist');
      }
    } catch (error: any) {
      console.error('Remove from blacklist error:', error);
      const message = error?.response?.data?.message || 'Failed to remove email from blacklist';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchBlacklistData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShieldExclamationIcon className="h-8 w-8 text-red-600 mr-3" />
              Blacklist Management
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage email blacklist for preventing unauthorized registrations
            </p>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add to Blacklist
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          >
            <div className="flex items-center">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Blacklist</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.activeBlacklist}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          >
            <div className="flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Removed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.removedFromBlacklist}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          >
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <DocumentArrowDownIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalBlacklisted}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"
          >
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Last 24h</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.last24Hours}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <form onSubmit={handleSearch} className="flex-1 max-w-lg">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active Blacklist</option>
              <option value="removed">Removed</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Blacklisted By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No emails found
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {email.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        email.status === 'ACTIVE'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      }`}>
                        {email.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {email.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {email.blacklistedBy.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {email.blacklistedBy.role}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(email.blacklistedAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {email.daysSinceBlacklisted} days ago
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {email.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setSelectedEmail(email);
                              setShowRemoveModal(true);
                            }}
                            className="text-green-600 hover:text-green-900 transition-colors"
                            title="Remove from blacklist"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Add to Blacklist Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Add Email to Blacklist
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmailData.email}
                  onChange={(e) => setNewEmailData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter email to blacklist"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Blacklist
                </label>
                <textarea
                  value={newEmailData.reason}
                  onChange={(e) => setNewEmailData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Explain why this email should be blacklisted"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToBlacklist}
                disabled={processing || !newEmailData.email || !newEmailData.reason}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Adding...' : 'Add to Blacklist'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Remove from Blacklist Modal */}
      {showRemoveModal && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Remove from Blacklist
              </h3>
              <button
                onClick={() => setShowRemoveModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to remove <strong>{selectedEmail.email}</strong> from the blacklist?
                This will allow them to register and login again.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for Removal
              </label>
              <textarea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Explain why this email should be removed from blacklist"
              />
            </div>
            
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveFromBlacklist}
                disabled={processing || !removeReason}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Removing...' : 'Remove from Blacklist'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BlacklistManagement;