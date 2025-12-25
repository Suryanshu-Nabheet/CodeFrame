import { WebContainer, FileSystemTree } from "@webcontainer/api";
import { EventEmitter } from "events";
import { webContainerService } from "./webcontainer.service";

export interface FileNode {
  name: string;
  type: "file";
  content: string;
  language: string;
  path: string;
}

export interface FolderNode {
  name: string;
  type: "folder";
  children: FileSystemNode[];
  path: string;
}

export type FileSystemNode = FileNode | FolderNode;

export interface FileOperation {
  type: "create" | "update" | "delete" | "rename";
  path: string;
  content?: string;
  newPath?: string;
}

/**
 * FileSystemService - Manages file system operations
 *
 * Features:
 * - File CRUD operations
 * - Directory operations
 * - File tree management
 * - Sync between UI and WebContainer
 * - File watching
 * - Search functionality
 */
export class FileSystemService extends EventEmitter {
  private static instance: FileSystemService | null = null;
  private fileTree: FolderNode = {
    name: "root",
    type: "folder",
    children: [],
    path: "",
  };
  private watchInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    // Start watching for file system changes
    this.startWatching();
  }

  static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  /**
   * Initialize file system with template
   */
  async initialize(template: FolderNode): Promise<void> {
    try {
      this.fileTree = JSON.parse(JSON.stringify(template));

      // Convert to WebContainer format and mount
      const container = webContainerService.getContainer();
      if (container) {
        const tree = this.convertToWebContainerTree(this.fileTree);
        await container.mount(tree);
        this.emit("initialized", this.fileTree);
      }
    } catch (error) {
      this.emit("error", { operation: "initialize", error });
      throw error;
    }
  }

  /**
   * Initialize with empty file system - reads directly from WebContainer
   */
  async initializeEmpty(): Promise<void> {
    try {
      const container = webContainerService.getContainer();
      if (!container) {
        throw new Error("WebContainer not available");
      }

      // Read current file system from WebContainer
      this.fileTree = await this.readDirectoryRecursive("", container);
      this.emit("initialized", this.fileTree);
    } catch (error) {
      this.emit("error", { operation: "initializeEmpty", error });
      throw error;
    }
  }

  /**
   * Get current file tree
   */
  getFileTree(): FolderNode {
    return JSON.parse(JSON.stringify(this.fileTree));
  }

  /**
   * Create a new file
   */
  async createFile(path: string, content: string = ""): Promise<FileNode> {
    try {
      const parts = path.split("/").filter(Boolean);
      const fileName = parts.pop()!;
      const dirPath = parts.join("/");

      // Ensure directory exists
      await this.ensureDirectory(dirPath);

      // Create file in WebContainer
      const container = webContainerService.getContainer();
      if (container) {
        await container.fs.writeFile(path, content);
      }

      // Update UI tree
      const file: FileNode = {
        name: fileName,
        type: "file",
        content,
        language: this.getLanguageFromExtension(fileName),
        path,
      };

      this.addNodeToTree(path, file);
      this.emit("file:created", file);

      return file;
    } catch (error) {
      this.emit("error", { operation: "createFile", path, error });
      throw error;
    }
  }

  /**
   * Read file content
   */
  async readFile(path: string): Promise<string> {
    try {
      const container = webContainerService.getContainer();
      if (!container) {
        throw new Error("WebContainer not initialized");
      }

      const content = await container.fs.readFile(path, "utf-8");
      return content;
    } catch (error) {
      this.emit("error", { operation: "readFile", path, error });
      throw error;
    }
  }

  /**
   * Update file content
   */
  async updateFile(path: string, content: string): Promise<void> {
    try {
      // Write to WebContainer
      const container = webContainerService.getContainer();
      if (container) {
        await container.fs.writeFile(path, content);
      }

      // Update UI tree
      const file = this.findNode(path);
      if (file && file.type === "file") {
        file.content = content;
        this.emit("file:updated", file);
      }
    } catch (error) {
      this.emit("error", { operation: "updateFile", path, error });
      throw error;
    }
  }

  /**
   * Delete file or folder
   */
  async delete(path: string): Promise<void> {
    try {
      const container = webContainerService.getContainer();
      if (container) {
        const node = this.findNode(path);
        if (node?.type === "folder") {
          await container.fs.rm(path, { recursive: true });
        } else {
          await container.fs.rm(path);
        }
      }

      // Remove from UI tree
      this.removeNodeFromTree(path);
      this.emit("deleted", { path });
    } catch (error) {
      this.emit("error", { operation: "delete", path, error });
      throw error;
    }
  }

  /**
   * Rename file or folder
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      // Read content
      const node = this.findNode(oldPath);
      if (!node) throw new Error(`Node not found: ${oldPath}`);

      if (node.type === "file") {
        const content = await this.readFile(oldPath);
        await this.createFile(newPath, content);
        await this.delete(oldPath);
      } else {
        // For folders, recursively rename
        // This is complex, simplified version:
        throw new Error("Folder rename not yet implemented");
      }

      this.emit("renamed", { oldPath, newPath });
    } catch (error) {
      this.emit("error", { operation: "rename", oldPath, newPath, error });
      throw error;
    }
  }

  /**
   * Create directory
   */
  async createDirectory(path: string): Promise<FolderNode> {
    try {
      await this.ensureDirectory(path);

      const parts = path.split("/").filter(Boolean);
      const dirName = parts.pop()!;

      const folder: FolderNode = {
        name: dirName,
        type: "folder",
        children: [],
        path,
      };

      this.addNodeToTree(path, folder);
      this.emit("directory:created", folder);

      return folder;
    } catch (error) {
      this.emit("error", { operation: "createDirectory", path, error });
      throw error;
    }
  }

  /**
   * Find node by path
   */
  findNode(path: string): FileSystemNode | null {
    const parts = path.split("/").filter(Boolean);
    let current: FileSystemNode = this.fileTree;

    for (const part of parts) {
      if (current.type === "folder") {
        const child: FileSystemNode | undefined = current.children.find(
          (c) => c.name === part
        );
        if (!child) return null;
        current = child;
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Search files by name or content
   */
  searchFiles(query: string): FileNode[] {
    const results: FileNode[] = [];
    const search = (node: FileSystemNode) => {
      if (node.type === "file") {
        if (
          node.name.toLowerCase().includes(query.toLowerCase()) ||
          node.content.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push(node);
        }
      } else {
        node.children.forEach(search);
      }
    };

    search(this.fileTree);
    return results;
  }

  /**
   * Apply multiple file operations (from AI)
   * Batched to prevent file tree flickering
   */
  async applyOperations(operations: FileOperation[]): Promise<void> {
    // Suppress individual file events during batch
    const originalEmit = this.emit.bind(this);
    let suppressEvents = true;

    this.emit = function (event: string | symbol, ...args: any[]): boolean {
      if (
        suppressEvents &&
        (event === "file:created" ||
          event === "file:updated" ||
          event === "file:deleted")
      ) {
        return false; // Suppress individual file events
      }
      return originalEmit(event, ...args);
    };

    try {
      // Apply all operations
      for (const op of operations) {
        try {
          switch (op.type) {
            case "create":
            case "update":
              await this.createFile(op.path, op.content || "");
              break;
            case "delete":
              await this.delete(op.path);
              break;
            case "rename":
              if (op.newPath) {
                await this.rename(op.path, op.newPath);
              }
              break;
          }
        } catch (error) {
          console.error(
            `Failed to apply operation ${op.type} on ${op.path}:`,
            error
          );
        }
      }
    } finally {
      // Restore original emit
      suppressEvents = false;
      this.emit = originalEmit;

      // Emit single batch update event
      this.emit("operations:applied", operations);
      this.emit("tree:updated", this.fileTree);
    }
  }

  // Helper methods

  private async ensureDirectory(path: string): Promise<void> {
    if (!path) return;

    const container = webContainerService.getContainer();
    if (!container) return;

    const parts = path.split("/").filter(Boolean);
    let currentPath = "";

    for (const part of parts) {
      currentPath += (currentPath ? "/" : "") + part;
      try {
        await container.fs.mkdir(currentPath);
      } catch (error) {
        // Directory might already exist, ignore error
      }
    }
  }

  private addNodeToTree(path: string, node: FileSystemNode): void {
    const parts = path.split("/").filter(Boolean);
    const nodeName = parts.pop()!;

    let current = this.fileTree;
    for (const part of parts) {
      let folder = current.children.find(
        (c) => c.type === "folder" && c.name === part
      ) as FolderNode | undefined;

      if (!folder) {
        folder = {
          name: part,
          type: "folder",
          children: [],
          path: parts.slice(0, parts.indexOf(part) + 1).join("/"),
        };
        current.children.push(folder);
      }
      current = folder;
    }

    // Remove existing node with same name
    current.children = current.children.filter((c) => c.name !== nodeName);
    current.children.push(node);
  }

  private removeNodeFromTree(path: string): void {
    const parts = path.split("/").filter(Boolean);
    const nodeName = parts.pop()!;

    let current = this.fileTree;
    for (const part of parts) {
      const folder = current.children.find(
        (c) => c.type === "folder" && c.name === part
      ) as FolderNode | undefined;

      if (!folder) return;
      current = folder;
    }

    current.children = current.children.filter((c) => c.name !== nodeName);
  }

  private convertToWebContainerTree(node: FolderNode): FileSystemTree {
    const tree: FileSystemTree = {};

    node.children.forEach((child) => {
      if (child.type === "file") {
        tree[child.name] = {
          file: { contents: child.content },
        };
      } else {
        tree[child.name] = {
          directory: this.convertToWebContainerTree(child),
        };
      }
    });

    return tree;
  }

  private getLanguageFromExtension(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      css: "css",
      html: "html",
      md: "markdown",
    };
    return languageMap[ext || ""] || "plaintext";
  }

  /**
   * Start watching for file system changes
   */
  private startWatching(): void {
    // Poll every 2 seconds to check for changes
    this.watchInterval = setInterval(() => {
      this.refreshFileTree().catch((error) => {
        console.error("Error refreshing file tree:", error);
      });
    }, 2000);
  }

  /**
   * Stop watching for file system changes
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  /**
   * Refresh file tree from WebContainer
   */
  private async refreshFileTree(): Promise<void> {
    try {
      const container = webContainerService.getContainer();
      if (!container) return;

      // Read the entire file system from WebContainer
      const newTree = await this.readDirectoryRecursive("", container);

      // Only update if there are actual changes
      const oldTreeStr = JSON.stringify(this.fileTree);
      const newTreeStr = JSON.stringify(newTree);

      if (oldTreeStr !== newTreeStr) {
        this.fileTree = newTree;
        this.emit("tree:updated", this.fileTree);
      }
    } catch (error) {
      // Silently fail - don't spam console
    }
  }

  /**
   * Read directory recursively from WebContainer
   */
  private async readDirectoryRecursive(
    path: string,
    container: WebContainer
  ): Promise<FolderNode> {
    const entries = await container.fs.readdir(path || ".", {
      withFileTypes: true,
    });
    const children: FileSystemNode[] = [];

    for (const entry of entries) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;

      // Skip node_modules and hidden files
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isDirectory()) {
        const folder = await this.readDirectoryRecursive(fullPath, container);
        children.push({
          ...folder,
          name: entry.name,
          path: fullPath,
        });
      } else if (entry.isFile()) {
        try {
          const content = await container.fs.readFile(fullPath, "utf-8");
          children.push({
            name: entry.name,
            type: "file",
            content,
            language: this.getLanguageFromExtension(entry.name),
            path: fullPath,
          });
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    return {
      name: path.split("/").pop() || "root",
      type: "folder",
      children,
      path,
    };
  }
}

export const fileSystemService = FileSystemService.getInstance();
