// Core types for the file system
// Used across services and components

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
