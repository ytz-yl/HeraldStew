import { readFile as fsRead, writeFile as fsWrite, mkdir } from "fs/promises"
import { join } from "path"
import yaml from "js-yaml"

export const CLAUDE_DIR = ".claude"
export const SKILLS_DIR = ".claude/commands"
export const SETTINGS_FILE = ".claude/settings.json"
export const CRON_FILE = ".claude/scheduled_tasks.json"

export interface CronEntry {
  id: string
  schedule: string
  prompt: string
  enabled: boolean
}

export interface SkillFile {
  name: string
  description: string
  content: string
}

export function buildCronEntry(schedule: string, prompt: string): CronEntry {
  return {
    id: `herald-${Date.now()}`,
    schedule,
    prompt,
    enabled: true,
  }
}

export function buildSkillFile(name: string, description: string, content: string): string {
  return `---\ndescription: ${description}\n---\n${content}\n`
}

export function mergeSettings(existing: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  return deepMerge(existing, patch) as Record<string, unknown>
}

export async function readSettings(cwd = process.cwd()): Promise<Record<string, unknown>> {
  const path = join(cwd, SETTINGS_FILE)
  try {
    const raw = await fsRead(path, "utf-8")
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function writeSettings(settings: Record<string, unknown>, cwd = process.cwd()): Promise<void> {
  const path = join(cwd, SETTINGS_FILE)
  await mkdir(join(cwd, CLAUDE_DIR), { recursive: true })
  await fsWrite(path, JSON.stringify(settings, null, 2), "utf-8")
}

export async function readCronEntries(cwd = process.cwd()): Promise<CronEntry[]> {
  const path = join(cwd, CRON_FILE)
  try {
    const raw = await fsRead(path, "utf-8")
    return JSON.parse(raw) as CronEntry[]
  } catch {
    return []
  }
}

export async function appendCronEntry(entry: CronEntry, cwd = process.cwd()): Promise<void> {
  const path = join(cwd, CRON_FILE)
  await mkdir(join(cwd, CLAUDE_DIR), { recursive: true })
  const existing = await readCronEntries(cwd)
  const updated = [...existing, entry]
  await fsWrite(path, JSON.stringify(updated, null, 2), "utf-8")
}

export async function writeSkill(name: string, description: string, content: string, cwd = process.cwd()): Promise<void> {
  const path = join(cwd, SKILLS_DIR, `${name}.md`)
  await mkdir(join(cwd, SKILLS_DIR), { recursive: true })
  await fsWrite(path, buildSkillFile(name, description, content), "utf-8")
}

export async function listSkills(cwd = process.cwd()): Promise<string[]> {
  const { readdir } = await import("fs/promises")
  try {
    const files = await readdir(join(cwd, SKILLS_DIR))
    return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
  } catch {
    return []
  }
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isObject(base) || !isObject(patch)) return patch
  const result = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    result[key] = key in result ? deepMerge(result[key], value) : value
  }
  return result
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val)
}
