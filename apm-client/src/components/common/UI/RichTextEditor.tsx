import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  NumberedListIcon,
  CodeBracketIcon,
  AtSymbolIcon,
} from '@heroicons/react/24/outline';
import { useSearchUsersForMentionsQuery } from '../../../store/api/userApi';
import MentionSuggestion, { MentionSuggestionRef } from './MentionSuggestion';

interface RichTextEditorProps {
  content?: string;
  onChange: (content: string) => void;
  onMentionsChange?: (mentions: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  onChange,
  onMentionsChange,
  placeholder = 'Write your post...',
  className = '',
  disabled = false,
}) => {
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [skipSearch, setSkipSearch] = React.useState(true);

  // Only search when we have a query and the search should not be skipped
  const { data: mentionUsers = [] } = useSearchUsersForMentionsQuery(
    { query: mentionQuery },
    { skip: skipSearch || mentionQuery.length < 2 }
  );
  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-1 rounded font-medium',
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            setMentionQuery(query);
            setSkipSearch(false);
            return mentionUsers;
          },
          render: () => {
            let component: ReactRenderer<MentionSuggestionRef>;
            let popup: any;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionSuggestion, {
                  props,
                  editor: props.editor,
                });

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props: any) {
                component.updateProps(props);

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }

                return component.ref?.onKeyDown(props.event);
              },

              onExit() {
                popup[0].destroy();
                component.destroy();
                setSkipSearch(true);
                setMentionQuery('');
              },
            };
          },
        },
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      
      // Extract mentions from the content
      if (onMentionsChange) {
        const mentionNodes = editor.state.doc.descendants((node) => {
          if (node.type.name === 'mention') {
            return node.attrs.id;
          }
        });
        
        const mentions: string[] = [];
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'mention') {
            mentions.push(node.attrs.id);
          }
        });
        
        onMentionsChange(mentions);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-4',
      },
    },
  }, [mentionUsers]);

  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleStrike = () => editor.chain().focus().toggleStrike().run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleCodeBlock = () => editor.chain().focus().toggleCodeBlock().run();
  const toggleHeading = (level: 1 | 2 | 3) => editor.chain().focus().toggleHeading({ level }).run();
  const insertMention = () => {
    editor.chain().focus().insertContent('@').run();
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
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            onClick={toggleBold}
            isActive={editor.isActive('bold')}
            disabled={disabled}
            title="Bold"
          >
            <BoldIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={toggleItalic}
            isActive={editor.isActive('italic')}
            disabled={disabled}
            title="Italic"
          >
            <ItalicIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={toggleStrike}
            isActive={editor.isActive('strike')}
            disabled={disabled}
            title="Strikethrough"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <ToolbarButton
            onClick={() => toggleHeading(1)}
            isActive={editor.isActive('heading', { level: 1 })}
            disabled={disabled}
            title="Heading 1"
          >
            <span className="text-sm font-bold">H1</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => toggleHeading(2)}
            isActive={editor.isActive('heading', { level: 2 })}
            disabled={disabled}
            title="Heading 2"
          >
            <span className="text-sm font-bold">H2</span>
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <ToolbarButton
            onClick={toggleBulletList}
            isActive={editor.isActive('bulletList')}
            disabled={disabled}
            title="Bullet List"
          >
            <ListBulletIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={toggleOrderedList}
            isActive={editor.isActive('orderedList')}
            disabled={disabled}
            title="Numbered List"
          >
            <NumberedListIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <ToolbarButton
            onClick={toggleCodeBlock}
            isActive={editor.isActive('codeBlock')}
            disabled={disabled}
            title="Code Block"
          >
            <CodeBracketIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <ToolbarButton
            onClick={insertMention}
            disabled={disabled}
            title="Mention User (@)"
          >
            <AtSymbolIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content */}
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white relative">
        <EditorContent 
          editor={editor}
        />
        {!content && !editor.isFocused && (
          <div className="absolute top-4 left-4 pointer-events-none">
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RichTextEditor;