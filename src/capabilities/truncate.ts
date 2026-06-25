import { writeFileSync, mkdirSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

// Bound tool output so a single oversized result can't blow up the context.
// Modeled on opencode's tool-output-store: keep head+tail preview, spill the
// full content to a temp file the model can read back on demand.
export const MAX_LINES = 1_000
export const MAX_BYTES = 40 * 1024 // ~10k tokens

function byteLength(s: string): number {
  return Buffer.byteLength(s, "utf-8")
}

function takePrefix(input: string, maxBytes: number): string {
  let bytes = 0
  let out = ""
  for (const char of input) {
    const size = Buffer.byteLength(char, "utf-8")
    if (bytes + size > maxBytes) break
    out += char
    bytes += size
  }
  return out
}

function takeSuffix(input: string, maxBytes: number): string {
  let bytes = 0
  const out: string[] = []
  for (const char of Array.from(input).reverse()) {
    const size = Buffer.byteLength(char, "utf-8")
    if (bytes + size > maxBytes) break
    out.unshift(char)
    bytes += size
  }
  return out.join("")
}

let saveDir: string | null = null
function writeOverflow(content: string): string | null {
  try {
    if (!saveDir) {
      saveDir = join(tmpdir(), "herald-tool-output")
      mkdirSync(saveDir, { recursive: true })
    }
    const file = join(saveDir, `tool-${Date.now()}-${Math.floor(performance.now() * 1000) % 1_000_000}.txt`)
    writeFileSync(file, content, "utf-8")
    return file
  } catch {
    return null
  }
}

/**
 * Truncate a tool result to stay within line/byte limits. When over the limit,
 * the full output is spilled to a temp file and the returned string keeps a
 * head + tail preview plus a marker telling the model where to read the rest.
 */
export function truncateOutput(
  content: string,
  maxLines = MAX_LINES,
  maxBytes = MAX_BYTES,
): string {
  const lines = content.split("\n")
  if (lines.length <= maxLines && byteLength(content) <= maxBytes) {
    return content
  }

  const file = writeOverflow(content)
  const marker = file
    ? `... output truncated (${lines.length} lines, ${byteLength(content)} bytes); full content saved to ${file} — use read_file to see the rest ...`
    : `... output truncated (${lines.length} lines, ${byteLength(content)} bytes) ...`

  // Reserve room for the marker, then split the remaining budget head/tail.
  const budget = Math.max(0, maxBytes - byteLength(marker) - 2)
  const headBytes = Math.ceil(budget / 2)
  const tailBytes = Math.floor(budget / 2)
  const headLines = Math.ceil(maxLines / 2)
  const tailLines = Math.floor(maxLines / 2)

  const head = takePrefix(lines.slice(0, headLines).join("\n"), headBytes)
  const tail = takeSuffix(lines.slice(lines.length - tailLines).join("\n"), tailBytes)

  return tail ? `${head}\n${marker}\n${tail}` : `${head}\n${marker}`
}
