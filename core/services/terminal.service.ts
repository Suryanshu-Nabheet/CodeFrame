import { EventEmitter } from "events";

/**
 * Global Terminal Service
 * Allows AI commands to write to the IDE terminal
 */
class TerminalService extends EventEmitter {
  private static instance: TerminalService | null = null;
  private terminalRef: any = null;
  private writeQueue: string[] = [];

  private constructor() {
    super();
  }

  static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  setTerminal(terminal: any) {
    console.log(
      "[TerminalService] Terminal registered, queue length:",
      this.writeQueue.length
    );
    this.terminalRef = terminal;

    // Flush queued writes immediately
    if (this.writeQueue.length > 0) {
      console.log(
        "[TerminalService] Flushing",
        this.writeQueue.length,
        "queued writes"
      );
      this.writeQueue.forEach((data) => {
        if (this.terminalRef) {
          this.terminalRef.write(data);
        }
      });
      this.writeQueue = [];
    }
  }

  write(data: string) {
    if (this.terminalRef) {
      this.terminalRef.write(data);
    } else {
      console.log(
        "[TerminalService] Terminal not ready, queuing write:",
        data.substring(0, 50)
      );
      // Queue for later if terminal not ready
      this.writeQueue.push(data);
    }
  }

  writeln(data: string) {
    this.write(data + "\r\n");
  }

  clear() {
    if (this.terminalRef) {
      this.terminalRef.clear();
    }
  }

  isAvailable(): boolean {
    return this.terminalRef !== null;
  }
}

export const terminalService = TerminalService.getInstance();
