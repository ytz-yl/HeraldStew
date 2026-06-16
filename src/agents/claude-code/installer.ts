import os from "os"

export interface InstallInfo {
  checkCmd: string
  installCmd: string
  note?: string
}

export function getInstallInfo(): InstallInfo {
  const platform = os.platform()

  if (platform === "win32") {
    return {
      checkCmd: "claude --version",
      installCmd: "npm install -g @anthropic-ai/claude-code",
      note: "Requires Node.js 20+. Run in PowerShell or Command Prompt.",
    }
  }

  // macOS / Linux
  return {
    checkCmd: "claude --version",
    installCmd: "npm install -g @anthropic-ai/claude-code",
    note: "Requires Node.js 20+. May need sudo on some systems.",
  }
}

export async function isInstalled(runCommand: (cmd: string) => Promise<string>): Promise<boolean> {
  const out = await runCommand("claude --version")
  return !out.startsWith("Error") && !out.includes("not found") && !out.includes("command not found")
}
