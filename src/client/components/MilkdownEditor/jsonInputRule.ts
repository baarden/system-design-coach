import { $inputRule } from '@milkdown/utils';
import { codeBlockSchema } from '@milkdown/preset-commonmark';
import { InputRule } from '@milkdown/prose/inputrules';
import { TextSelection } from '@milkdown/prose/state';

export const jsonCodeBlockInputRule = $inputRule((ctx) => {
  const codeBlockType = codeBlockSchema.type(ctx);

  return new InputRule(/^\{$/, (state, _match, start, _end) => {
    const { tr } = state;
    const $start = state.doc.resolve(start);

    // Find the parent node (should be a paragraph)
    const range = $start.blockRange();
    if (!range) return null;

    // Create a code block with language="json" and {}
    const codeBlock = codeBlockType.create(
      { language: 'json' },
      state.schema.text('{}')
    );

    // Replace the current block with the code block
    tr.replaceWith(range.start, range.end, codeBlock);

    // Position cursor between the braces (after {, before })
    const resolvedPos = tr.doc.resolve(range.start + 2); // +1 for code block start, +1 for {
    tr.setSelection(TextSelection.near(resolvedPos));

    return tr;
  });
});
