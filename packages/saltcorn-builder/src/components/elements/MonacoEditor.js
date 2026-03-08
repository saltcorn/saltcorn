import React, { Fragment, useState, useEffect, useRef } from "react";
import optionsCtx from "../context";

import Editor, { useMonaco } from "@monaco-editor/react";

const setMonacoLanguage = async (monaco, options, isStatements) => {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    noLib: true,
    allowNonTsExtensions: true,
  });
  if (options.setMonaco) return;

  options.setMonaco = true;
  const tsres = await fetch(
    `/admin/ts-declares?${options.tableName ? `table=${options.tableName}` : ""}&user=yes`
  );
  const tsds = await tsres.text();

  monaco.languages.typescript.typescriptDefaults.addExtraLib(tsds);
  // for code ending in return: https://github.com/microsoft/monaco-editor/issues/1661
  // codes for await ignore are shown by hover card
  if (isStatements)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      //noSemanticValidation: false,
      //noSyntaxValidation: false,
      diagnosticCodesToIgnore: [1108, 1378, 1375, 7044, 2580, 80005],
    });
};

// Validate top-level keys of a where-expression object literal against valid
// field names and set Monaco error markers for any unknown keys.
const validateWhereKeys = (monaco, editor, validFieldNames) => {
  const model = editor.getModel();
  const text = model.getValue();
  const markers = [];

  let depth = 0;
  let i = 0;
  // advance to opening brace
  while (i < text.length && text[i] !== "{") i++;
  i++; // skip {

  while (i < text.length) {
    const ch = text[i];
    if (ch === "{" || ch === "[") { depth++; i++; continue; }
    if (ch === "}" || ch === "]") {
      if (depth === 0) break;
      depth--; i++; continue;
    }
    // skip strings
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch; i++;
      while (i < text.length && !(text[i] === q && text[i - 1] !== "\\")) i++;
      i++; continue;
    }
    if (depth === 0 && /[a-zA-Z_$]/.test(ch)) {
      const keyStart = i;
      while (i < text.length && /[\w$]/.test(text[i])) i++;
      const key = text.slice(keyStart, i);
      // skip whitespace then check for colon (but not ::)
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === ":" && text[j + 1] !== ":") {
        if (!validFieldNames.includes(key)) {
          const startPos = model.getPositionAt(keyStart);
          const endPos = model.getPositionAt(i);
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `'${key}' is not a field of this table`,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          });
        }
      }
      continue;
    }
    i++;
  }

  monaco.editor.setModelMarkers(model, "where-validator", markers);
};

export const SingleLineEditor = React.forwardRef(
  ({ setProp, value, propKey, onChange, onInput, className, validateWhere }, ref) => {
    const options = React.useContext(optionsCtx);

    const handleEditorWillMount = (monaco) => {
      setMonacoLanguage(monaco, options, false);
    };

    const handleEditorDidMount = (editor, monaco) => {
      if (validateWhere && options.fields) {
        // special where keys that are always valid
        const specialKeys = ["_fts", "or", "not", "eq", "id"];
        const validFieldNames = [
          ...specialKeys,
          ...options.fields.map((f) => f.name),
        ];
        const validate = () => validateWhereKeys(monaco, editor, validFieldNames);
        validate();
        editor.onDidChangeModelContent(validate);
        return;
      }

      if (!onInput) return;

      editor.onDidChangeModelContent(() => {
        const value = editor.getValue();
        onInput(value);
      });
    };

    return (
      <div ref={ref} className="form-control p-0 pt-1">
        <Editor
          placeholder={"sdfffsd"}
          className={className || ""}
          height="22px"
          value={value}
          onChange={(value) => {
            onChange && onChange(value);
            setProp && propKey && setProp((prop) => (prop[propKey] = value));
          }}
          defaultLanguage="typescript"
          //onMount={handleEditorDidMount}
          //beforeMount={handleEditorWillMount}
          options={singleLineEditorOptions}
          //theme="myCoolTheme"
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
        />
      </div>
    );
  }
);

export const MultiLineCodeEditor = ({ setProp, value, onChange, isModalEditor = false }) => {
  const options = React.useContext(optionsCtx);

  const handleEditorWillMount = (monaco) => {
    setMonacoLanguage(monaco, options, true);
  };
  return (
    <div className="form-control p-0 pt-2">
      <Editor
        height={isModalEditor ? "100%" : "150px"}
        value={value}
        onChange={onChange}
        defaultLanguage="typescript"
        //onMount={handleEditorDidMount}
        //beforeMount={handleEditorWillMount}
        options={multiLineEditorOptions}
        //theme="myCoolTheme"
        beforeMount={handleEditorWillMount}
        className={isModalEditor ? 'code-modal-form' : ''}
      />
    </div>
  );
};

const multiLineEditorOptions = {
  fontSize: "14px",
  minHeight:"80vh",
  fontWeight: "normal",
  wordWrap: "off",
  lineNumbers: "off",
  lineNumbersMinChars: 0,
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 10,
  glyphMargin: false,
  folding: false,
  // disable `Find`
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: "never",
    seedSearchStringFromSelection: false,
  },
  minimap: { enabled: false },
  // see: https://github.com/microsoft/monaco-editor/issues/1746
  wordBasedSuggestions: false,
  // avoid links underline
  links: false,
  // avoid highlight hover word
  occurrencesHighlight: false,
  cursorStyle: "line-thin",
  // hide current row highlight grey border
  // see: https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.ieditoroptions.html#renderlinehighlight
  renderLineHighlight: "none",
  contextmenu: false,
  // default selection is rounded
  roundedSelection: false,
  hover: {
    // unit: ms
    // default: 300
    delay: 100,
  },
  acceptSuggestionOnEnter: "on",
  // auto adjust width and height to parent
  // see: https://github.com/Microsoft/monaco-editor/issues/543#issuecomment-321767059
  automaticLayout: true,
  // if monaco is inside a table, hover tips or completion may casue table body scroll
  fixedOverflowWidgets: true,
};

//https://codesandbox.io/p/sandbox/react-monaco-single-line-forked-nsmhp6?file=%2Fsrc%2FApp.js%3A28%2C31
const singleLineEditorOptions = {
  fontSize: "14px",
  fontWeight: "normal",
  wordWrap: "off",
  lineNumbers: "off",
  lineNumbersMinChars: 0,
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  lineDecorationsWidth: 10,
  glyphMargin: false,
  folding: false,
  scrollBeyondLastColumn: 0,
  scrollbar: {
    horizontal: "hidden",
    vertical: "hidden",
    // avoid can not scroll page when hover monaco
    alwaysConsumeMouseWheel: false,
  },
  // disable `Find`
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: "never",
    seedSearchStringFromSelection: false,
  },
  minimap: { enabled: false },
  // see: https://github.com/microsoft/monaco-editor/issues/1746
  wordBasedSuggestions: false,
  // avoid links underline
  links: false,
  // avoid highlight hover word
  occurrencesHighlight: false,
  cursorStyle: "line-thin",
  // hide current row highlight grey border
  // see: https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.ieditoroptions.html#renderlinehighlight
  renderLineHighlight: "none",
  contextmenu: false,
  // default selection is rounded
  roundedSelection: false,
  hover: {
    // unit: ms
    // default: 300
    delay: 100,
  },
  acceptSuggestionOnEnter: "on",
  // auto adjust width and height to parent
  // see: https://github.com/Microsoft/monaco-editor/issues/543#issuecomment-321767059
  automaticLayout: true,
  // if monaco is inside a table, hover tips or completion may casue table body scroll
  fixedOverflowWidgets: true,
};
