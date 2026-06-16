import { runCommand } from "./shell.js"
import { readFile, writeFile } from "./file.js"
import { fetchUrl } from "./network.js"
import { detectEnvironment } from "../utils/detect.js"

export type ToolExecutor = (name: string, input: unknown) => Promise<string>

export function createToolExecutor(): ToolExecutor {
  return async (name: string, input: unknown): Promise<string> => {
    const i = input as Record<string, unknown>
    switch (name) {
      case "run_command":
        return runCommand(i.command as string, i.cwd as string | undefined)
      case "read_file":
        return readFile(i.path as string)
      case "write_file":
        return writeFile(i.path as string, i.content as string, i.mode as "replace" | "merge")
      case "fetch_url":
        return fetchUrl(i.url as string)
      case "detect_environment":
        return detectEnvironment()
      default:
        return `Unknown tool: ${name}`
    }
  }
}
