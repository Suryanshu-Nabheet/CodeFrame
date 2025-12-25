import React, { useEffect } from "react";
import Editor, { useMonaco, loader } from "@monaco-editor/react";
import { Loader } from "@/components/ai-elements/loader";

interface CodeEditorProps {
  code: string;
  language?: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  theme?: "vs-dark" | "light";
}

export function CodeEditor({
  code,
  language = "typescript",
  onChange,
  readOnly = false,
  theme = "vs-dark",
}: CodeEditorProps) {
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      // Define a custom theme that matches the app's dark mode
      monaco.editor.defineTheme("codeframe-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#000000", // Pure black
          "editor.foreground": "#e5e5e5",
          "editor.lineHighlightBackground": "#111111",
          "editorLineNumber.foreground": "#444444",
          "editorIndentGuide.background": "#222222",
        },
      });
      monaco.editor.setTheme("codeframe-dark");
    }
  }, [monaco]);

  return (
    <div className="h-full w-full bg-black overflow-hidden relative">
      <Editor
        height="100%"
        defaultLanguage="typescript"
        language={language}
        value={code}
        theme="codeframe-dark" // Use our custom theme
        onChange={onChange}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'Geist Mono', 'Fira Code', monospace",
          lineHeight: 1.6,
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          folding: true,
          renderLineHighlight: "all",
        }}
        loading={
          <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
            <Loader size={16} />
            <span className="text-sm">Initializing Editor...</span>
          </div>
        }
      />
    </div>
  );
}
