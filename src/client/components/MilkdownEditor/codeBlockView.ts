import { $view } from '@milkdown/utils';
import { codeBlockSchema } from '@milkdown/preset-commonmark';
import { CodeMirrorNodeView } from './CodeMirrorNodeView';

export const codeBlockView = $view(codeBlockSchema.node, () => {
  return (node, view, getPos) => new CodeMirrorNodeView(node, view, getPos as () => number);
});
