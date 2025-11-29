import React, { Fragment, useState, useEffect, useRef } from "react";
import optionsCtx from "../context";

import Editor, { useMonaco } from "@monaco-editor/react";
//https://codesandbox.io/p/sandbox/react-monaco-single-line-forked-nsmhp6?file=%2Fsrc%2FApp.js%3A28%2C31
export const SingleLineEditor = ({ setProp, value, propKey }) => {
  const handleEditorWillMount = (monaco) => {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      noLib: true,
      allowNonTsExtensions: true,
    });
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      [
        "declare function Foo(a: number,b: number, name: string (optional)) :void",
        "const someString: string ",
      ].join("\n")
    );
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
