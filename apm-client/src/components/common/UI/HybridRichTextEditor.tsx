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

interface HybridRichTextEditorProps {
  content?: string;
  onChange: (content: string, mentions: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const HybridRichTextEditor: React.FC<HybridRichTextEditorProps> = ({
  content = '',
  onChange,
  placeholder = 'Write your post...',
  className = '',
  disabled = false,
}) => {
  const [htmlContent, setHtmlContent] = useState(content);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [currentRange, setCurrentRange] = useState<Range | null>(null);
  const [formatStates, setFormatStates] = useState({
    bold: false,
    italic: false,
    underline: false,
  });
  const editorRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: mentionUsers = [] } = useSearchUsersForMentionsQuery(
    { query: mentionQuery },
    { skip: mentionQuery.length < 2 }
  );

  useEffect(() => {
    setHtmlContent(content);
    if (editorRef.current && content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  useEffect(() => {
    setSelectedSuggestion(0);
  }, [mentionUsers]);

  const extractMentions = (html: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(html)) !== null) {
      mentions.push(match[2]); // userId
    }
    
    return mentions;
  };

  const updateFormatStates = () => {
    setFormatStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    
    const html = editorRef.current.innerHTML;
    setHtmlContent(html);
    
    // Update format states
    updateFormatStates();
    
    // Get text content for mention detection
    const textContent = editorRef.current.textContent || '';
    const selection = window.getSelection();
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setCurrentRange(range);
      
      // Find cursor position in text content
      let cursorPos = 0;
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node === range.startContainer) {
          cursorPos += range.startOffset;
          break;
        }
        cursorPos += node.textContent?.length || 0;
      }
      
      // Check for @ mention trigger in the entire text content
      const beforeCursor = textContent.substring(0, cursorPos);
      const mentionMatch = beforeCursor.match(/@([^@\s]*)$/);
      
      if (mentionMatch && !beforeCursor.endsWith(' ')) {
        setMentionQuery(mentionMatch[1]);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
        setMentionQuery('');
      }
    } else {
      // No selection, hide suggestions
      setShowSuggestions(false);
      setMentionQuery('');
    }

    // Extract mentions and call onChange
    const mentions = extractMentions(html);
    onChange(html, mentions);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle backspace and delete for mention deletion
    if ((e.key === 'Backspace' || e.key === 'Delete') && !showSuggestions) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Check if cursor is right after a mention span
        if (range.collapsed && range.startOffset === 0 && range.startContainer.nodeType === Node.TEXT_NODE) {
          const textNode = range.startContainer;
          const previousSibling = textNode.previousSibling;
          
          if (previousSibling && 
              previousSibling.nodeType === Node.ELEMENT_NODE && 
              (previousSibling as Element).classList.contains('mention')) {
            e.preventDefault();
            previousSibling.remove();
            handleInput();
            return;
          }
        }
        
        // Check if cursor is right after a mention (when cursor is positioned after mention span)
        if (range.collapsed && range.startContainer.nodeType === Node.ELEMENT_NODE) {
          const container = range.startContainer as Element;
          
          if (e.key === 'Backspace') {
            const nodeAtCursor = container.childNodes[range.startOffset - 1];
            
            if (nodeAtCursor && 
                nodeAtCursor.nodeType === Node.ELEMENT_NODE && 
                (nodeAtCursor as Element).classList.contains('mention')) {
              e.preventDefault();
              nodeAtCursor.remove();
              handleInput();
              return;
            }
          } else if (e.key === 'Delete') {
            const nodeAtCursor = container.childNodes[range.startOffset];
            
            if (nodeAtCursor && 
                nodeAtCursor.nodeType === Node.ELEMENT_NODE && 
                (nodeAtCursor as Element).classList.contains('mention')) {
              e.preventDefault();
              nodeAtCursor.remove();
              handleInput();
              return;
            }
          }
        }
        
