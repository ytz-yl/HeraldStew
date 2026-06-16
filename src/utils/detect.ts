import { runCommand } from "../capabilities/shell.js"
import os from "os"

const TOOLS = [
  { name: "claude", cmd: "claude --version" },
  { name: "hermes", cmd: "hermes --version" },
  { name: "opencode", cmd: "opencode --version" },
  { name: "codex", cmd: "codex --version" },
  { name: "node", cmd: "node --version" },
  { name: "npm", cmd: "npm --version" },
  { name: "git", cmd: "git --version" },
  { name: "brew", cmd: "brew --version" },
]

export async function detectEnvironment(): Promise<string> {
  const platform = os.platform()
  const arch = os.arch()
  const shell = process.env.SHELL ?? "unknown"

  const toolResults = await Promise.all(
    TOOLS.map(async ({ name, cmd }) => {
      const out = await runCommand(cmd)
      const installed = !out.startsWith("Error") && !out.startsWith("command not found")
      return `  ${installed ? "✓" : "✗"} ${name}${installed ? `: ${out.split("\n")[0]}` : ""}`
    })
  )

  return [
    `OS: ${platform} (${arch})`,
    `Shell: ${shell}`,
    "",
    "Installed tools:",
    ...toolResults,
  ].join("\n")
}
