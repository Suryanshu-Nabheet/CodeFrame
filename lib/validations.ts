import { z } from "zod";

/**
 * Chat message validation schema
 */
export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message too long (max 10,000 characters)"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional(),
  model: z.string().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  name: z
    .string()
    .min(1, "Filename cannot be empty")
    .max(255, "Filename too long")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Invalid filename. Use only letters, numbers, dots, hyphens, and underscores"
    ),
  content: z.string().max(1000000, "File too large (max 1MB)"),
  language: z.string().optional(),
});

export type FileUpload = z.infer<typeof fileUploadSchema>;

/**
 * Project creation validation schema
 */
export const projectCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Project name cannot be empty")
    .max(100, "Project name too long")
    .regex(/^[a-zA-Z0-9-_\s]+$/, "Invalid project name"),
  description: z.string().max(500, "Description too long").optional(),
  template: z
    .enum(["nextjs", "react", "vanilla", "vue", "svelte"])
    .default("react"),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;

/**
 * Chat creation validation schema
 */
export const chatCreateSchema = z.object({
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(200, "Title too long")
    .optional(),
});

export type ChatCreate = z.infer<typeof chatCreateSchema>;
