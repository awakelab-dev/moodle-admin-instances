// Editor WYSIWYG para el cuerpo de las plantillas de email — sustituye al
// textarea de HTML plano. Expone un método imperativo `insertPlaceholder`
// para que PlaceholderPicker pueda insertar una variable en la posición del
// cursor sin que el padre tenga que conocer el estado interno de TipTap.
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from '@/components/ui/button';
import { placeholderLabel } from '@/lib/placeholders';

// Pensado para alguien que no sabe programar: una variable como
// {{firstname}} no se muestra como texto en bruto, sino como una "pastilla"
// con su nombre en castellano y una × para quitarla con un clic — nada de
// tener que seleccionar y borrar llaves a mano. Es un nodo ATÓMICO (no se
// puede escribir dentro ni partir en dos): Backspace/Supr también la borra
// entera de una vez.
//
// El texto que de verdad se guarda (lo que ve el backend/plugin de Moodle
// para sustituir la variable) sigue siendo literalmente "{{key}}" dentro del
// <span> — ver renderHTML. La pastilla con el nombre bonito y el botón × son
// SOLO la vista de edición (ver addNodeView); el email final no carga el CSS
// de esta app, así que al destinatario le llega el texto sustituido normal,
// sin ninguna pastilla.
const PLACEHOLDER_TOKEN_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const PLACEHOLDER_SPAN_RE = /<span[^>]*data-placeholder-key="([a-zA-Z0-9_]+)"[^>]*>\s*\{\{\1\}\}\s*<\/span>/g;

// Deshace primero cualquier pastilla ya guardada (idempotencia: si no se
// desarma antes, re-envolver el HTML en cada edición anidaría spans sin
// parar) y luego envuelve cada "{{key}}" en el span que PlaceholderToken
// reconoce vía parseHTML.
//
// IMPORTANTE: tiene que tocar solo nodos de TEXTO, nunca el HTML en bruto
// con un regex de string — un placeholder puede usarse como destino de un
// enlace (ej. <a href="{{survey_link_url}}">), y reemplazar ese texto a
// ciegas metía un <span> DENTRO del atributo href, rompiendo el HTML (visto
// en QA: el enlace se abría como texto suelto y roto). Por eso se recorre
// el DOM con un TreeWalker de solo texto, que nunca entra en atributos.
function wrapPlaceholdersAsChips(html) {
  if (!html) return html;
  const plain = html.replace(PLACEHOLDER_SPAN_RE, '{{$1}}');

  const container = document.createElement('div');
  container.innerHTML = plain;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    PLACEHOLDER_TOKEN_RE.lastIndex = 0;
    if (PLACEHOLDER_TOKEN_RE.test(node.nodeValue)) textNodes.push(node);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    PLACEHOLDER_TOKEN_RE.lastIndex = 0;
    const parts = textNode.nodeValue.split(PLACEHOLDER_TOKEN_RE);
    // String.split con un regex de un solo grupo de captura intercala:
    // [textoAntes, key1, textoEntre, key2, ..., textoDespués].
    const fragment = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2 === 0) {
        if (part) fragment.appendChild(document.createTextNode(part));
      } else {
        const span = document.createElement('span');
        span.setAttribute('data-placeholder-key', part);
        span.textContent = `{{${part}}}`;
        fragment.appendChild(span);
      }
    });
    textNode.replaceWith(fragment);
  }

  return container.innerHTML;
}

const PlaceholderToken = Node.create({
  name: 'placeholderToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    // rendered:false — si no, TipTap también volcaría esto como atributo
    // HTML key="..." además del data-placeholder-key de abajo (visto en
    // una plantilla guardada: <span key="firstname" data-placeholder-key=
    // "firstname">). Solo debe existir el segundo.
    return { key: { default: '', rendered: false } };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-placeholder-key]',
        getAttrs: (el) => ({ key: el.getAttribute('data-placeholder-key') || '' }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-placeholder-key': node.attrs.key }),
      `{{${node.attrs.key}}}`,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span');
      dom.className = 'placeholder-chip';
      dom.contentEditable = 'false';

      const label = document.createElement('span');
      label.className = 'placeholder-chip-label';
      label.textContent = placeholderLabel(node.attrs.key);
      dom.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'placeholder-chip-remove';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `Quitar variable "${placeholderLabel(node.attrs.key)}"`);
      removeBtn.title = 'Quitar esta variable';
      // mousedown con preventDefault: evita que el editor pierda/mueva el
      // foco antes de que llegue el click (si no, a veces el clic caía
      // sobre otra posición del texto, visto en pruebas).
      removeBtn.addEventListener('mousedown', (e) => e.preventDefault());
      removeBtn.addEventListener('click', () => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (typeof pos !== 'number') return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });
      dom.appendChild(removeBtn);

      return { dom };
    };
  },
});

// Extiende el Link estándar con un atributo `class` propio del enlace (no
// global) — así un enlace concreto puede marcarse como "botón" (class=
// "button", el que detecta inlineContentStyles en el backend para pintarlo
// con fondo) sin afectar al resto de enlaces del cuerpo. Se desactiva el
// Link que trae StarterKit por defecto (`link: false`) para no duplicar la
// extensión "link" (visto en QA antes: "Duplicate extension names found").
const ButtonLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
      },
    };
  },
});

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
    // El Link de StarterKit se desactiva aquí (link: false) porque se
    // sustituye por ButtonLink (ver arriba, con el atributo `class` propio
    // del enlace) — mantenerlos los dos duplicaría el nombre 'link'.
    extensions: [
      StarterKit.configure({ link: false }),
      ButtonLink.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['paragraph'] }),
      PlaceholderToken,
    ],
    content: wrapPlaceholdersAsChips(value || ''),
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
    const nextContent = wrapPlaceholdersAsChips(value || '');
    if (nextContent !== editor.getHTML()) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  useImperativeHandle(ref, () => ({
    insertPlaceholder(key) {
      if (!editor) return;
      editor.chain().focus().insertContent({ type: 'placeholderToken', attrs: { key } }).run();
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
        <ToolbarButton
          active={editor.isActive('link', { class: 'button' })}
          title="Marca el enlace seleccionado como botón (fondo de color) en el email"
          onClick={() => {
            if (!editor.isActive('link')) {
              window.alert('Selecciona primero un enlace (o créalo con "Enlace") para convertirlo en botón.');
              return;
            }
            const isButton = editor.isActive('link', { class: 'button' });
            editor
              .chain()
              .focus()
              .extendMarkRange('link')
              .updateAttributes('link', { class: isButton ? null : 'button' })
              .run();
          }}
        >
          Botón
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          title="Centrar párrafo"
          onClick={() => editor.chain().focus().toggleTextAlign('center').run()}
        >
          Centrar
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
