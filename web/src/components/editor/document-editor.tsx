'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import { useEffect } from 'react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Quote, 
  Undo, Redo, Heading1, Heading2,
  Highlighter, Superscript as SupIcon, Subscript as SubIcon, Table as TableIcon
} from 'lucide-react'

interface MenuButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function MenuButton({ onClick, isActive = false, disabled = false, title, children }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-all duration-200 ${
        isActive
          ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      title={title}
    >
      {children}
    </button>
  )
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null
  }

  return (
    <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-white sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()} title="Undo">
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()} title="Redo">
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </MenuButton>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
         <MenuButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Highlight">
          <Highlighter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} title="Subscript">
          <SubIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} title="Superscript">
          <SupIcon className="w-4 h-4" />
        </MenuButton>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </MenuButton>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="w-4 h-4" />
        </MenuButton>
      </div>

      <div className="flex items-center gap-1">
        <MenuButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} isActive={editor.isActive('table')} title="Insert Table">
          <TableIcon className="w-4 h-4" />
        </MenuButton>
        {editor.isActive('table') && (
           <>
            <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="text-[10px] font-medium px-2 py-1 hover:bg-teal-50 text-teal-600 rounded border border-teal-100 ml-1">+Col</button>
            <button onClick={() => editor.chain().focus().addRowAfter().run()} className="text-[10px] font-medium px-2 py-1 hover:bg-teal-50 text-teal-600 rounded border border-teal-100">+Row</button>
            <button onClick={() => editor.chain().focus().deleteTable().run()} className="text-[10px] font-medium px-2 py-1 hover:bg-red-50 text-red-600 rounded border border-red-100">Del</button>
           </>
        )}
      </div>
    </div>
  )
}

interface DocumentEditorProps {
  content: string
  onUpdate?: (content: string) => void
  editable?: boolean
  isLegalFormat?: boolean
  showStampPlaceholder?: boolean
  legalPageClassName?: string
}

export default function DocumentEditor({ 
  content, 
  onUpdate, 
  editable = true, 
  isLegalFormat = false,
  showStampPlaceholder = true,
  legalPageClassName,
}: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      Subscript,
      Superscript,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start drafting legal document...',
      }),
    ],
    content,
    immediatelyRender: false,
    editable,
    editorProps: {
       attributes: {
        class: 'max-w-none focus:outline-none min-h-[40rem] p-8 text-gray-900 font-serif leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:text-gray-900 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-4 [&_h2]:text-gray-800 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-teal-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:mb-4 [&_blockquote]:text-gray-600 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_th]:text-left [&_th]:font-bold',
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Expose insert method or handle AI insertion via prop/effect if needed
  // For now, prompt the user to use the toolbar

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col h-full relative">
       <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-white sticky top-0 z-20 shadow-sm justify-between">
          <div className="flex-1">
             <MenuBar editor={editor} />
          </div>
       </div>

      <div className="flex-1 overflow-y-auto bg-gray-100/50 p-4 flex justify-center">
        <div 
          className={`
            bg-white shadow-lg transition-all duration-300 relative
            ${isLegalFormat 
              ? `w-[216mm] min-h-[330mm] ${legalPageClassName || 'pt-[90mm] pl-[40mm] pr-[25mm] pb-[25mm]'} border-t-0`
              : 'max-w-[210mm] w-full min-h-[297mm] p-[25mm] my-4 border border-gray-200'}
          `}
          style={isLegalFormat ? { boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' } : {}}
        >
           {isLegalFormat && showStampPlaceholder && (
             <div className="absolute top-0 left-0 w-full h-[85mm] border-b border-dashed border-gray-300 flex items-center justify-center pointer-events-none">
               <span className="text-gray-400/30 text-sm uppercase tracking-widest font-bold">Reserved for Court Stamp</span>
             </div>
           )}

          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
