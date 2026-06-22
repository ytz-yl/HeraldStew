import fs from "fs"
import path from "path"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import type { AgentObserver, AgentStaticInfo, SessionInfo, SubAgentInfo } from "../observer.js"

const execFileAsync = promisify(execFile)

interface JsonlMetadata {
  cwd: string
  sessionId: string
  title: string
}

function parseJsonlMetadata(jsonlPath: string): JsonlMetadata {
  let cwd = ""
  let sessionId = ""
  let title = ""

  try {
    const content = fs.readFileSync(jsonlPath, "utf-8")
    const lines = content.split("\n").filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.cwd && !cwd) cwd = obj.cwd
        if (obj.sessionId && !sessionId) sessionId = obj.sessionId
        if (obj.type === "user" && obj.message?.content && !title) {
          title = typeof obj.message.content === "string"
            ? obj.message.content
            : Array.isArray(obj.message.content)
              ? obj.message.content
                  .filter((b: { type: string }) => b.type === "text")
                  .map((b: { text: string }) => b.text)
                  .join(" ")
              : ""
          if (title.length > 200) title = title.slice(0, 200)
        }
        if (cwd && sessionId && title) break
      } catch { /* skip malformed line */ }
    }
  } catch { /* file not readable */ }

  return { cwd, sessionId, title }
}

function getSubAgents(projectDir: string, sessionId: string): SubAgentInfo[] {
  const subDir = path.join(projectDir, sessionId, "subagents")
  const agents: SubAgentInfo[] = []
  try {
    const files = fs.readdirSync(subDir)
    for (const f of files) {
      if (!f.endsWith(".meta.json")) continue
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(subDir, f), "utf-8"))
        agents.push({
          id: f.replace(".meta.json", ""),
          type: meta.agentType ?? "unknown",
          description: meta.description,
          active: false,
        })
      } catch { /* skip */ }
    }
  } catch { /* dir not found */ }
  return agents
}

export class ClaudeCodeObserver implements AgentObserver {
  async getStaticInfo(): Promise<AgentStaticInfo> {
    const home = os.homedir()
    let installed = false
    let version: string | undefined

    try {
      const { stdout } = await execFileAsync("claude", ["--version"], { timeout: 5000 })
      const out = stdout.trim()
      if (out && !out.includes("not found")) {
        installed = true
        version = out.split("\n")[0]
      }
    } catch { /* not installed */ }

    if (!installed) {
      try {
        if (fs.existsSync(path.join(home, ".claude", "settings.json"))) {
          installed = true
        }
      } catch { /* no config */ }
    }

    return { name: "claude-code", installed, version }
  }

  async getLiveSessions(): Promise<SessionInfo[]> {
    const home = os.homedir()
    const projectsDir = path.join(home, ".claude", "projects")
    const tasksDir = path.join(home, ".claude", "tasks")
    const sessions: SessionInfo[] = []

    if (!fs.existsSync(projectsDir)) return sessions

    const projectDirs = fs.readdirSync(projectsDir)
    for (const dirname of projectDirs) {
      const fullDir = path.join(projectsDir, dirname)
      if (!fs.statSync(fullDir).isDirectory()) continue

      const entries = fs.readdirSync(fullDir).filter((f) => f.endsWith(".jsonl"))

      for (const jsonlFile of entries) {
        const sessionId = jsonlFile.replace(".jsonl", "")
        const jsonlPath = path.join(fullDir, jsonlFile)
        const meta = parseJsonlMetadata(jsonlPath)

        let active = false
        try {
          if (fs.existsSync(path.join(tasksDir, sessionId, ".lock"))) active = true
        } catch { /* no lock */ }

        const stat = fs.statSync(jsonlPath)
        const subAgents = getSubAgents(fullDir, sessionId)

        sessions.push({
          id: sessionId,
          project: meta.cwd || dirname,
          title: meta.title || undefined,
          active,
          startedAt: stat.birthtime?.toISOString() ?? stat.mtime.toISOString(),
          subAgents: subAgents.length > 0 ? subAgents : undefined,
        })
      }
    }

    return sessions
  }
}
