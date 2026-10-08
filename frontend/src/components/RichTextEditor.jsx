// Editor WYSIWYG para el cuerpo de las plantillas de email — sustituye al
// textarea de HTML plano. Expone un método imperativo `insertPlaceholder`
// para que PlaceholderPicker pueda insertar {{key}} en la posición del
// cursor sin que el padre tenga que conocer el estado interno de TipTap.
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@/components/ui/button';

function ToolbarButton({ active, onClick, children, title }) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ padding: '0.25rem 0.6rem', height: 'auto', minWidth: 0 }}
    >
      {children}
    </Button>
  );
}

const RichTextEditor = forwardRef(function RichTextEditor({ value, onChange, placeholder }, ref) {
  const editor = useEditor({
    // StarterKit (v3) ya incluye su propia extensión Link internamente —
    // añadir @tiptap/extension-link aparte duplicaba el nombre 'link' y
    // disparaba el warning "Duplicate extension names found" en consola
    // (visto en QA). Se configura aquí, no como extensión separada.
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } })],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rte-content',
        'data-placeholder': placeholder || '',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // El valor puede cambiar desde fuera (ej. al abrir "Editar" sobre otra
  // plantilla reutilizando el mismo editor) — TipTap no re-sincroniza solo.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  useImperativeHandle(ref, () => ({
    insertPlaceholder(key) {
      if (!editor) return;
      editor.chain().focus().insertContent(`{{${key}}}`).run();
    },
  }));

  if (!editor) return null;

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar">
        <ToolbarButton
          active={editor.isActive('bold')}
          title="Negrita"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          title="Cursiva"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          title="Lista con viñetas"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          title="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          title="Enlace"
          onClick={() => {
            const previousUrl = editor.getAttributes('link').href;
            const url = window.prompt('URL del enlace', previousUrl || 'https://');
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const { from, to } = editor.state.selection;
            if (from === to) {
              // Sin texto seleccionado: insertar la URL como texto visible
              // del enlace, en vez de aplicar la marca sobre una selección
              // vacía (visto en QA: a veces se perdía el texto enlazado).
              editor.chain().focus().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
          }}
        >
          Enlace
        </ToolbarButton>
        <ToolbarButton title="Quitar formato" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          Limpiar formato
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="rte-editor-content" />
    </div>
  );
});

export default RichTextEditor;
