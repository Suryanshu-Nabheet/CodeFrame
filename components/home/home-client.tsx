"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import {
  getErrorMessage,
  logError,
  getUserFriendlyError,
} from "@/lib/error-utils";
import { useSearchParams } from "next/navigation";
import {
  PromptInput,
  PromptInputImageButton,
  PromptInputImagePreview,
  PromptInputMicButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  createImageAttachment,
  createImageAttachmentFromStored,
  savePromptToStorage,
  loadPromptFromStorage,
  clearPromptFromStorage,
  type ImageAttachment,
} from "@/components/ai-elements/prompt-input";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import { AppHeader } from "@/components/shared/app-header";
import { CodeWorkspace } from "@/components/workspace/code-workspace";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { BottomToolbar } from "@/components/shared/bottom-toolbar";
import { useWorkspace } from "@/core/hooks/useWorkspace";
import { terminalService } from "@/core/services/terminal.service";

// Component that uses useSearchParams
function SearchParamsHandler({ onReset }: { onReset: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const reset = searchParams.get("reset");
    if (reset === "true") {
      onReset();
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("reset");
      window.history.replaceState({}, "", newUrl.pathname);
    }
  }, [searchParams, onReset]);

  return null;
}

export function HomeClient() {
  // UI State
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "preview">("chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState<
    Array<{
      type: "user" | "assistant";
      content: string;
      isStreaming?: boolean;
    }>
  >([]);

  // Workspace Integration
  const { applyAICode, isReady, previewUrl, runCommand } = useWorkspace();

  const handleReset = () => {
    setShowChatInterface(false);
    setChatHistory([]);
    setMessage("");
    setAttachments([]);
    setIsLoading(false);
    clearPromptFromStorage();

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Auto-focus and restore from storage
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    const storedData = loadPromptFromStorage();
    if (storedData) {
      setMessage(storedData.message);
      if (storedData.attachments.length > 0) {
        const restoredAttachments = storedData.attachments.map(
          createImageAttachmentFromStored
        );
        setAttachments(restoredAttachments);
      }
    }
  }, []);

  // Save to storage
  useEffect(() => {
    if (message.trim() || attachments.length > 0) {
      savePromptToStorage(message, attachments);
    } else {
      clearPromptFromStorage();
    }
  }, [message, attachments]);

  // Image handlers
  const handleImageFiles = async (files: File[]) => {
    try {
      const newAttachments = await Promise.all(
        files.map((file) => createImageAttachment(file))
      );
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      console.error("Error processing image files:", error);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  // Drag and drop
  const handleDragOver = () => setIsDragOver(true);
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = () => setIsDragOver(false);

  // Stream AI response and apply code IN REAL-TIME
  const readStream = async (response: Response) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = "";
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;
        buffer += chunk;

        // Update chat UI with streaming content
        setChatHistory((prev) => {
          const newHistory = [...prev];
          const lastMsg = newHistory[newHistory.length - 1];
          if (lastMsg && lastMsg.isStreaming) {
            newHistory[newHistory.length - 1] = {
              ...lastMsg,
              content: accumulatedContent,
            };
          }
          return newHistory;
        });

        // Try to extract and apply complete code blocks in real-time
        const codeBlockPattern =
          /```(\w+)?\s+(?:filename|file)=["']([^"']+)["']\s*\n([\s\S]*?)```/g;
        let match;
        const appliedBlocks = new Set<string>();

        while ((match = codeBlockPattern.exec(buffer)) !== null) {
          const filename = match[2];
          const content = match[3].trim();
          const blockKey = `${filename}:${content.substring(0, 50)}`;

          if (!appliedBlocks.has(blockKey)) {
            appliedBlocks.add(blockKey);
            try {
              // Apply code block immediately as it's detected
              await applyAICode(
                `\`\`\`${
                  match[1] || "typescript"
                } filename="${filename}"\n${content}\n\`\`\``
              );
              console.log(`✅ Applied ${filename} in real-time`);
            } catch (error) {
              console.error(`❌ Failed to apply ${filename}:`, error);
            }
          }
        }
      }

      // Final application of any remaining code
      try {
        await applyAICode(accumulatedContent);

        // Auto-run npm install and npm run dev
        terminalService.writeln("\n\x1b[1;36m$ npm install\x1b[0m");
        console.log("🚀 Installing dependencies...");
        const installProcess = await runCommand("npm", ["install"]);

        // Wait for install to complete and pipe to terminal
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              terminalService.write(data);
              console.log(data);
            },
          })
        );

        const installExitCode = await installProcess.exit;
        if (installExitCode === 0) {
          terminalService.writeln("\x1b[1;32m✓ Dependencies installed\x1b[0m");
          console.log("✅ Dependencies installed");
        } else {
          terminalService.writeln(
            `\x1b[1;31m✗ npm install failed with code: ${installExitCode}\x1b[0m`
          );
          console.error("❌ npm install failed with code:", installExitCode);
        }

        terminalService.writeln("\n\x1b[1;36m$ npm run dev\x1b[0m");
        console.log("🚀 Starting dev server...");
        const devProcess = await runCommand("npm", ["run", "dev"]);

        // Pipe dev server output to terminal
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              terminalService.write(data);
              console.log(data);
            },
          })
        );

        terminalService.writeln("\x1b[1;32m✓ Dev server started\x1b[0m");
        console.log("✅ Dev server started");
      } catch (error) {
        terminalService.writeln(`\x1b[1;31m✗ Error: ${error}\x1b[0m`);
        console.error("❌ Failed to run commands:", error);
      }

      // Mark as complete
      setChatHistory((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].isStreaming) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: accumulatedContent,
            isStreaming: false,
          };
        }
        return updated;
      });

      setIsLoading(false);
    } catch (err) {
      console.error("Stream reading error:", err);
      setIsLoading(false);
    } finally {
      reader.releaseLock();
    }
  };

  // Send initial message
  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    const currentAttachments = [...attachments];

    clearPromptFromStorage();
    setMessage("");
    setAttachments([]);
    setShowChatInterface(true);

    setChatHistory([
      { type: "user", content: userMessage },
      { type: "assistant", content: "", isStreaming: true },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          streaming: true,
          attachments: currentAttachments.map((att) => ({ url: att.dataUrl })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      await readStream(response);
    } catch (error) {
      logError("Error creating chat", error);
      setIsLoading(false);
      setChatHistory((prev) => {
        const newHistory = [...prev];
        if (
          newHistory.length > 0 &&
          newHistory[newHistory.length - 1].type === "assistant"
        ) {
          newHistory[newHistory.length - 1] = {
            type: "assistant",
            content: getUserFriendlyError(error),
          };
        }
        return newHistory;
      });
    }
  };

  // Send follow-up message - THIS WAS BROKEN!
  const handleChatSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    setIsLoading(true);

    // Add user message to history
    setChatHistory((prev) => [
      ...prev,
      { type: "user", content: userMessage },
      { type: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          messages: chatHistory
            .filter((msg) => !msg.isStreaming) // Don't send streaming messages
            .map((msg) => ({
              role: msg.type === "user" ? "user" : "assistant",
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
            })),
          streaming: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      await readStream(response);
    } catch (error) {
      logError("Error sending message", error);
      setIsLoading(false);
      setChatHistory((prev) => {
        const newHistory = [...prev];
        if (
          newHistory.length > 0 &&
          newHistory[newHistory.length - 1].type === "assistant"
        ) {
          newHistory[newHistory.length - 1] = {
            type: "assistant",
            content: getUserFriendlyError(error),
          };
        }
        return newHistory;
      });
    }
  };

  if (showChatInterface) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
        <Suspense fallback={null}>
          <SearchParamsHandler onReset={handleReset} />
        </Suspense>

        <AppHeader />

        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* Left Panel: Chat */}
            <div
              className={`
              ${activePanel === "chat" ? "flex" : "hidden"} 
              md:flex flex-col h-full w-full md:w-[40%] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-black
            `}
            >
              <div className="flex-1 overflow-y-auto">
                <ChatMessages
                  chatHistory={chatHistory}
                  isLoading={isLoading}
                  currentChat={null}
                  onStreamingComplete={() => {}}
                  onChatData={() => {}}
                  onStreamingStarted={() => setIsLoading(false)}
                />
              </div>

              <ChatInput
                message={message}
                setMessage={setMessage}
                onSubmit={handleChatSendMessage}
                isLoading={isLoading}
                showSuggestions={false}
              />
            </div>

            {/* Right Panel: Workspace */}
            <div
              className={`
               ${activePanel === "preview" ? "flex" : "hidden"}
               md:flex flex-col h-full w-full md:w-[60%] bg-black
            `}
            >
              <CodeWorkspace
                currentChat={null}
                generatedCode={
                  (chatHistory
                    .filter((msg) => msg.type === "assistant")
                    .slice(-1)[0]?.content as string) || ""
                }
              />
            </div>
          </div>

          <div className="md:hidden">
            <BottomToolbar
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              hasPreview={!!previewUrl}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
      <Suspense fallback={null}>
        <SearchParamsHandler onReset={handleReset} />
      </Suspense>

      <AppHeader />

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              What can we build together?
            </h2>
          </div>

          {/* Prompt Input */}
          <div className="max-w-2xl mx-auto">
            <PromptInput
              onSubmit={handleSendMessage}
              className="w-full relative"
              onImageDrop={handleImageFiles}
              isDragOver={isDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <PromptInputImagePreview
                attachments={attachments}
                onRemove={handleRemoveAttachment}
              />
              <PromptInputTextarea
                ref={textareaRef}
                onChange={(e) => setMessage(e.target.value)}
                value={message}
                placeholder="Describe what you want to build..."
                className="min-h-[80px] text-base"
                disabled={isLoading}
              />
              <PromptInputToolbar>
                <PromptInputTools>
                  <PromptInputImageButton
                    onImageSelect={handleImageFiles}
                    disabled={isLoading}
                  />
                </PromptInputTools>
                <PromptInputTools>
                  <PromptInputMicButton
                    onTranscript={(transcript) => {
                      setMessage(
                        (prev) => prev + (prev ? " " : "") + transcript
                      );
                    }}
                    onError={(error) => {
                      console.error("Speech recognition error:", error);
                    }}
                    disabled={isLoading}
                  />
                  <PromptInputSubmit
                    disabled={!message.trim() || isLoading}
                    status={isLoading ? "streaming" : "ready"}
                  />
                </PromptInputTools>
              </PromptInputToolbar>
            </PromptInput>
          </div>

          {/* Suggestions */}
          <div className="mt-4 max-w-2xl mx-auto">
            <Suggestions>
              {[
                "Build a todo app with Next.js",
                "Create a landing page",
                "Build a dashboard",
                "Make a blog",
              ].map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  onClick={() => {
                    setMessage(suggestion);
                    setTimeout(() => {
                      const form = textareaRef.current?.form;
                      if (form) {
                        form.requestSubmit();
                      }
                    }, 0);
                  }}
                  suggestion={suggestion}
                />
              ))}
            </Suggestions>
          </div>

          {/* Footer */}
          <div className="mt-8 md:mt-16 text-center text-sm text-muted-foreground">
            <div>
              <p>
                CodeFrame by{" "}
                <span className="font-semibold text-foreground">
                  Suryanshu Nabheet
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
