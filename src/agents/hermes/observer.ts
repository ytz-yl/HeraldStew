import fs from "fs"
import path from "path"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import initSqlJs from "sql.js"
import type { AgentObserver, AgentStaticInfo, SessionInfo, SubAgentInfo } from "../observer.js"

const execFileAsync = promisify(execFile)

export class HermesObserver implements AgentObserver {
  private dbPath: string

  constructor() {
    this.dbPath = path.join(os.homedir(), ".hermes", "state.db")
  }

  async getStaticInfo(): Promise<AgentStaticInfo> {
    let installed = false
    let version: string | undefined

    try {
      const { stdout } = await execFileAsync("hermes", ["--version"], { timeout: 5000 })
      const out = stdout.trim()
      if (out && !out.includes("not found")) {
        installed = true
        const vMatch = out.match(/v(\d+\.\d+\.\d+)/)
        version = vMatch ? `hermes ${vMatch[0]}` : out.split("\n")[0].split("·")[0].trim()
      }
    } catch { /* not installed */ }

    if (!installed) {
      if (fs.existsSync(this.dbPath)) installed = true
    }

    return { name: "hermes", installed, version }
  }

  async getLiveSessions(): Promise<SessionInfo[]> {
    if (!fs.existsSync(this.dbPath)) return []

    const sessions: SessionInfo[] = []

    try {
      const SQL = await initSqlJs()
      const buf = fs.readFileSync(this.dbPath)
      const db = new SQL.Database(buf)

      const rows = db.exec(
        "SELECT id, title, cwd, started_at, ended_at, parent_session_id, message_count, input_tokens, output_tokens FROM sessions ORDER BY started_at DESC"
      )

      if (rows.length > 0 && rows[0].values.length > 0) {
        const cols = rows[0].columns
        const idx = (name: string) => cols.indexOf(name)

        for (const row of rows[0].values) {
          const sessionId = String(row[idx("id")])
          const endedAt = row[idx("ended_at")]
          const startedAt = row[idx("started_at")]

          sessions.push({
            id: sessionId,
            project: String(row[idx("cwd")] || ""),
            title: row[idx("title")] ? String(row[idx("title")]) : undefined,
            active: endedAt === null || endedAt === undefined,
            startedAt: startedAt ? new Date(Number(startedAt) * 1000).toISOString() : undefined,
            messageCount: row[idx("message_count")] ? Number(row[idx("message_count")]) : undefined,
            tokenUsage: {
              input: row[idx("input_tokens")] ? Number(row[idx("input_tokens")]) : undefined,
              output: row[idx("output_tokens")] ? Number(row[idx("output_tokens")]) : undefined,
            },
          })
        }

        for (const s of sessions) {
          const subAgents: SubAgentInfo[] = sessions
            .filter((other) => {
              const raw = rows[0].values.find((r) => String(r[idx("id")]) === other.id)
              return raw && String(raw[idx("parent_session_id")]) === s.id
            })
            .map((sub) => ({
              id: sub.id,
              type: "sub-session",
              description: sub.title,
              active: sub.active,
            }))
          if (subAgents.length > 0) {
            s.subAgents = subAgents
          }
        }
      }

      db.close()
    } catch (err) {
      sessions.push({
        id: "error",
        project: "",
        active: false,
        title: `Failed to read state.db: ${err instanceof Error ? err.message : String(err)}`,
      })
    }

    return sessions.filter((s) => s.id !== "error")
  }
}
