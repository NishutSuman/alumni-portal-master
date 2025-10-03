// src/pages/admin/PollManagement.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ChartBarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import {
  useGetPollsQuery,
  useDeletePollMutation,
  useForceDeletePollMutation,
  useUpdatePollMutation,
  useCreatePollMutation,
} from '@/store/api/pollApi';
import { Poll, PollFilters } from '@/store/api/pollApi';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

// Form types
interface CreatePollFormData {
  title: string;
  description: string;
  options: { text: string }[];
  allowMultiple: boolean;
  isAnonymous: boolean;
  expiresAt: string;
}

interface UpdatePollFormData {
  title: string;
  description: string;
  allowMultiple: boolean;
  isAnonymous: boolean;
  expiresAt: string;
  isActive: boolean;
  addOptions: { text: string }[];
  removeOptionIds: string[];
}

const PollManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'manage' | 'create'>('manage');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<PollFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    poll: Poll;
    forceDelete: boolean;
  } | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [newOptions, setNewOptions] = useState<{ text: string }[]>([]);
  const [optionsToRemove, setOptionsToRemove] = useState<string[]>([]);
  const [showOptionsWarning, setShowOptionsWarning] = useState(false);

  const [deletePoll] = useDeletePollMutation();
  const [forceDeletePoll] = useForceDeletePollMutation();
  const [updatePoll] = useUpdatePollMutation();
  const [createPoll] = useCreatePollMutation();

  // React Hook Form setup for create poll (always initialize)
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePollFormData>({
    defaultValues: {
      title: '',
      description: '',
      options: [{ text: '' }, { text: '' }], // Start with 2 empty options
      allowMultiple: false,
      isAnonymous: false,
      expiresAt: '',
    },
  });

  // useFieldArray for dynamic options (always initialize)
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'options',
  });

  // React Hook Form setup for update poll
  const {
    register: registerUpdate,
    handleSubmit: handleSubmitUpdate,
    reset: resetUpdate,
    setValue: setValueUpdate,
    getValues: getValuesUpdate,
    formState: { errors: errorsUpdate, isSubmitting: isSubmittingUpdate },
  } = useForm<UpdatePollFormData>();

  // Handle form submission for create poll
  const onSubmit = async (data: CreatePollFormData) => {
    try {
      // Filter out empty options
      const validOptions = data.options.filter(option => option.text.trim());
      
      if (validOptions.length < 2) {
        toast.error('Please provide at least 2 options');
        return;
      }

      const pollData = {
        title: data.title,
        description: data.description,
        options: validOptions.map(option => option.text), // Convert to string array
        allowMultiple: data.allowMultiple,
        isAnonymous: data.isAnonymous,
        ...(data.expiresAt && { expiresAt: new Date(data.expiresAt).toISOString() }),
      };

      console.log('Sending poll data:', pollData);
      await createPoll(pollData).unwrap();
      toast.success('Poll created successfully! All users have been notified.');
      reset();
      setActiveTab('manage');
      // Force refetch to bypass cache
      refetchPolls();
    } catch (error: any) {
      console.error('Create poll error:', error);
      toast.error(error?.data?.message || 'Failed to create poll');
    }
  };

  // Get polls
  const {
    data: pollsData,
    isLoading: pollsLoading,
    refetch: refetchPolls,
  } = useGetPollsQuery(filters);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        search: searchQuery.trim(),
        page: 1,
      }));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle edit poll
  const handleEditPoll = (poll: Poll) => {
    setEditingPoll(poll);
    setNewOptions([]);
    setOptionsToRemove([]);
    setShowOptionsWarning(false);
    // Populate the update form with existing poll data
    setValueUpdate('title', poll.title);
    setValueUpdate('description', poll.description || '');
    setValueUpdate('expiresAt', poll.expiresAt ? new Date(poll.expiresAt).toISOString().slice(0, 16) : '');
  };

  // Handle update poll submission
  const onUpdateSubmit = async (data: UpdatePollFormData) => {
    if (!editingPoll) return;

    // Check if we need to show warning for destructive changes
    const hasVotes = editingPoll.totalVotes > 0;
    const hasNewOptions = newOptions.some(opt => opt.text.trim());
    const hasDestructiveChanges = optionsToRemove.length > 0 || hasNewOptions;

    if (hasDestructiveChanges && !showOptionsWarning) {
      setShowOptionsWarning(true);
      return;
    }

    try {
      const updateData = {
        title: data.title,
        description: data.description,
        ...(data.expiresAt && { expiresAt: new Date(data.expiresAt).toISOString() }),
        ...(newOptions.length > 0 && { addOptions: newOptions.map(opt => opt.text).filter(text => text.trim()) }),
        ...(optionsToRemove.length > 0 && { removeOptionIds: optionsToRemove }),
      };

      console.log('🔍 Frontend update data:', {
        updateData,
        newOptions,
        optionsToRemove,
        pollId: editingPoll.id
      });

      await updatePoll({
        pollId: editingPoll.id,
        data: updateData,
      }).unwrap();

      toast.success('Poll updated successfully!');
      setEditingPoll(null);
      setNewOptions([]);
      setOptionsToRemove([]);
      setShowOptionsWarning(false);
      resetUpdate();
      refetchPolls();
    } catch (error: any) {
      console.error('Update poll error:', error);
      toast.error(error?.data?.message || 'Failed to update poll');
    }
  };

  const handleTogglePollStatus = async (poll: Poll) => {
    try {
      const response = await updatePoll({
        pollId: poll.id,
        data: { isActive: !poll.isActive },
      }).unwrap();

      toast.success(`Poll ${poll.isActive ? 'deactivated' : 'activated'} successfully`);
      refetchPolls();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update poll status');
    }
  };

  const handleDeletePoll = async (poll: Poll, forceDelete = false) => {
    try {
      if (forceDelete) {
        await forceDeletePoll(poll.id).unwrap();
        toast.success('Poll force deleted successfully');
      } else {
        await deletePoll(poll.id).unwrap();
        toast.success('Poll deleted successfully');
      }
      
      setShowDeleteConfirm(null);
      refetchPolls();
    } catch (error: any) {
      if (error?.data?.message?.includes('votes')) {
        setShowDeleteConfirm({ poll, forceDelete: true });
      } else {
        toast.error(error?.data?.message || 'Failed to delete poll');
      }
    }
  };


  const renderManageTab = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search polls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <FunnelIcon className="h-5 w-5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Polls Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Polls</h3>
        </div>

        {pollsLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        ) : pollsData?.polls && pollsData.polls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Poll
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Votes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {pollsData.polls.map((poll) => {
                  const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
                  
                  return (
                    <tr key={poll.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {poll.title}
                          </div>
                          {poll.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {poll.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {poll.creator.fullName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Batch {poll.creator.batch}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {poll.totalVotes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          isExpired
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300'
                            : poll.isActive
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {isExpired ? 'Expired' : poll.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(poll.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {(user?.role === 'SUPER_ADMIN' || poll.createdBy === user?.id) && (
                            <>
                              {!isExpired && (
                                <button
                                  onClick={() => handleEditPoll(poll)}
                                  className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
                                  title="Edit Poll"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                              )}
                              
                              {!isExpired && (
                                <button
                                  onClick={() => handleTogglePollStatus(poll)}
                                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    poll.isActive
                                      ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
                                      : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                                  }`}
                                  title={poll.isActive ? 'Deactivate Poll' : 'Activate Poll'}
                                >
                                  {poll.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                              
                              <button
                                onClick={() => setShowDeleteConfirm({ poll, forceDelete: false })}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                title="Delete Poll"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No polls found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search terms.' : 'Create your first poll to get started.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateTab = () => {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Create New Poll</h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Poll Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Poll Title *
              </label>
              <input
                type="text"
                {...register('title', { 
                  required: 'Poll title is required',
                  minLength: { value: 3, message: 'Title must be at least 3 characters' },
                  maxLength: { value: 200, message: 'Title must not exceed 200 characters' }
                })}
                placeholder="Enter poll title..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title.message}</p>
              )}
            </div>

            {/* Poll Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                {...register('description', {
                  maxLength: { value: 1000, message: 'Description must not exceed 1000 characters' }
                })}
                rows={3}
                placeholder="Enter poll description (optional)..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
              )}
            </div>

            {/* Poll Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Poll Options *
              </label>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        {...register(`options.${index}.text`, {
                          required: index < 2 ? 'Option is required' : false,
                          maxLength: { value: 200, message: 'Option must not exceed 200 characters' }
                        })}
                        placeholder={`Option ${index + 1}${index < 2 ? ' (required)' : ''}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      {errors.options?.[index]?.text && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.options[index]?.text?.message}
                        </p>
                      )}
                    </div>
                    {fields.length > 2 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {fields.length < 10 && (
                <button
                  type="button"
                  onClick={() => append({ text: '' })}
                  className="mt-3 flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Add Option</span>
                </button>
              )}
            </div>

            {/* Poll Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Poll Settings</h4>
              
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="allowMultiple"
                  {...register('allowMultiple')}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="allowMultiple" className="text-sm text-gray-700 dark:text-gray-300">
                  Allow multiple selections
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  {...register('isAnonymous')}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isAnonymous" className="text-sm text-gray-700 dark:text-gray-300">
                  Anonymous voting
                </label>
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expiration Date (Optional)
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  {...register('expiresAt', {
                    validate: (value) => {
                      if (value && new Date(value) <= new Date()) {
                        return 'Expiration date must be in the future';
                      }
                      return true;
                    }
                  })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              {errors.expiresAt && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.expiresAt.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave empty for no expiration
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => reset()}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Reset Form
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    <span>Create Poll</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Poll Management</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Create and manage community polls
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 flex space-x-8">
            {[
              { id: 'manage', label: 'Manage Polls' },
              ...(user?.role === 'SUPER_ADMIN' || user?.role === 'BATCH_ADMIN' 
                ? [{ id: 'create', label: 'Create Poll' }] 
                : []
              ),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'manage' && renderManageTab()}
          {activeTab === 'create' && (user?.role === 'SUPER_ADMIN' || user?.role === 'BATCH_ADMIN') && renderCreateTab()}
        </motion.div>
      </div>

      {/* Update Poll Modal */}
      <AnimatePresence>
        {editingPoll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingPoll(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Update Poll</h3>
                <button
                  onClick={() => setEditingPoll(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitUpdate(onUpdateSubmit)} className="space-y-6">
                {/* Poll Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Poll Title *
                  </label>
                  <input
                    type="text"
                    {...registerUpdate('title', { 
                      required: 'Poll title is required',
                      minLength: { value: 3, message: 'Title must be at least 3 characters' },
                      maxLength: { value: 200, message: 'Title must not exceed 200 characters' }
                    })}
                    placeholder="Enter poll title..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {errorsUpdate.title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorsUpdate.title.message}</p>
                  )}
                </div>

                {/* Poll Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    {...registerUpdate('description', {
                      maxLength: { value: 1000, message: 'Description must not exceed 1000 characters' }
                    })}
                    rows={3}
                    placeholder="Enter poll description (optional)..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {errorsUpdate.description && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorsUpdate.description.message}</p>
                  )}
                </div>

                {/* Current Poll Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Poll Options (Admin can modify)
                  </label>
                  
                  {/* Existing Options */}
                  <div className="space-y-2 mb-4">
                    {editingPoll.options?.map((option, index) => (
                      <div key={option.id} className={`p-3 rounded-lg border ${
                        optionsToRemove.includes(option.id) 
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className={`text-sm ${
                              optionsToRemove.includes(option.id) 
                                ? 'text-red-900 dark:text-red-300 line-through' 
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {index + 1}. {option.text}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({option.voteCount || 0} votes)
                            </span>
                          </div>
                          {user?.role === 'SUPER_ADMIN' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (optionsToRemove.includes(option.id)) {
                                  setOptionsToRemove(prev => prev.filter(id => id !== option.id));
                                } else {
                                  setOptionsToRemove(prev => [...prev, option.id]);
                                }
                              }}
                              className={`p-1 rounded ${
                                optionsToRemove.includes(option.id)
                                  ? 'text-green-600 hover:text-green-800 dark:text-green-400'
                                  : 'text-red-600 hover:text-red-800 dark:text-red-400'
                              }`}
                              title={optionsToRemove.includes(option.id) ? 'Restore option' : 'Remove option'}
                            >
                              {optionsToRemove.includes(option.id) ? (
                                <PlusIcon className="h-4 w-4" />
                              ) : (
                                <XMarkIcon className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* New Options */}
                  {user?.role === 'SUPER_ADMIN' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add New Options</span>
                        <button
                          type="button"
                          onClick={() => setNewOptions(prev => [...prev, { text: '' }])}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm flex items-center space-x-1"
                        >
                          <PlusIcon className="h-4 w-4" />
                          <span>Add Option</span>
                        </button>
                      </div>
                      
                      {newOptions.length > 0 && (
                        <div className="space-y-2">
                          {newOptions.map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={option.text}
                                onChange={(e) => {
                                  const updated = [...newOptions];
                                  updated[index] = { text: e.target.value };
                                  setNewOptions(updated);
                                }}
                                placeholder={`New option ${index + 1}`}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setNewOptions(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="p-2 text-red-600 hover:text-red-800 dark:text-red-400"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(optionsToRemove.length > 0 || newOptions.some(opt => opt.text.trim())) && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        ⚠️ Modifying options will affect existing voting data and notify all voters.
                      </p>
                    </div>
                  )}
                </div>

                {/* Poll Settings - Read Only Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Poll Information</h4>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Poll Type:</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {editingPoll?.allowMultiple ? 'Multiple Choice' : 'Single Choice'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Voting Type:</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {editingPoll?.isAnonymous ? 'Anonymous' : 'Public'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Status:</span>
                      <span className={`text-sm font-medium ${
                        editingPoll?.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {editingPoll?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        💡 Poll settings cannot be changed after creation to maintain data integrity. 
                        Use the Deactivate button in the poll list to disable this poll.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expiration Date (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      {...registerUpdate('expiresAt', {
                        validate: (value) => {
                          if (value && new Date(value) <= new Date()) {
                            return 'Expiration date must be in the future';
                          }
                          return true;
                        }
                      })}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  </div>
                  {errorsUpdate.expiresAt && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorsUpdate.expiresAt.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Leave empty for no expiration
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setEditingPoll(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isSubmittingUpdate}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {isSubmittingUpdate ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <PencilIcon className="h-4 w-4" />
                        <span>Update Poll</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {showDeleteConfirm.forceDelete ? 'Force Delete Poll' : 'Delete Poll'}
                </h3>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {showDeleteConfirm.forceDelete
                  ? `This poll has votes and cannot be deleted normally. Are you sure you want to force delete "${showDeleteConfirm.poll.title}"? This action cannot be undone.`
                  : `Are you sure you want to delete "${showDeleteConfirm.poll.title}"? This action cannot be undone.`
                }
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeletePoll(showDeleteConfirm.poll, showDeleteConfirm.forceDelete)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {showDeleteConfirm.forceDelete ? 'Force Delete' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Options Warning Modal */}
      <AnimatePresence>
        {showOptionsWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOptionsWarning(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full"
            >
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Confirm Poll Modifications
                </h3>
              </div>
              
              <div className="space-y-4 mb-6">
                <p className="text-gray-600 dark:text-gray-400">
                  You are about to make changes that will affect this poll's voting data:
                </p>
                
                {optionsToRemove.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                      Removing {optionsToRemove.length} option(s):
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                      {optionsToRemove.map(optionId => {
                        const option = editingPoll?.options.find(opt => opt.id === optionId);
                        return (
                          <li key={optionId}>
                            "{option?.text}" ({option?.voteCount || 0} votes)
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {newOptions.some(opt => opt.text.trim()) && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                      Adding {newOptions.filter(opt => opt.text.trim()).length} new option(s):
                    </p>
                    <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300">
                      {newOptions.filter(opt => opt.text.trim()).map((option, index) => (
                        <li key={index}>"{option.text}"</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>⚠️ Important:</strong>
                  </p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                    <li>Removed options and their votes will be permanently deleted</li>
                    <li>All voters will receive a push notification about the poll update</li>
                    <li>Users can vote again on new options if allowed</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowOptionsWarning(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowOptionsWarning(false);
                    handleSubmitUpdate(onUpdateSubmit)();
                  }}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                >
                  Proceed with Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PollManagement;