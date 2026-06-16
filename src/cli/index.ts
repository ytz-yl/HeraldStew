import { program } from "commander"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { runOnce } from "../conversation/loop.js"
import { detectEnvironment } from "../utils/detect.js"
import { log } from "../utils/logger.js"
import { resolveProvider, loadConfig } from "../llm/provider.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = join(__dirname, "../../package.json")

let version = "0.1.0"
try {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string }
  version = pkg.version
} catch {
  // built binary — version embedded at build time
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
    startTUI(provider, config.provider)
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
