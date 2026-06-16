import type { ToolDef } from "./types.js"

export const HERALD_TOOLS: ToolDef[] = [
  {
    name: "run_command",
    description:
      "Execute a shell command on the user's system. Use for installing tools, checking versions, verifying installations.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        cwd: {
          type: "string",
          description: "Working directory for the command (optional)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a local file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file (absolute or relative to cwd)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write or update a local file. Use replace to overwrite, merge to deep-merge JSON/YAML.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file",
        },
        content: {
          type: "string",
          description: "Content to write",
        },
        mode: {
          type: "string",
          enum: ["replace", "merge"],
          description: "replace: overwrite; merge: deep-merge with existing JSON/YAML",
        },
      },
      required: ["path", "content", "mode"],
    },
  },
  {
    name: "fetch_url",
    description: "Fetch the content of a URL (docs, version info, install scripts).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "detect_environment",
    description:
      "Detect the user's OS, shell, and which AI agent tools are installed with their versions.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
]
