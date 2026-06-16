import readline from "readline"
import chalk from "chalk"
import { runAgentLoop, type ChatMessage } from "../llm/client.js"
import { resolveProvider } from "../llm/provider.js"
import { createToolExecutor } from "../capabilities/index.js"
import { log } from "../utils/logger.js"

function formatToolDetail(input: unknown): string {
  if (typeof input === "object" && input !== null) {
    return Object.entries(input as Record<string, unknown>)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ")
  }
  return String(input)
}

export async function startConversation(): Promise<void> {
  const provider = await resolveProvider()
  const executor = createToolExecutor()
  const history: ChatMessage[] = []

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  console.log(chalk.bold.cyan("\nHeraldStew") + chalk.dim(" — AI agent configuration assistant"))
  console.log(chalk.dim("Type your request, or 'exit' to quit.\n"))

  const prompt = () =>
    new Promise<string>((resolve) => {
      rl.question(chalk.bold.green("You: "), resolve)
    })

  while (true) {
    const input = (await prompt()).trim()
    if (!input) continue
    if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
      console.log(chalk.dim("\nGoodbye!"))
      rl.close()
      break
    }

    history.push({ role: "user", content: input })
    process.stdout.write(chalk.bold.cyan("\nHerald: "))

    try {
      const reply = await runAgentLoop(
        provider,
        history,
        executor,
        (text) => process.stdout.write(text),
        (toolName, input) => log.tool(toolName, formatToolDetail(input))
      )
      history.push({ role: "assistant", content: reply })
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err))
    }

    console.log("\n")
  }
}

export async function runOnce(message: string): Promise<void> {
  const provider = await resolveProvider()
  const executor = createToolExecutor()

  try {
    await runAgentLoop(
      provider,
      [{ role: "user", content: message }],
      executor,
      (text) => process.stdout.write(text),
      (toolName, input) => log.tool(toolName, formatToolDetail(input))
    )
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
