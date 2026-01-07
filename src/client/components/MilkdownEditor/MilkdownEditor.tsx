import { useEffect, useImperativeHandle, forwardRef } from "react";
import type * as Y from "yjs";
import { MilkdownProvider, Milkdown, useEditor } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/ctx";
import { commonmark } from "@milkdown/preset-commonmark";
import { history } from "@milkdown/plugin-history";
import { collab, collabServiceCtx } from "@milkdown/plugin-collab";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey, Selection } from "@milkdown/prose/state";
import { codeBlockView } from "./codeBlockView";
import { jsonCodeBlockInputRule } from "./jsonInputRule";
import "../../styles/markdown.css";
import "./MilkdownEditor.css";

interface MilkdownEditorProps {
  yText: Y.Text | null;
  onUpdate?: (markdown: string) => void;
}

export interface MilkdownEditorRef {
  focusEnd: () => void;
}

// Custom plugin to exit code blocks with down arrow
const exitCodeBlockPlugin = $prose(() => {
  const key = new PluginKey("exitCodeBlock");

  return new Plugin({
    key,
    props: {
      handleKeyDown: (view, event) => {
        // Only handle down arrow
        if (event.key !== "ArrowDown") return false;

        const { state, dispatch } = view;
        const { selection } = state;
        const { $from, empty } = selection;

        // Only handle empty selections (cursor, not text selection)
        if (!empty) return false;

        // Find if we're inside a code block by checking parent nodes
        let codeBlockDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "code_block") {
            codeBlockDepth = d;
            break;
          }
        }

        // Not in a code block
        if (codeBlockDepth === -1) return false;

        const codeBlock = $from.node(codeBlockDepth);
        const codeBlockPos = $from.before(codeBlockDepth);
        const codeBlockEnd = codeBlockPos + codeBlock.nodeSize;

        // Check if we're at the end of the code block content
        // The cursor position should be right before the closing of the code block
        if ($from.pos !== codeBlockEnd - 1) {
          return false;
        }

        // Check if there's content after the code block
        const $after = state.doc.resolve(codeBlockEnd);
        if ($after.nodeAfter) {
          // There's already content after, let normal navigation handle it
          return false;
        }

        // We're at the end of the code block and it's the last thing in the document
        // Insert a new paragraph after the code block
        const tr = state.tr;
        const paragraph = state.schema.nodes.paragraph.create();
        tr.insert(codeBlockEnd, paragraph);
        tr.setSelection(Selection.near(tr.doc.resolve(codeBlockEnd + 1)));
        tr.scrollIntoView();
        dispatch(tr);

        return true;
      },
    },
  });
});

const MilkdownEditorInner = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(({
  yText,
  onUpdate,
}, ref) => {
  const { loading, get } = useEditor((root: HTMLElement) => {
    if (!root) return;

    const editor = Editor.make()
      .config((ctx: Ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, yText?.toString() || "");

        // Listen to markdown changes
        if (onUpdate) {
          ctx.get(listenerCtx).markdownUpdated((_ctx: Ctx, markdown: string) => {
            onUpdate(markdown);
          });
        }
      })
      .use(commonmark)
      .use(history)
      .use(listener)
      .use(collab)
      .use(codeBlockView)
      .use(jsonCodeBlockInputRule)
      .use(exitCodeBlockPlugin);

    return editor;
  });

  // Bind Yjs after editor is ready
  useEffect(() => {
    if (loading || !yText) return;

    const editor = get();
    if (!editor) return;

    try {
      editor.action((ctx: Ctx) => {
        const collabService = ctx.get(collabServiceCtx);
        collabService.bindDoc(yText.doc!).connect();
      });
    } catch (error) {
      console.error("Failed to bind Yjs to Milkdown:", error);
    }
  }, [loading, yText, get]);

  // Expose focusEnd method to parent components
  useImperativeHandle(ref, () => ({
    focusEnd: () => {
      const editor = get();
      if (editor && !loading) {
        editor.action((ctx: Ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;
          const tr = state.tr.setSelection(Selection.atEnd(state.doc));
          view.dispatch(tr);
          view.focus();
        });
      }
    },
  }), [get, loading]);

  return (
    <div className="milkdown-wrapper">
      <Milkdown />
    </div>
  );
});

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>((props, ref) => {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner {...props} ref={ref} />
    </MilkdownProvider>
  );
});
