import React, { useState, useRef, useEffect } from 'react';
import { useSearchUsersForMentionsQuery, MentionUser } from '../../../store/api/userApi';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  NumberedListIcon,
  CodeBracketIcon,
  AtSymbolIcon,
} from '@heroicons/react/24/outline';
import { getApiUrl } from '@/utils/helpers';

interface SimpleMentionEditorProps {
  content?: string;
  onChange: (content: string, mentions: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const SimpleMentionEditor: React.FC<SimpleMentionEditorProps> = ({
  content = '',
  onChange,
  placeholder = 'Write your post...',
  className = '',
  disabled = false,
}) => {
  const [text, setText] = useState(content);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: mentionUsers = [] } = useSearchUsersForMentionsQuery(
    { query: mentionQuery },
    { skip: mentionQuery.length < 2 }
  );

  useEffect(() => {
    setText(content);
  }, [content]);

  useEffect(() => {
    setSelectedSuggestion(0);
  }, [mentionUsers]);

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[2]); // userId
    }
    
    return mentions;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setText(newText);
    
    // Check for @ mention trigger
    const beforeCursor = newText.substring(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@([^@\s]*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionStartPos(cursorPos - mentionMatch[0].length);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
      setMentionStartPos(-1);
    }

    // Extract mentions and call onChange
    const mentions = extractMentions(newText);
    onChange(newText, mentions);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || mentionUsers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion((prev) => 
          prev < mentionUsers.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion((prev) => 
          prev > 0 ? prev - 1 : mentionUsers.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        if (mentionUsers[selectedSuggestion]) {
          e.preventDefault();
          insertMention(mentionUsers[selectedSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const insertMention = (user: MentionUser) => {
    if (mentionStartPos === -1) return;

    const beforeMention = text.substring(0, mentionStartPos);
    const afterMention = text.substring(textareaRef.current?.selectionStart || 0);
    const mentionText = `@[${user.fullName}](${user.id})`;
    const newText = beforeMention + mentionText + afterMention;

    setText(newText);
    setShowSuggestions(false);
    setMentionQuery('');
    setMentionStartPos(-1);

    // Extract mentions and call onChange
    const mentions = extractMentions(newText);
    onChange(newText, mentions);

    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const formatTextForDisplay = (text: string): string => {
    // Replace mention format [@Name](userId) with styled spans
    return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '<span class="mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-1 rounded font-medium">@$1</span>');
  };

  const getSuggestionPosition = () => {
    if (!textareaRef.current || mentionStartPos === -1) return {};

    // Position relative to the parent container
    return {};
  };

  return (
    <div className={`relative ${className}`}>
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Simple Toolbar */}
        <div className="border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <AtSymbolIcon className="h-4 w-4" />
            <span>Type @ to mention users</span>
          </div>
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full min-h-[150px] p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none resize-vertical"
            rows={6}
          />
        </div>
      </div>

      {/* Mention Suggestions */}
      {showSuggestions && mentionUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg w-80 mt-1 left-0"
        >
          {mentionUsers.map((user, index) => (
            <button
              key={user.id}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                index === selectedSuggestion ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => insertMention(user)}
            >
              {user.profileImage ? (
                <img
                  src={getApiUrl(`/api/users/profile-picture/${user.id}`)}
                  alt={user.fullName}
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
                  user.profileImage ? 'hidden' : 'flex'
                }`}
              >
                {user.fullName
                  .split(' ')
                  .map(word => word.charAt(0))
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Batch {user.batch}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Preview of formatted text */}
      {text && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
          <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">Preview:</div>
          <div 
            className="prose dark:prose-invert max-w-none prose-sm"
            dangerouslySetInnerHTML={{ __html: formatTextForDisplay(text) }}
          />
        </div>
      )}
    </div>
  );
};

export default SimpleMentionEditor;