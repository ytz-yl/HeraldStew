import { runCommand } from "./shell.js"
import { readFile, writeFile } from "./file.js"
import { fetchUrl } from "./network.js"
import { detectEnvironment } from "../utils/detect.js"
import { readMemory, writeMemory } from "./memory.js"

export type ToolExecutor = (name: string, input: unknown, onOutput?: (chunk: string) => void) => Promise<string>

export function createToolExecutor(): ToolExecutor {
  return async (name: string, input: unknown, onOutput?: (chunk: string) => void): Promise<string> => {
    const i = input as Record<string, unknown>
    switch (name) {
      case "run_command":
        return runCommand(
          i.command as string,
          i.cwd as string | undefined,
          (i.timeout as number | undefined) ?? 120_000,
          (i.detached as boolean | undefined) ?? false,
          onOutput,
        )
      case "read_file":
        return readFile(i.path as string)
      case "write_file":
        return writeFile(i.path as string, i.content as string, i.mode as "replace" | "merge")
      case "fetch_url":
        return fetchUrl(i.url as string, i.proxy as string | undefined)
      case "detect_environment":
        return detectEnvironment()
      case "read_memory":
        return readMemory(i.agent as string, i.file as string)
      case "write_memory":
        return writeMemory(i.agent as string, i.file as string, i.content as string)
      default:
        return `Unknown tool: ${name}`
    }
  }
}
