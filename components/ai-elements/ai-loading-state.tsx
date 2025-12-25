"use client";

import { useEffect, useState, useRef } from "react";

interface AILoadingStateProps {
  steps: string[];
  currentStep?: number;
}

const LoadingAnimation = ({ progress }: { progress: number }) => (
  <div className="relative w-6 h-6">
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-label={`Loading progress: ${Math.round(progress)}%`}
    >
      <defs>
        <mask id="progress-mask">
          <rect width="240" height="240" fill="black" />
          <circle
            r="120"
            cx="120"
            cy="120"
            fill="white"
            strokeDasharray={`${(progress / 100) * 754}, 754`}
            transform="rotate(-90 120 120)"
          />
        </mask>
      </defs>

      <style>
        {`
          @keyframes rotate-cw {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes rotate-ccw {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          .g-spin circle {
            transform-origin: 120px 120px;
          }
          .g-spin circle:nth-child(1) { animation: rotate-cw 8s linear infinite; }
          .g-spin circle:nth-child(2) { animation: rotate-ccw 8s linear infinite; }
          .g-spin circle:nth-child(3) { animation: rotate-cw 8s linear infinite; }
          .g-spin circle:nth-child(4) { animation: rotate-ccw 8s linear infinite; }
          .g-spin circle:nth-child(5) { animation: rotate-cw 8s linear infinite; }
          .g-spin circle:nth-child(6) { animation: rotate-ccw 8s linear infinite; }
          .g-spin circle:nth-child(2n) { animation-delay: 0.2s; }
          .g-spin circle:nth-child(3n) { animation-delay: 0.3s; }
        `}
      </style>

      <g
        className="g-spin"
        strokeWidth="16"
        strokeDasharray="18% 40%"
        mask="url(#progress-mask)"
      >
        <circle r="150" cx="120" cy="120" stroke="#FF2E7E" opacity="0.95" />
        <circle r="130" cx="120" cy="120" stroke="#00E5FF" opacity="0.95" />
        <circle r="110" cx="120" cy="120" stroke="#4ADE80" opacity="0.95" />
        <circle r="90" cx="120" cy="120" stroke="#FFA726" opacity="0.95" />
        <circle r="70" cx="120" cy="120" stroke="#FFEB3B" opacity="0.95" />
        <circle r="50" cx="120" cy="120" stroke="#FF4081" opacity="0.95" />
      </g>
    </svg>
  </div>
);

export function AILoadingState({
  steps,
  currentStep = 0,
}: AILoadingStateProps) {
  const [visibleLines, setVisibleLines] = useState<
    Array<{ text: string; number: number; completed: boolean }>
  >([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineHeight = 28;

  // Initialize with actual steps from AI
  useEffect(() => {
    if (steps.length === 0) return;

    const initialLines = steps
      .slice(0, Math.min(3, steps.length))
      .map((text, i) => ({
        text,
        number: i + 1,
        completed: i < currentStep,
      }));
    setVisibleLines(initialLines);
  }, [steps, currentStep]);

  // Update completed status when currentStep changes
  useEffect(() => {
    setVisibleLines((prev) =>
      prev.map((line, i) => ({
        ...line,
        completed: i < currentStep,
      }))
    );
  }, [currentStep]);

  // Auto-scroll to show progress
  useEffect(() => {
    if (codeContainerRef.current && currentStep > 2) {
      const scrollTo = (currentStep - 2) * lineHeight;
      codeContainerRef.current.scrollTop = scrollTo;
    }
  }, [currentStep, lineHeight]);

  const progress = steps.length > 0 ? (currentStep / steps.length) * 100 : 0;
  const currentStepText =
    steps[currentStep] || steps[steps.length - 1] || "Processing";

  return (
    <div className="flex items-center justify-center min-h-[200px] w-full py-8">
      <div className="space-y-4 w-full max-w-md">
        <div className="ml-2 flex items-center space-x-2 text-gray-300 font-medium">
          <LoadingAnimation progress={progress} />
          <span className="text-sm">{currentStepText}...</span>
        </div>

        <div className="relative">
          <div
            ref={codeContainerRef}
            className="font-mono text-xs overflow-hidden w-full h-[84px] relative rounded-lg bg-black border border-gray-800"
            style={{ scrollBehavior: "smooth" }}
          >
            <div>
              {visibleLines.map((line) => (
                <div
                  key={`${line.number}-${line.text}`}
                  className="flex h-[28px] items-center px-2"
                >
                  <div className="text-gray-600 pr-3 select-none w-6 text-right">
                    {line.number}
                  </div>
                  <div
                    className={`flex-1 ml-1 flex items-center gap-2 ${
                      line.completed ? "text-green-400" : "text-gray-200"
                    }`}
                  >
                    {line.completed && (
                      <span className="text-green-400">✓</span>
                    )}
                    {line.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-lg"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 30%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