        // Handle Delete key when cursor is at end of text node before a mention
        if (e.key === 'Delete' && range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
          const textNode = range.startContainer;
          const textContent = textNode.textContent || '';
          
          if (range.startOffset === textContent.length) {
            const nextSibling = textNode.nextSibling;
            
            if (nextSibling && 
                nextSibling.nodeType === Node.ELEMENT_NODE && 
                (nextSibling as Element).classList.contains('mention')) {
              e.preventDefault();
              nextSibling.remove();
              handleInput();
              return;
            }
          }
        }
      }
    }

    if (!showSuggestions || mentionUsers.length === 0) {
      // Handle rich text shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            document.execCommand('bold');
            break;
          case 'i':
            e.preventDefault();
            document.execCommand('italic');
            break;
          case 'u':
            e.preventDefault();
            document.execCommand('underline');
            break;
        }
      }
      return;
    }

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
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    if (textNode.nodeType === Node.TEXT_NODE) {
      const textContent = textNode.textContent || '';
      const cursorPos = range.startOffset;
      const beforeCursor = textContent.substring(0, cursorPos);
      const mentionMatch = beforeCursor.match(/@([^@\s]*)$/);
      
      if (mentionMatch) {
        const startPos = beforeCursor.lastIndexOf('@');
        const beforeMention = textContent.substring(0, startPos);
        const afterMention = textContent.substring(cursorPos);
        
        // Create mention span
        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-1 rounded font-medium';
        mentionSpan.setAttribute('data-user-id', user.id);
        mentionSpan.textContent = `@${user.fullName}`;
        mentionSpan.contentEditable = 'false';
        
        // Replace the text node
        const newTextBefore = document.createTextNode(beforeMention);
        const newTextAfter = document.createTextNode(afterMention);
        
        const parent = textNode.parentNode;
        if (parent) {
          parent.insertBefore(newTextBefore, textNode);
          parent.insertBefore(mentionSpan, textNode);
          parent.insertBefore(newTextAfter, textNode);
          parent.removeChild(textNode);
          
          // Position cursor after mention
          const newRange = document.createRange();
          newRange.setStartAfter(mentionSpan);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }

    setShowSuggestions(false);
    setMentionQuery('');
    
    // Update content
    handleInput();
  };

  // Toolbar actions
  const toggleBold = () => {
    document.execCommand('bold');
    editorRef.current?.focus();
    updateFormatStates();
  };

  const toggleItalic = () => {
    document.execCommand('italic');
    editorRef.current?.focus();
    updateFormatStates();
  };

  const toggleUnderline = () => {
    document.execCommand('underline');
    editorRef.current?.focus();
    updateFormatStates();
  };

  const toggleBulletList = () => {
    document.execCommand('insertUnorderedList');
    editorRef.current?.focus();
  };

  const toggleOrderedList = () => {
    document.execCommand('insertOrderedList');
    editorRef.current?.focus();
  };

  const insertMentionTrigger = () => {
    document.execCommand('insertText', false, '@');
    editorRef.current?.focus();
  };

  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
  }> = ({ onClick, isActive = false, disabled = false, children, title }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-md border transition-colors ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className={`relative ${className}`}>
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton
              onClick={toggleBold}
              isActive={formatStates.bold}
              disabled={disabled}
              title="Bold (Ctrl+B)"
            >
              <BoldIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={toggleItalic}
              isActive={formatStates.italic}
              disabled={disabled}
              title="Italic (Ctrl+I)"
            >
              <ItalicIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={toggleUnderline}
              isActive={formatStates.underline}
              disabled={disabled}
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            <ToolbarButton
              onClick={toggleBulletList}
              disabled={disabled}
              title="Bullet List"
            >
              <ListBulletIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={toggleOrderedList}
              disabled={disabled}
              title="Numbered List"
            >
              <NumberedListIcon className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            <ToolbarButton
              onClick={insertMentionTrigger}
              disabled={disabled}
              title="Mention User (@)"
            >
              <AtSymbolIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>

        {/* Editor Content */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className="min-h-[150px] p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
            style={{ wordBreak: 'break-word' }}
            suppressContentEditableWarning={true}
          />
          {!htmlContent && (
            <div className="absolute top-4 left-4 pointer-events-none text-gray-400 dark:text-gray-500">
              {placeholder}
            </div>
          )}
        </div>
      </div>

      {/* Mention Suggestions */}
      {showSuggestions && mentionUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg w-80 mb-1 bottom-full left-0"
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
                  src={`/api/users/profile-picture/${user.id}`}
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
    </div>
  );
};

export default HybridRichTextEditor;