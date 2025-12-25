import { useState, useEffect, useCallback } from "react";
import { webContainerService } from "../services/webcontainer.service";
import {
  fileSystemService,
  FileSystemNode,
  FolderNode,
} from "../services/file-system.service";
import { aiService } from "../services/ai.service";
import { NEXTJS_TEMPLATE } from "@/lib/templates/nextjs-starter";

// Helper to add paths to template nodes (old format -> new format)
function addPathsToTemplate(node: any, parentPath: string = ""): any {
  if (node.type === "folder") {
    const folderPath = parentPath;
    return {
      ...node,
      path: folderPath,
      children: node.children.map((child: any) => {
        const childPath = parentPath
          ? `${parentPath}/${child.name}`
          : child.name;
        return addPathsToTemplate(
          child,
          child.type === "folder" ? childPath : parentPath
        );
      }),
    };
  } else {
    const filePath = parentPath ? `${parentPath}/${node.name}` : node.name;
    return {
      ...node,
      path: filePath,
    };
  }
}

// Convert template on module load
const TEMPLATE_WITH_PATHS = addPathsToTemplate(NEXTJS_TEMPLATE, "");

export interface UseWorkspaceReturn {
  // State
  isReady: boolean;
  isBooting: boolean;
  previewUrl: string;
  fileTree: FolderNode;
  error: Error | null;

  // File operations
  createFile: (path: string, content?: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  updateFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  searchFiles: (query: string) => FileSystemNode[];

  // AI operations
  applyAICode: (aiResponse: string) => Promise<void>;
  streamAICode: (
    stream: ReadableStream<Uint8Array>,
    onChunk?: (chunk: string) => void
  ) => Promise<string>;

  // Terminal operations
  runCommand: (command: string, args?: string[]) => Promise<any>;

  // Utility
  refresh: () => void;
}

/**
 * useWorkspace - Main hook for workspace functionality
 *
 * Provides:
 * - WebContainer management
 * - File system operations
 * - AI code application
 * - Terminal access
 * - Real-time updates
 */
export function useWorkspace(): UseWorkspaceReturn {
  const [isReady, setIsReady] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileTree, setFileTree] = useState<FolderNode>(TEMPLATE_WITH_PATHS);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize WebContainer and FileSystem
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setIsBooting(true);
        setError(null);

        // Boot WebContainer
        await webContainerService.boot();

        if (!mounted) return;

        // Initialize file system
        await fileSystemService.initialize(TEMPLATE_WITH_PATHS);

        if (!mounted) return;

        setIsReady(true);
        setIsBooting(false);
      } catch (err) {
        console.error("Workspace initialization error:", err);
        if (mounted) {
          setError(err as Error);
          setIsBooting(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  // Listen for server-ready events
  useEffect(() => {
    const handleServerReady = ({ url }: { port: number; url: string }) => {
      setPreviewUrl(url);
    };

    webContainerService.on("server:ready", handleServerReady);

    return () => {
      webContainerService.off("server:ready", handleServerReady);
    };
  }, []);

  // Listen for file system changes
  useEffect(() => {
    const handleFileCreated = () => {
      setFileTree(fileSystemService.getFileTree());
    };

    const handleFileUpdated = () => {
      setFileTree(fileSystemService.getFileTree());
    };

    const handleDeleted = () => {
      setFileTree(fileSystemService.getFileTree());
    };

    fileSystemService.on("file:created", handleFileCreated);
    fileSystemService.on("file:updated", handleFileUpdated);
    fileSystemService.on("deleted", handleDeleted);
    fileSystemService.on("directory:created", handleFileCreated);

    return () => {
      fileSystemService.off("file:created", handleFileCreated);
      fileSystemService.off("file:updated", handleFileUpdated);
      fileSystemService.off("deleted", handleDeleted);
      fileSystemService.off("directory:created", handleFileCreated);
    };
  }, []);

  // File operations
  const createFile = useCallback(async (path: string, content: string = "") => {
    try {
      await fileSystemService.createFile(path, content);
    } catch (err) {
      console.error("Create file error:", err);
      throw err;
    }
  }, []);

  const readFile = useCallback(async (path: string) => {
    try {
      return await fileSystemService.readFile(path);
    } catch (err) {
      console.error("Read file error:", err);
      throw err;
    }
  }, []);

  const updateFile = useCallback(async (path: string, content: string) => {
    try {
      await fileSystemService.updateFile(path, content);
    } catch (err) {
      console.error("Update file error:", err);
      throw err;
    }
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    try {
      await fileSystemService.delete(path);
    } catch (err) {
      console.error("Delete file error:", err);
      throw err;
    }
  }, []);

  const createFolder = useCallback(async (path: string) => {
    try {
      await fileSystemService.createDirectory(path);
    } catch (err) {
      console.error("Create folder error:", err);
      throw err;
    }
  }, []);

  const searchFiles = useCallback((query: string) => {
    return fileSystemService.searchFiles(query);
  }, []);

  // AI operations
  const applyAICode = useCallback(async (aiResponse: string) => {
    try {
      await aiService.applyCode(aiResponse);
    } catch (err) {
      console.error("Apply AI code error:", err);
      throw err;
    }
  }, []);

  const streamAICode = useCallback(
    async (
      stream: ReadableStream<Uint8Array>,
      onChunk?: (chunk: string) => void
    ) => {
      try {
        return await aiService.streamAndApply(stream, onChunk);
      } catch (err) {
        console.error("Stream AI code error:", err);
        throw err;
      }
    },
    []
  );

  // Terminal operations
  const runCommand = useCallback(
    async (command: string, args: string[] = []) => {
      try {
        return await webContainerService.spawn(command, args);
      } catch (err) {
        console.error("Run command error:", err);
        throw err;
      }
    },
    []
  );

  // Utility
  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    // State
    isReady,
    isBooting,
    previewUrl,
    fileTree,
    error,

    // File operations
    createFile,
    readFile,
    updateFile,
    deleteFile,
    createFolder,
    searchFiles,

    // AI operations
    applyAICode,
    streamAICode,

    // Terminal operations
    runCommand,

    // Utility
    refresh,
  };
}
