import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MentionUser } from '../../../store/api/userApi';
import { getApiUrl } from '@/utils/helpers';

interface MentionSuggestionProps {
  items: MentionUser[];
  command: (item: MentionUser) => void;
}

export interface MentionSuggestionRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      if (items[index]) {
        command(items[index]);
      }
    };

    const upHandler = () => {
      setSelectedIndex((selectedIndex + items.length - 1) % items.length);
    };

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-sm text-gray-500 dark:text-gray-400">
          No users found
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-w-sm w-full">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${
              index === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
            onClick={() => selectItem(index)}
          >
            {item.profileImage ? (
              <img
                src={getApiUrl(`/api/users/profile-picture/${item.id}`)}
                alt={item.fullName}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm ${
                item.profileImage ? 'hidden' : 'flex'
              }`}
            >
              {item.fullName
                .split(' ')
                .map(word => word.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {item.fullName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Batch {item.batch}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionSuggestion.displayName = 'MentionSuggestion';

export default MentionSuggestion;