import { readFile, writeFile, mkdir } from "fs/promises"
import { homedir } from "os"
import { join } from "path"
import type { HeraldSession } from "./types.js"

export const HERALD_DIR = join(homedir(), ".herald")
export const SESSION_PATH = join(HERALD_DIR, "session.json")

export async function loadSession(): Promise<HeraldSession> {
  try {
    const raw = await readFile(SESSION_PATH, "utf-8")
    return JSON.parse(raw) as HeraldSession
  } catch {
    const now = new Date().toISOString()
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      messages: [],
      summary: "",
      summaryRecent: "",
      lastTokenCount: 0,
    }
  }
}

export async function saveSession(session: HeraldSession): Promise<void> {
  await mkdir(HERALD_DIR, { recursive: true })
  session.updatedAt = new Date().toISOString()
  await writeFile(SESSION_PATH, JSON.stringify(session, null, 2), "utf-8")
}
