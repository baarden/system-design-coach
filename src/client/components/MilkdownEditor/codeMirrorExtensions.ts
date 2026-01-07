import { keymap, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentWithTab, defaultKeymap } from '@codemirror/commands';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

export const minimalSetup = [
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  autocompletion(),
  closeBrackets(),
  keymap.of([...closeBracketsKeymap, indentWithTab, ...defaultKeymap]),
];
