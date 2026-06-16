import { execa } from "execa"

export async function runCommand(command: string, cwd?: string): Promise<string> {
  try {
    const { stdout, stderr } = await execa("sh", ["-c", command], {
      cwd,
      reject: false,
      all: true,
    })
    const output = [stdout, stderr].filter(Boolean).join("\n").trim()
    return output || "(no output)"
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}
