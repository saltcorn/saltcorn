import React, { Fragment, useState, useEffect, useRef } from "react";
import optionsCtx from "../context";

import Editor, { useMonaco } from "@monaco-editor/react";

const scTypeToTsType = (tynm) => {
  return (
    {
      String: "string",
      Integer: "number",
      Float: "number",
      Bool: "boolean",
      Date: "Date",
      HTML: "string",
    }[tynm] || "any"
  );
};

// from lib.dom.d.ts
const consoleTS = `
interface Console {
    error(...data: any[]): void;
    log(...data: any[]): void;
    info(...data: any[]): void;
    debug(...data: any[]): void;
    warn(...data: any[]): void;
}
declare var console: Console;
`;

const setMonacoLanguage = (monaco, options) => {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    noLib: true,
    allowNonTsExtensions: true,
  });

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    [
      ...options.fields.map(
        (f) => `const ${f.name}: ${scTypeToTsType(f.type)}`
      ),
      consoleTS,
      `const row: {
      ${options.fields.map(
        (f) => `${f.name}: ${scTypeToTsType(f.type)};`
      ).join("\n")}
      }`
    ].join("\n")
  );
  // for code ending in return: https://github.com/microsoft/monaco-editor/issues/1661
  // codes for await ignore are shown by hover card
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    //noSemanticValidation: false,
    //noSyntaxValidation: false,
    diagnosticCodesToIgnore: [/* top-level return */ 1108, 1378, 1375],
  });
};

export const SingleLineEditor = ({ setProp, value, propKey }) => {
  const options = React.useContext(optionsCtx);

  const handleEditorWillMount = (monaco) => {
    setMonacoLanguage(monaco, options);
  };
  return (
    <div className="form-control p-0 pt-2">
      <Editor
        height="26px"
        value={value}
        onChange={(value) => {
          setProp((prop) => (prop[propKey] = value));
        }}
        defaultLanguage="typescript"
        //onMount={handleEditorDidMount}
        //beforeMount={handleEditorWillMount}
        options={singleLineEditorOptions}
        //theme="myCoolTheme"
        beforeMount={handleEditorWillMount}
      />
    </div>
  );
};

export const MultiLineCodeEditor = ({ setProp, value, onChange }) => {
  const options = React.useContext(optionsCtx);

  const handleEditorWillMount = (monaco) => {
    setMonacoLanguage(monaco, options);
  };
  return (
    <div className="form-control p-0 pt-2">
      <Editor
        height="150px"
        value={value}
        onChange={onChange}
        defaultLanguage="typescript"
        //onMount={handleEditorDidMount}
        //beforeMount={handleEditorWillMount}
        options={multiLineEditorOptions}
        //theme="myCoolTheme"
        beforeMount={handleEditorWillMount}
      />
    </div>
  );
};

const multiLineEditorOptions = {
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
