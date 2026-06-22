import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import os from "os"
import type { AgentObserver, AgentStaticInfo, SessionInfo } from "../observer.js"

const execFileAsync = promisify(execFile)

interface ProcessInfo {
  pid: number
  cwd: string
}

async function findOpenCodeProcesses(): Promise<ProcessInfo[]> {
  const procs: ProcessInfo[] = []
  try {
    const { stdout } = await execFileAsync("ps", ["-eo", "pid,args"], { timeout: 5000 })
    for (const line of stdout.split("\n")) {
      const match = line.match(/^\s*(\d+)\s+.*opencode/)
      if (!match) continue
      const pid = Number(match[1])
      let cwd = ""
      if (os.platform() === "linux") {
        try {
          cwd = fs.readlinkSync(`/proc/${pid}/cwd`)
        } catch { /* no permission or process exited */ }
      }
      procs.push({ pid, cwd })
    }
  } catch { /* ps failed */ }
  return procs
}

export class OpenCodeObserver implements AgentObserver {
  async getStaticInfo(): Promise<AgentStaticInfo> {
    let installed = false
    let version: string | undefined

    try {
      const { stdout } = await execFileAsync("opencode", ["--version"], { timeout: 5000 })
      const out = stdout.trim()
      if (out && !out.includes("not found")) {
        installed = true
        version = out.split("\n")[0]
      }
    } catch { /* not installed */ }

    if (!installed) {
      const configPaths = [
        path.join(os.homedir(), ".config", "opencode"),
        path.join(os.homedir(), ".opencode"),
      ]
      for (const p of configPaths) {
        if (fs.existsSync(p)) { installed = true; break }
      }
    }

    return { name: "opencode", installed, version }
  }

  async getLiveSessions(): Promise<SessionInfo[]> {
    const procs = await findOpenCodeProcesses()
    const sessions: SessionInfo[] = procs.map((p) => ({
      id: `pid-${p.pid}`,
      project: p.cwd || "(unknown)",
      active: true,
    }))

    const byProject = new Map<string, SessionInfo[]>()
    for (const s of sessions) {
      if (!byProject.has(s.project)) byProject.set(s.project, [])
      byProject.get(s.project)!.push(s)
    }

    const merged: SessionInfo[] = []
    for (const [project, sess] of byProject) {
      if (sess.length === 1) {
        merged.push(sess[0])
      } else {
        merged.push({
          id: `group-${project.replace(/\//g, "_")}`,
          project,
          active: true,
          title: `${sess.length} processes`,
        })
      }
    }

    return merged
  }
}
