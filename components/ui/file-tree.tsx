import React, { createContext, useContext, useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder as FolderIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeContextType {
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  selectedFile: string | null;
  selectFile: (id: string) => void;
}

const FileTreeContext = createContext<FileTreeContextType | undefined>(
  undefined
);

interface FileTreeProps {
  children: React.ReactNode;
  className?: string;
  initialSelectedFile?: string | null;
  initialExpandedFolders?: string[];
  onSelect?: (fileId: string) => void;
}

export function Tree({
  children,
  className,
  initialSelectedFile = null,
  initialExpandedFolders = [],
  onSelect,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(initialExpandedFolders)
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(
    initialSelectedFile
  );

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectFile = useCallback(
    (id: string) => {
      setSelectedFile(id);
      onSelect?.(id);
    },
    [onSelect]
  );

  return (
    <FileTreeContext.Provider
      value={{
        expandedFolders,
        toggleFolder,
        selectedFile,
        selectFile,
      }}
    >
      <div className={cn("font-mono text-sm select-none", className)}>
        {children}
      </div>
    </FileTreeContext.Provider>
  );
}

interface FolderProps {
  children: React.ReactNode;
  name: string;
  id?: string; // Optional ID, defaults to name if not provided (not robust for duplicates but simple)
}

export function Folder({ children, name, id }: FolderProps) {
  const ctx = useContext(FileTreeContext);
  if (!ctx) throw new Error("Folder must be used within a Tree");

  const folderId = id || name;
  const isExpanded = ctx.expandedFolders.has(folderId);

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center gap-1.5 py-1 px-2 hover:bg-accent/50 rounded-sm cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          ctx.toggleFolder(folderId);
        }}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <FolderIcon className="h-4 w-4 text-blue-500/80" />
        <span>{name}</span>
      </div>
      {isExpanded && (
        <div className="pl-4 border-l border-border/40 ml-2.5 flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}

interface FileElementProps {
  name: string;
  id?: string;
}

export function FileElement({ name, id }: FileElementProps) {
  const ctx = useContext(FileTreeContext);
  if (!ctx) throw new Error("File must be used within a Tree");

  const fileId = id || name;
  const isSelected = ctx.selectedFile === fileId;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 py-1 px-2 rounded-sm cursor-pointer transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
      )}
      onClick={(e) => {
        e.stopPropagation();
        ctx.selectFile(fileId);
      }}
    >
      <File className="h-4 w-4 opacity-70" />
      <span>{name}</span>
    </div>
  );
}
