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
    description: "Fetch the content of a URL (docs, version info, install scripts). If the URL is not accessible directly, pass a proxy URL via the proxy parameter (e.g. http://127.0.0.1:7897).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
        proxy: {
          type: "string",
          description: "Optional HTTP/HTTPS proxy URL, e.g. http://127.0.0.1:7897",
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
  {
    name: "read_memory",
    description:
      "Read a memory file from ~/.herald/memory/{agent}/{file}.json. Use this to recall previously saved agent state, task history, or notes. Call at the start of a conversation to recall what you know about each agent.",
    parameters: {
      type: "object",
      properties: {
        agent: {
          type: "string",
          description: "Agent framework name, e.g. claude-code, hermes, opencode, codex (lowercase letters, digits, hyphens only)",
        },
        file: {
          type: "string",
          description: "File name without extension, e.g. agent, tasks, notes (lowercase letters, digits, hyphens only)",
        },
      },
      required: ["agent", "file"],
    },
  },
  {
    name: "write_memory",
    description:
      "Write (overwrite) a memory file at ~/.herald/memory/{agent}/{file}.json. Use this to persist agent state after install/config, record completed tasks, or save user preferences. Content should be valid JSON.",
    parameters: {
      type: "object",
      properties: {
        agent: {
          type: "string",
          description: "Agent framework name, e.g. claude-code, hermes, opencode, codex (lowercase letters, digits, hyphens only)",
        },
        file: {
          type: "string",
          description: "File name without extension, e.g. agent, tasks, notes (lowercase letters, digits, hyphens only)",
        },
        content: {
          type: "string",
          description: "Content to write (should be valid JSON)",
        },
      },
      required: ["agent", "file", "content"],
    },
  },
]
