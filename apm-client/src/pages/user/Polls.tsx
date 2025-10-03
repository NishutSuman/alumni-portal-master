// src/pages/user/Polls.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  useGetActivePollsQuery,
  useGetPollsQuery,
  useGetPollStatsQuery,
  useVotePollMutation,
  Poll,
} from '../../store/api/pollApi';

const Polls: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
  const [expandedStats, setExpandedStats] = useState<string | null>(null);
  const [expandedVoters, setExpandedVoters] = useState<string | null>(null);
  const { user } = useSelector((state: RootState) => state.auth);

  const { data: activePollsData, isLoading: activePollsLoading } = useGetActivePollsQuery();
  const { data: allPollsData, isLoading: allPollsLoading } = useGetPollsQuery({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const [votePoll] = useVotePollMutation();

  const polls = activeTab === 'active' 
    ? activePollsData?.activePolls 
    : allPollsData?.polls?.filter(poll => {
        // Consider a poll non-active if it's either:
        // 1. Marked as inactive (isActive: false), OR
        // 2. Expired (has expiresAt and it's in the past)
        const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
        return !poll.isActive || isExpired;
      });
  const isLoading = activeTab === 'active' ? activePollsLoading : allPollsLoading;

  const handleInstantVote = async (pollId: string, optionId: string, allowMultiple: boolean, currentUserVotes: string[]) => {
    let newVotes: string[];

    if (allowMultiple) {
      // For multiple choice: toggle the option
      if (currentUserVotes.includes(optionId)) {
        newVotes = currentUserVotes.filter(id => id !== optionId);
      } else {
        newVotes = [...currentUserVotes, optionId];
      }
    } else {
      // For single choice: select only this option (or deselect if already selected)
      if (currentUserVotes.includes(optionId)) {
        newVotes = []; // Deselect (remove vote)
      } else {
        newVotes = [optionId]; // Select only this one
      }
    }

    // Submit the vote (including empty array to remove all votes)
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

  const toggleStats = (pollId: string) => {
    setExpandedStats(expandedStats === pollId ? null : pollId);
  };

  const toggleVoters = (optionId: string) => {
    setExpandedVoters(expandedVoters === optionId ? null : optionId);
  };

  const PollCard: React.FC<{ poll: Poll }> = ({ poll }) => {
    const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
    const canVote = poll.isActive && !isExpired && user;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
                onClick={() => toggleStats(poll.id)}
                className="flex items-center space-x-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <ChartBarIcon className="h-4 w-4" />
                <span>Stats</span>
                {expandedStats === poll.id ? (
                  <ChevronUpIcon className="h-3 w-3" />
                ) : (
                  <ChevronDownIcon className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Poll Options */}
        <div className="space-y-3 mb-4">
          {poll.options.map((option) => {
            const isUserVote = poll.userVote?.includes(option.id);
            const showResults = poll.hasVoted || !poll.isActive || isExpired;
            
            // Helper function to get color based on percentage
            const getColorForPercentage = (percentage: number) => {
              if (percentage >= 60) return 'bg-green-200 border-green-400 text-green-900';
              if (percentage >= 40) return 'bg-yellow-200 border-yellow-400 text-yellow-900';
              if (percentage >= 20) return 'bg-orange-200 border-orange-400 text-orange-900';
              return 'bg-red-200 border-red-400 text-red-900';
            };

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
        <PollStats pollId={poll.id} isExpanded={expandedStats === poll.id} />
      </div>
    );
  };

  const PollStats: React.FC<{ pollId: string; isExpanded: boolean }> = ({ pollId, isExpanded }) => {
    const { data: statsData, isLoading: statsLoading } = useGetPollStatsQuery(pollId, {
      skip: !isExpanded
    });

    if (!isExpanded) return null;

    return (
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
                                      <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                                        {voter.fullName.charAt(0)}
                                      </div>
                                      <span className="text-gray-800 dark:text-gray-200 font-medium">{voter.fullName}</span>
                                      {voter.batch && (
                                        <span className="text-gray-500 dark:text-gray-400">({voter.batch})</span>
                                      )}
                                    </div>
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {formatDistanceToNow(new Date(voter.votedAt))} ago
                                    </span>
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

            {statsData.poll.isAnonymous && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-2">
                <EyeIcon className="h-5 w-5 mx-auto mb-1" />
                This poll is anonymous - voter details are hidden
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            Failed to load statistics
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Polls</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Vote on community polls and see detailed statistics
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-6 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'active', label: 'Active Polls', count: activePollsData?.count },
            { id: 'all', label: 'All Polls', count: allPollsData?.polls?.filter(poll => {
                const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
                return !poll.isActive || isExpired;
              })?.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        ) : polls && polls.length > 0 ? (
          <div className="space-y-6">
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {activeTab === 'active' ? 'No Active Polls' : 'No Polls Found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {activeTab === 'active'
                ? 'There are no active polls at the moment.'
                : 'No polls have been created yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Polls;