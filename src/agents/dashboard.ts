import { ClaudeCodeObserver } from "./claude-code/observer.js"
import { HermesObserver } from "./hermes/observer.js"
import { OpenCodeObserver } from "./opencode/observer.js"
import { CodexObserver } from "./codex/observer.js"
import type { AgentStatus, AgentStaticInfo, ProjectGroup } from "./observer.js"
import { groupByProject } from "./observer.js"

const OBSERVERS = [
  new ClaudeCodeObserver(),
  new HermesObserver(),
  new OpenCodeObserver(),
  new CodexObserver(),
]

let staticCache: AgentStaticInfo[] | null = null

async function getStaticInfoCached(): Promise<AgentStaticInfo[]> {
  if (staticCache) return staticCache
  staticCache = await Promise.all(OBSERVERS.map((o) => o.getStaticInfo()))
  return staticCache
}

async function buildStatuses(statics: AgentStaticInfo[]): Promise<AgentStatus[]> {
  const liveSessions = await Promise.all(OBSERVERS.map((o) => o.getLiveSessions()))
  return statics.map((s, i) => {
    const sessions = liveSessions[i]
    return {
      ...s,
      sessions,
      activeSessionCount: sessions.filter((sess) => sess.active).length,
      totalSessionCount: sessions.length,
    }
  })
}

export async function getDashboardData(): Promise<{
  statuses: AgentStatus[]
  projects: ProjectGroup[]
}> {
  const statics = await getStaticInfoCached()
  const statuses = await buildStatuses(statics)
  const projects = groupByProject(statuses)
  return { statuses, projects }
}

export async function getDashboardLiveData(statics: AgentStaticInfo[]): Promise<{
  statuses: AgentStatus[]
  projects: ProjectGroup[]
}> {
  const statuses = await buildStatuses(statics)
  const projects = groupByProject(statuses)
  return { statuses, projects }
}

export { getStaticInfoCached }
