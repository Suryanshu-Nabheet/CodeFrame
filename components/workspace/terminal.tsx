import { useEffect, useRef } from "react";
import "xterm/css/xterm.css";

interface TerminalProps {
  onData?: (data: string) => void;
}

export function Terminal({ onData }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null); // term instance
  const fitAddonRef = useRef<any>(null); // fit addon instance
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    const initTerminal = async () => {
      const { Terminal: XTerminal } = await import("xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (!isMounted) return;

      const term = new XTerminal({
        theme: {
          background: "#000000",
          foreground: "#f4f4f5",
          cursor: "#f4f4f5",
          selectionBackground: "rgba(255, 255, 255, 0.3)",
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,
        cursorBlink: true,
        convertEol: true,
        disableStdin: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      terminalRef.current = term;
      fitAddonRef.current = fitAddon;

      // Open terminal in container - ensuring DOM is ready and visible
      const openTerminal = () => {
        if (!containerRef.current) return;
        // Check if visible
        if (
          containerRef.current.clientWidth === 0 ||
          containerRef.current.clientHeight === 0
        ) {
          // If not visible yet, retry quickly
          requestAnimationFrame(openTerminal);
          return;
        }

        term.open(containerRef.current);

        // Slight delay for fit to ensure metrics are ready
        setTimeout(() => {
          fitAddon.fit();
        }, 50);
      };

      requestAnimationFrame(openTerminal);

      // Welcome message
      term.writeln("\x1b[1;32m➜\x1b[0m \x1b[1;36mCodeFrame\x1b[0m Ready");
      term.writeln("Type a command to run...");

      term.onData((data: string) => {
        term.write(data);
        onData?.(data);
      });

      // Resize logic
      const fit = () => {
        if (!terminalRef.current || !fitAddonRef.current) return;
        const term = terminalRef.current;
        if (!term.element?.parentElement) return;

        // Ensure container is visible and has dimensions
        const rect = term.element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        try {
          // Check if dimensions are valid before proposing
          const dims = fitAddon.proposeDimensions();
          if (!dims || isNaN(dims.cols) || isNaN(dims.rows)) return;
          fitAddon.fit();
        } catch (e) {
          console.warn("Fit error", e);
        }
      };

      // Initial fit
      requestAnimationFrame(() => {
        setTimeout(fit, 100);
      });

      // Observer
      observerRef.current = new ResizeObserver(() => {
        requestAnimationFrame(fit);
      });
      observerRef.current.observe(containerRef.current!);
    };

    initTerminal();

    return () => {
      isMounted = false;
      observerRef.current?.disconnect();
      terminalRef.current?.dispose();
    };
  }, [onData]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black overflow-hidden"
      style={{ minHeight: "100px" }} // Ensure some height
    />
  );
}
