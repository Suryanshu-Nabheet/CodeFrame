import React, { useRef, useEffect, useState, useMemo } from "react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { AILoadingState } from "@/components/ai-elements/ai-loading-state";

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

// Extract planning steps from AI response
function extractPlanningSteps(content: string): string[] {
  const planMatch = content.match(
    /```json filename="__plan__\.json"\s*\n([\s\S]*?)```/
  );
  if (planMatch) {
    try {
      const plan = JSON.parse(planMatch[1]);
      return plan.steps || [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Check if response contains actual file code blocks (not just markdown code)
function hasCodeBlocks(content: string): boolean {
  // Only consider code blocks with filename attribute as actual code
  return /```\w+\s+filename=["']/.test(content);
}

// Remove code blocks and planning from display
function cleanContent(content: string): string {
  // Remove planning block
  let cleaned = content.replace(
    /```json filename="__plan__\.json"\s*\n[\s\S]*?```/g,
    ""
  );

  // Remove file code blocks
  cleaned = cleaned.replace(
    /```\w+\s+filename=["'][^"']+["']\s*\n[\s\S]*?```/g,
    ""
  );

  // Remove bash commands
  cleaned = cleaned.replace(/```bash\s*\n[\s\S]*?```/g, "");

  return cleaned.trim();
}

// Calculate current step based on content progress
function calculateCurrentStep(content: string, steps: string[]): number {
  if (steps.length === 0) return 0;

  // Count how many code blocks have been generated
  const codeBlocks = (content.match(/```/g) || []).length / 2;

  // Estimate progress based on code blocks
  const estimatedProgress = Math.min(codeBlocks / 10, 1);
  return Math.floor(estimatedProgress * steps.length);
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

            // Extract planning steps for streaming messages
            const steps =
              msg.type === "assistant" && msg.isStreaming
                ? extractPlanningSteps(contentStr)
                : [];

            const currentStep =
              steps.length > 0 && msg.isStreaming
                ? calculateCurrentStep(contentStr, steps)
                : 0;

            const isCodeResponse = hasCodeBlocks(contentStr);
            const cleanedContent = cleanContent(contentStr);

            return (
              <Message from={msg.type} key={index}>
                {msg.type === "user" ? (
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                    {contentStr}
                  </div>
                ) : msg.isStreaming ? (
                  steps.length > 0 ? (
                    // Complex request with planning
                    <AILoadingState steps={steps} currentStep={currentStep} />
                  ) : (
                    // Simple question or no planning yet
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader size={16} />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )
                ) : // Completed response
                isCodeResponse ? (
                  // Code was generated
                  <div className="space-y-2">
                    <div className="text-sm text-green-400">
                      ✅ Project generated successfully!
                    </div>
                    <div className="text-xs text-gray-500">
                      Check the IDE on the right to see your code →
                    </div>
                  </div>
                ) : (
                  // Simple answer (no code)
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-200">
                    {cleanedContent || contentStr}
                  </div>
                )}
              </Message>
            );
          })}
          {isLoading && !chatHistory[chatHistory.length - 1]?.isStreaming && (
            <div className="flex justify-center py-4">
              <Loader size={16} className="text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </ConversationContent>
      </Conversation>
    </>
  );
}
