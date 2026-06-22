import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import os from "os"
import type { AgentObserver, AgentStaticInfo, SessionInfo } from "../observer.js"

const execFileAsync = promisify(execFile)

export class CodexObserver implements AgentObserver {
  async getStaticInfo(): Promise<AgentStaticInfo> {
    let installed = false
    let version: string | undefined

    try {
      const { stdout } = await execFileAsync("codex", ["--version"], { timeout: 5000 })
      const out = stdout.trim()
      if (out && !out.includes("not found")) {
        installed = true
        version = out.split("\n")[0]
      }
    } catch { /* not installed */ }

    if (!installed) {
      if (fs.existsSync(path.join(os.homedir(), ".codex"))) installed = true
    }

    return { name: "codex", installed, version }
  }

  async getLiveSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = []
    try {
      const { stdout } = await execFileAsync("ps", ["-eo", "pid,args"], { timeout: 5000 })
      for (const line of stdout.split("\n")) {
        const match = line.match(/^\s*(\d+)\s+.*codex/)
        if (!match) continue
        const pid = Number(match[1])
        let cwd = ""
        if (os.platform() === "linux") {
          try { cwd = fs.readlinkSync(`/proc/${pid}/cwd`) } catch { /* no permission */ }
        }
        sessions.push({ id: `pid-${pid}`, project: cwd || "(unknown)", active: true })
      }
    } catch { /* ps failed */ }
    return sessions
  }
}
