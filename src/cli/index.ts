import { program } from "commander"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { runOnce } from "../conversation/loop.js"
import { detectEnvironment } from "../utils/detect.js"
import { log } from "../utils/logger.js"
import { resolveProvider, loadConfig } from "../llm/provider.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

// In dev, __dirname is src/cli (package.json is ../../).
// In the published package, __dirname is dist (package.json is ../).
// Try both so the version stays correct in either layout.
let version = "0.0.0"
for (const rel of ["../package.json", "../../package.json"]) {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, rel), "utf-8")) as { version?: string; name?: string }
    if (pkg.name === "heraldstew" && pkg.version) {
      version = pkg.version
      break
    }
  } catch {
    // try next candidate
  }
}

program
  .name("herald")
  .description("Conversational AI agent configuration assistant")
  .version(version)

program
  .command("chat", { isDefault: true })
  .description("Start full-screen TUI (default)")
  .option("-m, --message <text>", "Send a single message and exit (non-interactive)")
  .action(async (opts: { message?: string }) => {
    if (opts.message) {
      await runOnce(opts.message)
      return
    }
    // Full-screen TUI
    const [provider, config] = await Promise.all([resolveProvider(), loadConfig()])
    const { startTUI } = await import("../tui/run.js")
    startTUI(provider, config.provider, config.maxContextTokens ?? 80000)
  })

program
  .command("doctor")
  .description("Check system environment and installed AI agent tools")
  .action(async () => {
    log.info("Scanning environment...\n")
    const result = await detectEnvironment()
    console.log(result)
  })

program.parse()
