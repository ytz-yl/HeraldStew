import { spawn } from "child_process"
import { createWriteStream } from "fs"
import { tmpdir } from "os"
import { join } from "path"

export async function runCommand(
  command: string,
  cwd?: string,
  timeout = 120_000,
  detached = false,
  onOutput?: (chunk: string) => void,
): Promise<string> {
  return new Promise((resolve) => {
    const logPath = join(tmpdir(), `herald-${Date.now()}.log`)
    // Always write a log for detached or timeout-detach scenarios
    let logStream: ReturnType<typeof createWriteStream> | null = null

    const child = spawn("sh", ["-c", command], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      detached,
    })

    const chunks: string[] = []
    let resolved = false
    let detachedOnTimeout = false

    const handleChunk = (data: Buffer) => {
      const text = data.toString()
      chunks.push(text)
      onOutput?.(text)
      logStream?.write(text)
    }

    child.stdout?.on("data", handleChunk)
    child.stderr?.on("data", handleChunk)

    if (detached) {
      logStream = createWriteStream(logPath)
      child.unref()
      // Return after a short wait to capture initial output
      const startTimeout = setTimeout(() => {
        if (resolved) return
        resolved = true
        const started = chunks.join("").trim()
        const msg = `Running in background (PID ${child.pid}). Log: ${logPath}`
        resolve(started ? `${started}\n\n${msg}` : msg)
      }, 2_000)

      child.on("error", (err) => {
        clearTimeout(startTimeout)
        logStream?.end()
        if (resolved) return
        resolved = true
        resolve(`Error: ${err.message}`)
      })
      return
    }

    // Non-detached: wait with timeout
    // On timeout: don't kill — detach instead, keep process running in background
    const timer = setTimeout(() => {
      detachedOnTimeout = true
      logStream = createWriteStream(logPath)
      logStream.write(chunks.join(""))  // flush already-collected output
      child.unref()
      if (resolved) return
      resolved = true
      const output = chunks.join("").trim()
      resolve(
        (output ? output + "\n\n" : "") +
        `[Timed out after ${timeout / 1000}s — process is still running in background (PID ${child.pid}). Log: ${logPath}]`
      )
    }, timeout)

    child.on("close", () => {
      clearTimeout(timer)
      logStream?.end()
      if (resolved) return
      resolved = true
      resolve(chunks.join("").trim() || "(no output)")
    })

    child.on("error", (err) => {
      clearTimeout(timer)
      logStream?.end()
      if (resolved) return
      resolved = true
      resolve(`Error: ${err.message}`)
    })
  })
}
