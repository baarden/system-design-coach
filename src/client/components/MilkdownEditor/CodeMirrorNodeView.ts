import type { Node } from '@milkdown/prose/model';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView as CodeMirror,
  keymap as cmKeymap,
  type ViewUpdate,
} from '@codemirror/view';
import { exitCode } from '@milkdown/prose/commands';
import { undo, redo } from '@milkdown/prose/history';
import { TextSelection } from '@milkdown/prose/state';
import { minimalSetup } from './codeMirrorExtensions';
import { loadLanguage, getAvailableLanguages, findLanguageByName } from './languageLoader';

export class CodeMirrorNodeView implements NodeView {
  dom: HTMLElement;
  cm: CodeMirror;
  private languagePicker: HTMLSelectElement;
  private isFocused = false;

  private updating = false;
  private languageName: string = '';
  private readonly languageConf: Compartment;
  private readonly readOnlyConf: Compartment;

  constructor(
    public node: Node,
    public view: EditorView,
    public getPos: () => number | undefined
  ) {
    this.languageConf = new Compartment();
    this.readOnlyConf = new Compartment();

    this.cm = new CodeMirror({
      doc: this.node.textContent,
      extensions: [
        this.readOnlyConf.of(EditorState.readOnly.of(!this.view.editable)),
        this.languageConf.of([]),
        EditorState.changeFilter.of(() => this.view.editable),
        ...minimalSetup,
        cmKeymap.of(this.codeMirrorKeymap()),
        CodeMirror.updateListener.of(this.forwardUpdate),
      ],
    });

    // Create language picker
    this.languagePicker = this.createLanguagePicker();

    // Create wrapper
    this.dom = document.createElement('div');
    this.dom.className = 'milkdown-code-block';

    // Add picker and editor to wrapper
    this.dom.appendChild(this.languagePicker);
    this.dom.appendChild(this.cm.dom);

    // Track focus state
    this.cm.dom.addEventListener('focusin', () => {
      this.isFocused = true;
      this.updatePickerVisibility();
    });

    this.cm.dom.addEventListener('focusout', (e) => {
      // Don't hide if focus moved to the language picker
      if (e.relatedTarget === this.languagePicker) {
        return;
      }
      this.isFocused = false;
      this.updatePickerVisibility();
    });

    // Keep picker visible while interacting with it
    this.languagePicker.addEventListener('focus', () => {
      this.isFocused = true;
      this.updatePickerVisibility();
    });

    this.languagePicker.addEventListener('blur', () => {
      // Small delay to allow click to register
      setTimeout(() => {
        this.isFocused = false;
        this.updatePickerVisibility();
      }, 100);
    });

    this.updateLanguage();
    this.updatePickerVisibility();
  }

  private updatePickerVisibility() {
    this.languagePicker.style.display = this.isFocused ? 'block' : 'none';
  }

  private createLanguagePicker(): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'language-picker';

    // Build a map to find the primary alias for each language
    const languages = getAvailableLanguages();
    const aliasToLanguage = new Map<string, { name: string; primaryAlias: string }>();

    languages.forEach(lang => {
      const primaryAlias = lang.alias[0] || '';
      lang.alias.forEach(alias => {
        aliasToLanguage.set(alias.toLowerCase(), { name: lang.name, primaryAlias });
      });
    });

