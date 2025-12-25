import { EventEmitter } from "events";
import { fileSystemService, FileOperation } from "./file-system.service";
import { webContainerService } from "./webcontainer.service";

export interface CodeBlock {
  filename: string;
  content: string;
  language: string;
}

export interface Command {
  command: string;
  args: string[];
  raw: string;
}

export interface AIResponse {
  codeBlocks: CodeBlock[];
  commands: Command[];
  text: string;
}

/**
 * AIService - Handles AI response parsing and code application
 *
 * Features:
 * - Parse AI responses for code blocks
 * - Extract filenames and content
 * - Parse terminal commands
 * - Apply code to file system
 * - Execute commands
 * - Real-time updates
 */
export class AIService extends EventEmitter {
  private static instance: AIService | null = null;

  private constructor() {
    super();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Parse AI response into structured format
   */
  parseResponse(aiResponse: string): AIResponse {
    const codeBlocks = this.extractCodeBlocks(aiResponse);
    const commands = this.extractCommands(aiResponse);

    return {
      codeBlocks,
      commands,
      text: aiResponse,
    };
  }

  /**
   * Extract code blocks with filenames
   * Supports multiple formats:
   * - ```tsx filename="app/page.tsx"
   * - ```typescript file="src/index.ts"
   * - ```js // app.js
   */
  private extractCodeBlocks(text: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];

    // Pattern 1: filename="..." or file="..."
    const pattern1 =
      /```(\w+)?\s+(?:filename|file)=["']([^"']+)["']\s*\n([\s\S]*?)```/g;
    let match;

    while ((match = pattern1.exec(text)) !== null) {
      const language = match[1] || "plaintext";
      const filename = match[2];
      const content = match[3].trim();

      blocks.push({ filename, content, language });
    }

    // Pattern 2: Comment with filename (e.g., // app/page.tsx)
    const pattern2 = /```(\w+)?\s*\n(?:\/\/|#)\s*([^\n]+)\n([\s\S]*?)```/g;

    while ((match = pattern2.exec(text)) !== null) {
      const language = match[1] || "plaintext";
      const filename = match[2].trim();
      const content = match[3].trim();

      // Only if filename looks like a path
      if (filename.includes("/") || filename.includes(".")) {
        blocks.push({ filename, content, language });
      }
    }

    return blocks;
  }

  /**
   * Extract terminal commands from bash/sh blocks
   */
  private extractCommands(text: string): Command[] {
    const commands: Command[] = [];

    // Match bash/sh/zsh blocks without filenames
    const pattern = /```(?:bash|sh|zsh|shell)\s*\n([\s\S]*?)```/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const content = match[1].trim();

      // Skip if it looks like it has a filename
      if (content.startsWith("//") || content.startsWith("#")) {
        const firstLine = content.split("\n")[0];
        if (firstLine.includes("/") || firstLine.includes(".")) {
          continue;
        }
      }

      // Parse individual commands
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      for (const line of lines) {
        const parts = line.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        commands.push({ command, args, raw: line });
      }
    }

    return commands;
  }

  /**
   * Apply AI-generated code to file system
   */
  async applyCode(aiResponse: string): Promise<{
    filesCreated: number;
    filesUpdated: number;
    commandsExecuted: number;
  }> {
    this.emit("apply:start");

    try {
      const parsed = this.parseResponse(aiResponse);

      // Apply code blocks
      const operations: FileOperation[] = parsed.codeBlocks.map((block) => ({
        type: "create" as const,
        path: block.filename,
        content: block.content,
      }));

      await fileSystemService.applyOperations(operations);

      const filesCreated = operations.length;
      this.emit("files:applied", {
        count: filesCreated,
        files: parsed.codeBlocks,
      });

      // Execute commands
      let commandsExecuted = 0;
      for (const cmd of parsed.commands) {
        try {
          await this.executeCommand(cmd);
          commandsExecuted++;
        } catch (error) {
          console.error(`Failed to execute command: ${cmd.raw}`, error);
          this.emit("command:error", { command: cmd, error });
        }
      }

      this.emit("apply:complete", {
        filesCreated,
        filesUpdated: 0,
        commandsExecuted,
      });

      return {
        filesCreated,
        filesUpdated: 0,
        commandsExecuted,
      };
    } catch (error) {
      this.emit("apply:error", error);
      throw error;
    }
  }

  /**
   * Execute a terminal command
   */
  private async executeCommand(cmd: Command): Promise<void> {
    this.emit("command:start", cmd);

    try {
      // Special handling for common commands
      if (
        cmd.command === "npm" ||
        cmd.command === "pnpm" ||
        cmd.command === "yarn"
      ) {
        // Package manager commands
        const process = await webContainerService.spawn(cmd.command, cmd.args);

        let output = "";
        process.output.pipeTo(
          new WritableStream({
            write: (data) => {
              output += data;
              this.emit("command:output", { command: cmd, data });
            },
          })
        );

        const exitCode = await process.exit;

        if (exitCode !== 0) {
          throw new Error(`Command failed with exit code ${exitCode}`);
        }

        this.emit("command:complete", { command: cmd, exitCode, output });
      } else {
        // Other commands
        const process = await webContainerService.spawn(cmd.command, cmd.args);

        process.output.pipeTo(
          new WritableStream({
            write: (data) => {
              this.emit("command:output", { command: cmd, data });
            },
          })
        );

        await process.exit;
        this.emit("command:complete", { command: cmd });
      }
    } catch (error) {
      this.emit("command:error", { command: cmd, error });
      throw error;
    }
  }

  /**
   * Stream AI response and apply code in real-time
   */
  async streamAndApply(
    stream: ReadableStream<Uint8Array>,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        buffer += chunk;

        // Emit chunk for UI updates
        if (onChunk) {
          onChunk(chunk);
        }

        // Try to parse and apply complete code blocks
        const codeBlocks = this.extractCodeBlocks(buffer);
        if (codeBlocks.length > 0) {
          // Apply the code blocks we found
          for (const block of codeBlocks) {
            try {
              await fileSystemService.createFile(block.filename, block.content);
              this.emit("file:created:realtime", block);
            } catch (error) {
              console.error("Failed to apply code block:", error);
            }
          }

          // Clear buffer of processed blocks
          // This is a simplified approach - in production, track which blocks were processed
          buffer = "";
        }
      }

      // Apply any remaining code
      await this.applyCode(fullResponse);

      return fullResponse;
    } catch (error) {
      this.emit("stream:error", error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Validate AI response has code
   */
  hasCode(aiResponse: string): boolean {
    const parsed = this.parseResponse(aiResponse);
    return parsed.codeBlocks.length > 0 || parsed.commands.length > 0;
  }

  /**
   * Get summary of AI response
   */
  getSummary(aiResponse: string): {
    fileCount: number;
    commandCount: number;
    files: string[];
    commands: string[];
  } {
    const parsed = this.parseResponse(aiResponse);

    return {
      fileCount: parsed.codeBlocks.length,
      commandCount: parsed.commands.length,
      files: parsed.codeBlocks.map((b) => b.filename),
      commands: parsed.commands.map((c) => c.raw),
    };
  }
}

export const aiService = AIService.getInstance();
