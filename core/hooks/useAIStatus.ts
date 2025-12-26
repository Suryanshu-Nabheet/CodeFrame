import { useState, useEffect, useCallback, useMemo } from "react";
import { aiService } from "@/core/services/ai.service";
import { TodoItem } from "@/components/ai-elements/todo-list";

export interface AIStatus {
  type: "file" | "command" | "info" | "error" | "success";
  message: string;
  timestamp: number;
}

export function useAIStatus() {
  const [statuses, setStatuses] = useState<AIStatus[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [todoState, setTodoState] = useState({
    parse: "pending" as TodoItem["status"],
    files: "pending" as TodoItem["status"],
    install: "pending" as TodoItem["status"],
    server: "pending" as TodoItem["status"],
  });

  // Memoize TODO items to prevent re-renders
  const todoItems = useMemo<TodoItem[]>(() => {
    if (!isWorking && Object.values(todoState).every((s) => s === "pending")) {
      return [];
    }

    return [
      {
        id: "parse",
        title: "Analyzing your request",
        status: todoState.parse,
      },
      {
        id: "files",
        title: "Creating project files",
        status: todoState.files,
      },
      {
        id: "install",
        title: "Installing dependencies",
        status: todoState.install,
      },
      {
        id: "server",
        title: "Starting development server",
        status: todoState.server,
      },
    ];
  }, [todoState, isWorking]);

  useEffect(() => {
    const handleApplyStart = () => {
      setIsWorking(true);
      setStatuses([
        {
          type: "info",
          message: "AI started processing...",
          timestamp: Date.now(),
        },
      ]);

      setTodoState({
        parse: "in-progress",
        files: "pending",
        install: "pending",
        server: "pending",
      });
    };

    const handleFilesApplied = ({ files }: { files: any[] }) => {
      const newStatuses = files.map((file) => ({
        type: "file" as const,
        message: `Created ${file.filename}`,
        timestamp: Date.now(),
      }));
      setStatuses((prev) => [...prev, ...newStatuses]);

      setTodoState((prev) => ({
        ...prev,
        parse: "completed",
        files: "completed",
      }));
    };

    const handleCommandStart = ({
      command,
      args,
    }: {
      command: string;
      args: string[];
    }) => {
      setStatuses((prev) => [
        ...prev,
        {
          type: "command",
          message: `Running: ${command} ${args.join(" ")}`,
          timestamp: Date.now(),
        },
      ]);

      if (command === "npm" && args.includes("install")) {
        setTodoState((prev) => ({ ...prev, install: "in-progress" }));
      } else if (
        command === "npm" &&
        (args.includes("dev") || args.includes("start"))
      ) {
        setTodoState((prev) => ({ ...prev, server: "in-progress" }));
      }
    };

    const handleCommandOutput = ({ data }: { data: string }) => {
      if (
        data.includes("✓") ||
        data.includes("success") ||
        data.includes("error")
      ) {
        setStatuses((prev) => [
          ...prev,
          {
            type: "info",
            message: data.trim(),
            timestamp: Date.now(),
          },
        ]);
      }
    };

    const handleCommandComplete = ({ command }: { command: any }) => {
      setStatuses((prev) => [
        ...prev,
        {
          type: "success",
          message: `Completed: ${command.command || command}`,
          timestamp: Date.now(),
        },
      ]);

      const cmdStr = command.command || command;
      if (cmdStr === "npm") {
        setTodoState((prev) => ({ ...prev, install: "completed" }));
      }
    };

    const handleCommandError = ({
      command,
      error,
    }: {
      command: any;
      error: any;
    }) => {
      setStatuses((prev) => [
        ...prev,
        {
          type: "error",
          message: `Failed: ${command.raw || command} - ${
            error.message || error
          }`,
          timestamp: Date.now(),
        },
      ]);

      // Mark current in-progress as error
      setTodoState((prev) => {
        const newState = { ...prev };
        Object.keys(newState).forEach((key) => {
          if (newState[key as keyof typeof newState] === "in-progress") {
            newState[key as keyof typeof newState] = "error";
          }
        });
        return newState;
      });
    };

    const handleApplyComplete = () => {
      setIsWorking(false);
      setStatuses((prev) => [
        ...prev,
        {
          type: "success",
          message: "✅ All tasks completed!",
          timestamp: Date.now(),
        },
      ]);

      setTodoState((prev) => ({ ...prev, server: "completed" }));
    };

    const handleApplyError = (error: any) => {
      setIsWorking(false);
      setStatuses((prev) => [
        ...prev,
        {
          type: "error",
          message: `Error: ${error.message || error}`,
          timestamp: Date.now(),
        },
      ]);

      setTodoState((prev) => {
        const newState = { ...prev };
        Object.keys(newState).forEach((key) => {
          if (newState[key as keyof typeof newState] === "in-progress") {
            newState[key as keyof typeof newState] = "error";
          }
        });
        return newState;
      });
    };

    aiService.on("apply:start", handleApplyStart);
    aiService.on("files:applied", handleFilesApplied);
    aiService.on("command:start", handleCommandStart);
    aiService.on("command:output", handleCommandOutput);
    aiService.on("command:complete", handleCommandComplete);
    aiService.on("command:error", handleCommandError);
    aiService.on("apply:complete", handleApplyComplete);
    aiService.on("apply:error", handleApplyError);

    return () => {
      aiService.off("apply:start", handleApplyStart);
      aiService.off("files:applied", handleFilesApplied);
      aiService.off("command:start", handleCommandStart);
      aiService.off("command:output", handleCommandOutput);
      aiService.off("command:complete", handleCommandComplete);
      aiService.off("command:error", handleCommandError);
      aiService.off("apply:complete", handleApplyComplete);
      aiService.off("apply:error", handleApplyError);
    };
  }, []);

  const clearStatuses = useCallback(() => {
    setStatuses([]);
    setTodoState({
      parse: "pending",
      files: "pending",
      install: "pending",
      server: "pending",
    });
  }, []);

  return { statuses, isWorking, todoItems, clearStatuses };
}
