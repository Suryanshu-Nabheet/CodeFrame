import React, { useRef, useEffect } from "react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { TodoList } from "@/components/ai-elements/todo-list";
import { useAIStatus } from "@/core/hooks/useAIStatus";

interface ChatMessage {
  type: "user" | "assistant";
  content: string | any;
  isStreaming?: boolean;
  stream?: ReadableStream<Uint8Array> | null;
}

interface Chat {
  id: string;
  demo?: string;
  url?: string;
}

interface ChatMessagesProps {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  currentChat: Chat | null;
  onStreamingComplete: (finalContent: any) => void;
  onChatData: (chatData: any) => void;
  onStreamingStarted?: () => void;
}

// Check if response contains actual file code blocks
function hasCodeBlocks(content: string): boolean {
  return /```\w+\s+filename=["']/.test(content);
}

// Remove code blocks from display
function cleanContent(content: string): string {
  // Remove file code blocks
  let cleaned = content.replace(
    /```\w+\s+filename=["'][^"']+["']\s*\n[\s\S]*?```/g,
    ""
  );

  // Remove bash commands
  cleaned = cleaned.replace(/```bash\s*\n[\s\S]*?```/g, "");

  return cleaned.trim();
}

export function ChatMessages({
  chatHistory,
  isLoading,
  currentChat,
  onStreamingComplete,
  onChatData,
  onStreamingStarted,
}: ChatMessagesProps) {
  const streamingStartedRef = useRef(false);
  const { todoItems } = useAIStatus();

  useEffect(() => {
    if (isLoading) {
      streamingStartedRef.current = false;
    }
  }, [isLoading]);

  if (chatHistory.length === 0) {
    return (
      <Conversation>
        <ConversationContent>
          <div>{/* Empty conversation */}</div>
        </ConversationContent>
      </Conversation>
    );
  }

  return (
    <>
      <Conversation>
        <ConversationContent>
          {chatHistory.map((msg, index) => {
            const contentStr =
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content);

            const isCodeResponse = hasCodeBlocks(contentStr);
            const cleanedContent = cleanContent(contentStr);

            return (
              <Message from={msg.type} key={index}>
                {msg.type === "user" ? (
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                    {contentStr}
                  </div>
                ) : msg.isStreaming ? (
                  // Show TODO list while AI is working
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader size={16} />
                      <span className="text-sm">AI is working...</span>
                    </div>
                    {todoItems.length > 0 && (
                      <TodoList
                        items={todoItems}
                        title="Building Your Project"
                      />
                    )}
                  </div>
                ) : // Completed response
                isCodeResponse ? (
                  // Code was generated
                  <div className="space-y-3">
                    <div className="text-sm text-green-400 font-medium">
                      ✅ Project generated successfully!
                    </div>
                    {todoItems.length > 0 && (
                      <TodoList items={todoItems} title="Completed Tasks" />
                    )}
                    {cleanedContent && (
                      <div className="prose dark:prose-invert max-w-none text-sm text-gray-300">
                        <MessageContent>{cleanedContent}</MessageContent>
                      </div>
                    )}
                  </div>
                ) : (
                  // Text response
                  <div className="prose dark:prose-invert max-w-none">
                    <MessageContent>{contentStr}</MessageContent>
                  </div>
                )}
              </Message>
            );
          })}
        </ConversationContent>
      </Conversation>
    </>
  );
}
