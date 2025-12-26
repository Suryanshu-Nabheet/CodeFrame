"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal as TerminalIcon,
} from "lucide-react";

export interface RealTimeStatus {
  type: "file" | "command" | "info" | "error" | "success";
  message: string;
  timestamp: number;
}

interface RealTimeStatusDisplayProps {
  statuses: RealTimeStatus[];
  isActive: boolean;
}

export function RealTimeStatusDisplay({
  statuses,
  isActive,
}: RealTimeStatusDisplayProps) {
  const [visibleStatuses, setVisibleStatuses] = useState<RealTimeStatus[]>([]);

  useEffect(() => {
    setVisibleStatuses(statuses.slice(-10)); // Show last 10 items
  }, [statuses]);

  if (!isActive && statuses.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-black border border-gray-800 rounded-lg p-4 font-mono text-sm">
      <div className="flex items-center gap-2 mb-3 text-blue-400 font-semibold">
        {isActive ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        )}
        <span>{isActive ? "AI Working..." : "Complete"}</span>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {visibleStatuses.map((status, idx) => (
          <div
            key={`${status.timestamp}-${idx}`}
            className="flex items-start gap-2 text-xs"
          >
            {status.type === "file" && (
              <span className="text-blue-400">📄</span>
            )}
            {status.type === "command" && (
              <TerminalIcon className="w-3 h-3 text-green-400 mt-0.5" />
            )}
            {status.type === "info" && (
              <span className="text-gray-400">ℹ️</span>
            )}
            {status.type === "error" && (
              <XCircle className="w-3 h-3 text-red-400 mt-0.5" />
            )}
            {status.type === "success" && (
              <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5" />
            )}
            <span
              className={
                status.type === "error"
                  ? "text-red-400"
                  : status.type === "success"
                  ? "text-green-400"
                  : status.type === "command"
                  ? "text-green-300"
                  : "text-gray-300"
              }
            >
              {status.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
