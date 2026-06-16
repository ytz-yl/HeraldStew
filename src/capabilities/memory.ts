import { readFile, writeFile, mkdir } from "fs/promises"
import { homedir } from "os"
import { join } from "path"

const MEMORY_DIR = join(homedir(), ".herald", "memory")
const SAFE = /^[a-z0-9-]+$/

function validate(agent: string, file: string): void {
  if (!SAFE.test(agent)) throw new Error(`Invalid agent name: "${agent}" (only a-z, 0-9, - allowed)`)
  if (!SAFE.test(file)) throw new Error(`Invalid file name: "${file}" (only a-z, 0-9, - allowed)`)
}

export async function readMemory(agent: string, file: string): Promise<string> {
  validate(agent, file)
  const path = join(MEMORY_DIR, agent, `${file}.json`)
  try {
    return await readFile(path, "utf-8")
  } catch {
    return `(no memory file found at ${path})`
  }
}

export async function writeMemory(agent: string, file: string, content: string): Promise<string> {
  validate(agent, file)
  const dir = join(MEMORY_DIR, agent)
  const path = join(dir, `${file}.json`)
  await mkdir(dir, { recursive: true })
  await writeFile(path, content, "utf-8")
  return `Memory written to ${path}`
}
