import React, { useState, useEffect, useCallback, useRef } from "react";
import { Tree, Folder, FileElement } from "@/components/ui/file-tree";
import { CodeEditor } from "@/components/workspace/code-editor";
import {
  Play,
  Terminal as TerminalIcon,
  Eye,
  Code2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { CopyButton } from "@/components/ui/copy-button";
import { useWorkspace } from "@/core/hooks/useWorkspace";
import type {
  FileSystemNode,
  FolderNode,
  FileNode,
} from "@/core/services/file-system.service";
import { webContainerService } from "@/core/services/webcontainer.service";
import "xterm/css/xterm.css";

interface CodeWorkspaceProps {
  currentChat?: { id: string; demo?: string } | null;
  className?: string;
  generatedCode?: string;
}

export function CodeWorkspace({
  currentChat,
  className,
  generatedCode,
}: CodeWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [selectedFileName, setSelectedFileName] =
    useState<string>("app/page.tsx");
  const [selectedFileContent, setSelectedFileContent] = useState<string>("");
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const terminalRef = useRef<any>(null);
  const xtermRef = useRef<any>(null);
  const shellProcessRef = useRef<any>(null);

  // Use workspace hook
  const { isReady, isBooting, fileTree, previewUrl, readFile, error } =
    useWorkspace();

  // Load selected file content
  useEffect(() => {
    if (selectedFileName && isReady) {
      readFile(selectedFileName)
        .then((content) => {
          setSelectedFileContent(content);
        })
        .catch((err) => {
          console.error("Failed to read file:", err);
          setSelectedFileContent("");
        });
    }
  }, [selectedFileName, isReady, readFile, fileTree]);

  // Initialize terminal with WebContainer
  useEffect(() => {
    if (!isTerminalOpen || !terminalRef.current || !isReady) return;

    let mounted = true;

    const initTerminal = async () => {
      try {
        const { Terminal: XTerminal } = await import("xterm");
        const { FitAddon } = await import("@xterm/addon-fit");

        if (!mounted) return;

        const term = new XTerminal({
          theme: {
            background: "#000000",
            foreground: "#f4f4f5",
            cursor: "#f4f4f5",
          },
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          fontSize: 13,
          cursorBlink: true,
          convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        setTimeout(() => fitAddon.fit(), 50);

        xtermRef.current = term;

        // Start shell in WebContainer
        const container = webContainerService.getContainer();
        if (container) {
          const shellProcess = await container.spawn("jsh");
          shellProcessRef.current = shellProcess;

          // Pipe output to terminal
          shellProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                term.write(data);
              },
            })
          );

          // Handle terminal input
          const input = shellProcess.input.getWriter();
          term.onData((data) => {
            input.write(data);
          });

          // Welcome message
          term.writeln(
            "\x1b[1;32m➜\x1b[0m \x1b[1;36mCodeFrame Terminal\x1b[0m"
          );
          term.writeln("WebContainer shell ready. Type commands below:");
          term.writeln("");
        }
      } catch (error) {
        console.error("Failed to initialize terminal:", error);
      }
    };

    initTerminal();

    return () => {
      mounted = false;
      xtermRef.current?.dispose();
      shellProcessRef.current?.kill?.();
    };
  }, [isTerminalOpen, isReady]);

  // Handle file selection
  const handleFileSelect = useCallback((fileId: string) => {
    setSelectedFileName(fileId);
  }, []);

  // Download project
  const downloadProject = useCallback(async () => {
    const zip = new JSZip();

    const addNodeToZip = (node: FileSystemNode, currentPath: string) => {
      if (node.type === "file") {
        zip.file(currentPath + node.name, node.content);
      } else {
        node.children.forEach((child) =>
          addNodeToZip(child, currentPath + node.name + "/")
        );
      }
    };

    fileTree.children.forEach((child) => addNodeToZip(child, ""));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codeframe-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [fileTree]);

  // Handle run button - execute npm install and npm run dev
  const handleRun = useCallback(async () => {
    setActiveTab("preview");
    setIsTerminalOpen(true);

    if (!xtermRef.current || !shellProcessRef.current) return;

    const term = xtermRef.current;
    const input = shellProcessRef.current.input.getWriter();

    try {
      // Run npm install
      term.writeln("\n\x1b[1;33m🚀 Installing dependencies...\x1b[0m");
      await input.write("npm install\r");
      input.releaseLock();

      // Wait a bit then run dev server
      setTimeout(async () => {
        const input2 = shellProcessRef.current.input.getWriter();
        term.writeln("\n\x1b[1;33m🚀 Starting dev server...\x1b[0m");
        await input2.write("npm run dev\r");
        input2.releaseLock();
      }, 3000);
    } catch (error) {
      console.error("Failed to run commands:", error);
    }
  }, []);

  // Render file tree recursively
  const renderTree = useCallback(
    (node: FolderNode | FileNode, path = ""): React.ReactNode => {
      if (node.type === "file") {
        return (
          <FileElement
            key={path + node.name}
            name={node.name}
            id={path + node.name}
          />
        );
      }

      return (
        <Folder key={path + node.name} name={node.name} id={path + node.name}>
          {node.children.map((child) =>
            renderTree(child, `${path}${node.name}/`)
          )}
        </Folder>
      );
    },
    []
  );

  // Loading state
  if (isBooting) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full bg-black text-white",
          className
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-sm text-gray-400">Booting WebContainer...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full bg-black text-white",
          className
        )}
      >
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="text-red-500 text-4xl">⚠️</div>
          <h3 className="text-xl font-semibold">WebContainer Error</h3>
          <p className="text-sm text-gray-400">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-black text-white", className)}>
      {/* Workspace Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black">
        <div className="flex items-center gap-1">
          <div className="flex bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("code")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "code"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Code2 className="w-4 h-4" />
              Code
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "preview"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CopyButton
            content={selectedFileContent}
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          />

          <button
            onClick={downloadProject}
            className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/5 text-xs font-medium rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-md uppercase tracking-wide"
          >
            <Play className="w-3 h-3 fill-current" />
            Run
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {activeTab === "code" ? (
          <>
            {/* File Tree Sidebar */}
            <div className="w-64 border-r border-white/10 flex flex-col bg-black">
              <div className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Explorer
              </div>
              <div className="flex-1 overflow-y-auto px-2">
                <Tree
                  initialExpandedFolders={["root", "root/app"]}
                  onSelect={handleFileSelect}
                  initialSelectedFile={selectedFileName}
                >
                  {fileTree.children.map((child) => renderTree(child))}
                </Tree>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tab Bar */}
              <div className="flex items-center border-b border-white/10 bg-black px-2 overflow-x-auto">
                <div className="flex items-center gap-2 px-3 py-2 border-t-2 border-blue-500 bg-white/5 text-sm">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  {selectedFileName}
                </div>
              </div>

              <div className="flex-1 relative">
                <CodeEditor
                  code={selectedFileContent}
                  language={
                    selectedFileName.endsWith("css")
                      ? "css"
                      : selectedFileName.endsWith("json")
                      ? "json"
                      : selectedFileName.endsWith("html")
                      ? "html"
                      : "typescript"
                  }
                  onChange={(val) => val && setSelectedFileContent(val)}
                />
              </div>

              {/* Terminal */}
              {isTerminalOpen && (
                <div className="h-1/3 border-t border-white/10 bg-black flex flex-col">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <TerminalIcon className="w-3 h-3" />
                      <span>Terminal</span>
                    </div>
                    <button
                      onClick={() => setIsTerminalOpen(false)}
                      className="text-gray-500 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <div ref={terminalRef} className="flex-1 min-h-0 bg-black" />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Preview Mode */
          <div className="flex-1 bg-white border-l border-white/10 h-full w-full">
            {/* Address Bar */}
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-4 flex-1 bg-white border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-600 font-mono shadow-sm">
                {previewUrl || "Waiting for server..."}
              </div>
            </div>
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[calc(100%-45px)]"
                title="Preview"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                  <span>Waiting for server...</span>
                  <button
                    onClick={handleRun}
                    className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                  >
                    Start Server
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