    // Add all available languages (one option per language)
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.alias[0] || ''; // Use primary alias as value
      option.textContent = lang.name;
      select.appendChild(option);
    });

    // Add "Plain text" option at the end
    const plainOption = document.createElement('option');
    plainOption.value = '';
    plainOption.textContent = 'Plain text';
    select.appendChild(plainOption);

    // Set current language (normalize to primary alias if needed)
    const currentLang = this.node.attrs.language || '';
    const langInfo = aliasToLanguage.get(currentLang.toLowerCase());

    const valueToSet = langInfo ? langInfo.primaryAlias : currentLang;

    // Find and mark the matching option as selected
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i];
      if (option.value === valueToSet) {
        option.setAttribute('selected', 'selected');
        option.selected = true;
        select.selectedIndex = i;
        break;
      }
    }

    // Handle language change
    select.addEventListener('change', (e) => {
      const newLanguage = (e.target as HTMLSelectElement).value;
      const pos = this.getPos();
      if (pos !== undefined) {
        const tr = this.view.state.tr.setNodeAttribute(pos, 'language', newLanguage);
        this.view.dispatch(tr);
      }
    });

    return select;
  }

  private forwardUpdate = (update: ViewUpdate) => {
    if (this.updating || !this.cm.hasFocus) return;

    let offset = (this.getPos() ?? 0) + 1;
    const { main } = update.state.selection;
    const selFrom = offset + main.from;
    const selTo = offset + main.to;
    const pmSel = this.view.state.selection;

    if (update.docChanged || pmSel.from !== selFrom || pmSel.to !== selTo) {
      const tr = this.view.state.tr;

      update.changes.iterChanges((fromA, toA, _fromB, toB, text) => {
        if (text.length) {
          tr.replaceWith(
            offset + fromA,
            offset + toA,
            this.view.state.schema.text(text.toString())
          );
        } else {
          tr.delete(offset + fromA, offset + toA);
        }
        offset += toB - (toA - fromA);
      });

      tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo));
      this.view.dispatch(tr);
    }
  };

  private codeMirrorKeymap() {
    const view = this.view;
    return [
      {
        key: 'ArrowUp',
        run: () => this.maybeEscape('line', -1),
      },
      {
        key: 'ArrowLeft',
        run: () => this.maybeEscape('char', -1),
      },
      {
        key: 'ArrowDown',
        run: () => this.maybeEscape('line', 1),
      },
      {
        key: 'ArrowRight',
        run: () => this.maybeEscape('char', 1),
      },
      {
        key: 'Mod-Enter',
        run: () => {
          if (!exitCode(view.state, view.dispatch)) return false;
          view.focus();
          return true;
        },
      },
      {
        key: 'Mod-z',
        run: () => undo(view.state, view.dispatch),
      },
      {
        key: 'Shift-Mod-z',
        run: () => redo(view.state, view.dispatch),
      },
      {
        key: 'Mod-y',
        run: () => redo(view.state, view.dispatch),
      },
      {
        key: 'Backspace',
        run: () => {
          const ranges = this.cm.state.selection.ranges;

          if (ranges.length > 1) return false;

          const selection = ranges[0];

          if (selection && (!selection.empty || selection.anchor > 0)) return false;

          if (this.cm.state.doc.lines >= 2) return false;

          const state = this.view.state;
          const pos = this.getPos() ?? 0;
          const tr = state.tr.replaceWith(
            pos,
            pos + this.node.nodeSize,
            state.schema.nodes.paragraph!.createChecked({}, this.node.content)
          );

          tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));

          this.view.dispatch(tr);
          this.view.focus();
          return true;
        },
      },
    ];
  }

  private maybeEscape(unit: 'line' | 'char', dir: -1 | 1): boolean {
    const { state } = this.cm;
    const { main } = state.selection;

    if (!main.empty) return false;

    if (unit === 'line') {
      const line = state.doc.lineAt(main.head);
      if (dir < 0 ? line.from > 0 : line.to < state.doc.length) return false;
    } else {
      if (dir < 0 ? main.from > 0 : main.to < state.doc.length) return false;
    }

    const pos = this.getPos() ?? 0;
    const targetPos = pos + (dir < 0 ? 0 : this.node.nodeSize);

    // When going down (dir === 1), check if there's content after the code block
    if (dir === 1) {
      const $after = this.view.state.doc.resolve(targetPos);
      if (!$after.nodeAfter) {
        // No content after, create a new paragraph
        const tr = this.view.state.tr;
        const paragraph = this.view.state.schema.nodes.paragraph!.create();
        tr.insert(targetPos, paragraph);
        tr.setSelection(TextSelection.near(tr.doc.resolve(targetPos + 1)));
        tr.scrollIntoView();
        this.view.dispatch(tr);
        this.view.focus();
        return true;
      }
    }

    const selection = TextSelection.near(
      this.view.state.doc.resolve(targetPos),
      dir
    );
    const tr = this.view.state.tr.setSelection(selection).scrollIntoView();
    this.view.dispatch(tr);
    this.view.focus();
    return true;
  }

  private updateLanguage() {
    const languageName = this.node.attrs.language;

    if (languageName === this.languageName) return;

    this.languageName = languageName;

    // Update picker to match current language (normalize to primary alias)
    this.updatePickerSelection(languageName);

    loadLanguage(languageName)
      .then((lang) => {
        if (lang) {
          this.cm.dispatch({
            effects: this.languageConf.reconfigure(lang),
          });
        } else {
          // Reset to no language support
          this.cm.dispatch({
            effects: this.languageConf.reconfigure([]),
          });
        }
      })
      .catch(console.error);
  }

  private updatePickerSelection(languageName: string) {
    // Find the option that matches this language (by any alias)
    for (let i = 0; i < this.languagePicker.options.length; i++) {
      const option = this.languagePicker.options[i];
      // Check if this option's value matches the language (could be any alias)
      if (option.value === languageName) {
        option.setAttribute('selected', 'selected');
        option.selected = true;
        this.languagePicker.selectedIndex = i;
        return;
      }
    }

    // If no direct match, try to find by normalizing
    // (This handles cases where languageName is an alias but option value is primary alias)
    const langInfo = findLanguageByName(languageName);
    if (langInfo) {
      const languages = getAvailableLanguages();
      const matchingLang = languages.find(l => l.name === langInfo.name);
      if (matchingLang) {
        const primaryAlias = matchingLang.alias[0];
        for (let i = 0; i < this.languagePicker.options.length; i++) {
          const option = this.languagePicker.options[i];
          if (option.value === primaryAlias) {
            option.setAttribute('selected', 'selected');
            option.selected = true;
            this.languagePicker.selectedIndex = i;
            return;
          }
        }
      }
    }

    // Default to empty (Plain text)
    this.languagePicker.value = '';
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;

    if (this.updating) return true;

    this.node = node;
    this.updateLanguage();

    if (this.view.editable === this.cm.state.readOnly) {
      this.cm.dispatch({
        effects: this.readOnlyConf.reconfigure(
          EditorState.readOnly.of(!this.view.editable)
        ),
      });
    }

    const change = computeChange(this.cm.state.doc.toString(), node.textContent);
    if (change) {
      this.updating = true;
      this.cm.dispatch({
        changes: { from: change.from, to: change.to, insert: change.text },
      });
      this.updating = false;
    }

    return true;
  }

  setSelection(anchor: number, head: number) {
    if (!this.cm.dom.isConnected) return;

    this.cm.focus();
    this.updating = true;
    this.cm.dispatch({ selection: { anchor, head } });
    this.updating = false;
  }

  selectNode() {
    this.cm.focus();
  }

  deselectNode() {
    // No-op
  }

  stopEvent(): boolean {
    return true;
  }

  destroy() {
    this.cm.destroy();
  }
}

function computeChange(
  oldVal: string,
  newVal: string
): { from: number; to: number; text: string } | null {
  if (oldVal === newVal) return null;

  let start = 0;
  let oldEnd = oldVal.length;
  let newEnd = newVal.length;

  while (
    start < oldEnd &&
    oldVal.charCodeAt(start) === newVal.charCodeAt(start)
  ) {
    ++start;
  }

  while (
    oldEnd > start &&
    newEnd > start &&
    oldVal.charCodeAt(oldEnd - 1) === newVal.charCodeAt(newEnd - 1)
  ) {
    oldEnd--;
    newEnd--;
  }

  return { from: start, to: oldEnd, text: newVal.slice(start, newEnd) };
}
