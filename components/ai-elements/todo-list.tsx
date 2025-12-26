"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "error";
  timestamp?: number;
}

interface TodoListProps {
  items: TodoItem[];
  title?: string;
}

export function TodoList({ items, title = "AI Workflow" }: TodoListProps) {
  if (items.length === 0) return null;

  const completedCount = items.filter((i) => i.status === "completed").length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="w-full bg-black border border-white/10 rounded-lg p-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <span className="text-xs text-gray-500">
            {completedCount}/{totalCount}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Todo Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 text-sm">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {item.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : item.status === "in-progress" ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : item.status === "error" ? (
                <Circle className="w-4 h-4 text-red-400" />
              ) : (
                <Circle className="w-4 h-4 text-gray-600" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={
                  item.status === "completed"
                    ? "text-gray-500 line-through"
                    : item.status === "in-progress"
                    ? "text-white"
                    : item.status === "error"
                    ? "text-red-400"
                    : "text-gray-400"
                }
              >
                {item.title}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Success Message */}
      {progress === 100 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            All tasks completed
          </p>
        </div>
      )}
    </div>
  );
}
