import React from 'react';
import { PostFilters } from '../../types/post';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

interface PostFiltersPanelProps {
  filters: PostFilters;
  onFiltersChange: (filters: Partial<PostFilters>) => void;
  onClearSearch?: () => void;
  className?: string;
}

const PostFiltersPanel: React.FC<PostFiltersPanelProps> = ({
  filters,
  onFiltersChange,
  onClearSearch,
  className = '',
}) => {
  const { user } = useSelector((state: RootState) => state.auth);

  // Show publish/archive filters for admin
  const showPublishFilters = user?.role === 'SUPER_ADMIN';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Publish Status Filter (Admin only) */}
      {showPublishFilters && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Publication Status
          </label>
          <select
            value={filters.isPublished === undefined ? 'ALL' : filters.isPublished ? 'PUBLISHED' : 'UNPUBLISHED'}
            onChange={(e) => {
              const value = e.target.value;
              onFiltersChange({ 
                isPublished: value === 'ALL' ? undefined : value === 'PUBLISHED'
              });
            }}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Posts</option>
            <option value="PUBLISHED">Published</option>
            <option value="UNPUBLISHED">Unpublished</option>
          </select>
        </div>
      )}

      {/* Date Range Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date Range
        </label>
        <div className="space-y-2">
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ 
              dateFrom: e.target.value || undefined 
            })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="From date"
          />
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ 
              dateTo: e.target.value || undefined 
            })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="To date"
          />
        </div>
      </div>


      {/* Clear Filters */}
      <button
        onClick={() => {
          onFiltersChange({
            isPublished: true,
            isArchived: false,
            category: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            tags: undefined,
            author: undefined,
          });
          onClearSearch?.();
        }}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  );
};

export default PostFiltersPanel;