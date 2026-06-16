import { readFile as fsRead, writeFile as fsWrite, mkdir } from "fs/promises"
import { dirname } from "path"
import yaml from "js-yaml"

export async function readFile(path: string): Promise<string> {
  try {
    return await fsRead(path, "utf-8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return `File not found: ${path}`
    }
    return `Error reading file: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function writeFile(
  path: string,
  content: string,
  mode: "replace" | "merge"
): Promise<string> {
  try {
    await mkdir(dirname(path), { recursive: true })

    if (mode === "replace") {
      await fsWrite(path, content, "utf-8")
      return `Written: ${path}`
    }

    // merge mode: deep-merge JSON or YAML
    let existing: unknown = {}
    try {
      const raw = await fsRead(path, "utf-8")
      existing = path.endsWith(".yaml") || path.endsWith(".yml")
        ? yaml.load(raw)
        : JSON.parse(raw)
    } catch {
      // file doesn't exist or isn't parseable — start fresh
    }

    let incoming: unknown
    try {
      incoming = path.endsWith(".yaml") || path.endsWith(".yml")
        ? yaml.load(content)
        : JSON.parse(content)
    } catch {
      return `Error: content is not valid JSON/YAML for merge mode`
    }

    const merged = deepMerge(existing, incoming)
    const serialized = path.endsWith(".yaml") || path.endsWith(".yml")
      ? yaml.dump(merged)
      : JSON.stringify(merged, null, 2)

    await fsWrite(path, serialized, "utf-8")
    return `Merged and written: ${path}`
  } catch (err) {
    return `Error writing file: ${err instanceof Error ? err.message : String(err)}`
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
