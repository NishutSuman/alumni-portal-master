// src/components/user/SocialSection.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  EyeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useGetPostsQuery } from '../../store/api/postApi';
import { useGetActivePollsQuery, useGetPollStatsQuery } from '../../store/api/pollApi';
import PostCard from './PostCard';
import { formatDistanceToNow } from 'date-fns';
import type { Poll } from '../../store/api/pollApi';
import { useVotePollMutation } from '../../store/api/pollApi';
import toast from 'react-hot-toast';

const SocialSection: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'post' | 'poll'>('post');
  const { user } = useSelector((state: RootState) => state.auth);

  // Fetch latest post
  const { data: postsData } = useGetPostsQuery({
    page: 1,
    limit: 1,
    isPublished: true,
    isArchived: false,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Fetch active poll
  const { data: pollsData } = useGetActivePollsQuery();

  const [votePoll] = useVotePollMutation();

  const latestPost = postsData?.posts?.[0];
  const activePoll = pollsData?.activePolls?.[0];

  // Poll voting handler
  const handleInstantVote = async (pollId: string, optionId: string, allowMultiple: boolean, currentUserVotes: string[]) => {
    let newVotes: string[];

    if (allowMultiple) {
      if (currentUserVotes.includes(optionId)) {
        newVotes = currentUserVotes.filter(id => id !== optionId);
      } else {
        newVotes = [...currentUserVotes, optionId];
      }
    } else {
      if (currentUserVotes.includes(optionId)) {
        newVotes = [];
      } else {
        newVotes = [optionId];
      }
    }

    try {
      await votePoll({
        pollId,
        data: { optionIds: newVotes }
      }).unwrap();
      
      if (newVotes.length === 0) {
        toast.success('All votes removed successfully!');
      } else {
        toast.success('Vote updated successfully!');
      }
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to update vote');
    }
  };

  // Enhanced Poll Card component with stats
  const CompactPollCard: React.FC<{ poll: Poll }> = ({ poll }) => {
    const [expandedStats, setExpandedStats] = useState(false);
    const [expandedVoters, setExpandedVoters] = useState<string | null>(null);
    const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
    const canVote = poll.isActive && !isExpired && user;

    const { data: statsData, isLoading: statsLoading } = useGetPollStatsQuery(poll.id, {
      skip: !expandedStats
    });

    // Helper function to get color based on percentage
    const getColorForPercentage = (percentage: number) => {
      if (percentage >= 60) return 'bg-green-200 border-green-400 text-green-900';
      if (percentage >= 40) return 'bg-yellow-200 border-yellow-400 text-yellow-900';
      if (percentage >= 20) return 'bg-orange-200 border-orange-400 text-orange-900';
      return 'bg-red-200 border-red-400 text-red-900';
    };

    const toggleVoters = (optionId: string) => {
      setExpandedVoters(expandedVoters === optionId ? null : optionId);
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {/* Poll Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {poll.title}
          </h3>
          {poll.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              {poll.description}
            </p>
          )}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <UserGroupIcon className="h-4 w-4" />
                <span>{poll.totalVotes} votes</span>
              </div>
              {poll.expiresAt && (
                <div className="flex items-center space-x-1">
                  <ClockIcon className="h-4 w-4" />
                  <span>
                    {isExpired ? 'Expired' : `Expires ${formatDistanceToNow(new Date(poll.expiresAt))} from now`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {poll.hasVoted && (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Voted</span>
                </div>
              )}
              <button
                onClick={() => setExpandedStats(!expandedStats)}
                className="flex items-center space-x-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <ChartBarIcon className="h-4 w-4" />
                <span>Stats</span>
                {expandedStats ? (
                  <ChevronUpIcon className="h-3 w-3" />
                ) : (
                  <ChevronDownIcon className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Poll Options with colored percentages */}
        <div className="space-y-3 mb-4">
          {poll.options.map((option) => {
            const isUserVote = poll.userVote?.includes(option.id);
            const showResults = poll.hasVoted || !poll.isActive || isExpired;
            const optionColorClass = showResults ? getColorForPercentage(option.percentage) : '';
            
            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => canVote && handleInstantVote(poll.id, option.id, poll.allowMultiple, poll.userVote || [])}
                  disabled={!canVote}
                  className={`w-full p-3 rounded-lg border text-left transition-all relative overflow-hidden ${
                    isUserVote
                      ? 'border-green-300 bg-green-50 text-green-800'
                      : canVote
                      ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      : showResults
                      ? optionColorClass
                      : 'border-gray-200'
                  }`}
                >
                  {/* Progress bar background with color based on percentage */}
                  {showResults && (
                    <div 
                      className="absolute inset-0 opacity-20"
                      style={{ 
                        background: `linear-gradient(to right, currentColor ${option.percentage}%, transparent ${option.percentage}%)` 
                      }}
                    />
                  )}
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{option.text}</span>
                      {isUserVote && (
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    {showResults && (
                      <div className="flex items-center space-x-2 text-sm">
                        <span>{option.voteCount} votes</span>
                        <span className="font-semibold">{option.percentage}%</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Stats Accordion */}
        <AnimatePresence>
          {expandedStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-gray-200 dark:border-gray-700 pt-4 overflow-hidden"
            >
              {statsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : statsData ? (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{statsData.totalVotes}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Votes</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">{statsData.totalVoters}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Voters</div>
                    </div>
                  </div>

                  {/* Option Details with Dropdown Voters */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center">
                      <ChartBarIcon className="h-4 w-4 mr-2" />
                      Vote Breakdown
                    </h4>
                    {statsData.options.map((option) => (
                      <div key={option.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{option.text}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">{option.voteCount} votes</span>
                              <span className="font-bold">{option.percentage}%</span>
                            </div>
                          </div>
                          
                          {/* Voters Dropdown */}
                          {!statsData.poll.isAnonymous && option.voters.length > 0 && (
                            <div className="mt-2">
                              <button
                                onClick={() => toggleVoters(option.id)}
                                className="flex items-center justify-between w-full text-sm p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 transition-colors"
                              >
                                <span className="font-medium text-gray-700 dark:text-gray-200">
                                  Voted by ({option.voters.length})
                                </span>
                                {expandedVoters === option.id ? (
                                  <ChevronUpIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                ) : (
                                  <ChevronDownIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                )}
                              </button>
                              
                              <AnimatePresence>
                                {expandedVoters === option.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="mt-2 overflow-hidden"
                                  >
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {option.voters.map((voter) => (
                                        <div
                                          key={voter.id}
                                          className="flex items-center justify-between text-xs p-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                                              {voter.fullName.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-medium">{voter.fullName}</span>
                                            {voter.batch && (
                                              <span className="text-gray-500">({voter.batch})</span>
                                            )}
                                          </div>
                                          <span className="text-gray-400">{formatDistanceToNow(new Date(voter.votedAt))} ago</span>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">Failed to load stats</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Don't render if no content
  if (!latestPost && !activePoll) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Social</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6">
              {/* Tab Navigation */}
              <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {latestPost && (
                  <button
                    onClick={() => setActiveTab('post')}
                    className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'post'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    <span>Post</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Latest
                    </span>
                  </button>
                )}
                {activePoll && (
                  <button
                    onClick={() => setActiveTab('poll')}
                    className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'poll'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <ChartBarIcon className="h-4 w-4" />
                    <span>Poll</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Active
                    </span>
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="min-h-[200px]">
                {activeTab === 'post' && latestPost && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <PostCard 
                      post={latestPost} 
                      showActions={false}
                    />
                  </motion.div>
                )}

                {activeTab === 'poll' && activePoll && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CompactPollCard poll={activePoll} />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SocialSection;