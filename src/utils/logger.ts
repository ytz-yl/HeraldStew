import chalk from "chalk"

export const log = {
  info: (msg: string) => console.log(chalk.cyan("→"), msg),
  success: (msg: string) => console.log(chalk.green("✓"), msg),
  error: (msg: string) => console.error(chalk.red("✗"), msg),
  warn: (msg: string) => console.warn(chalk.yellow("!"), msg),
  tool: (name: string, detail?: string) =>
    console.log(chalk.dim(`  [${name}]${detail ? ` ${detail}` : ""}`)),
  dim: (msg: string) => console.log(chalk.dim(msg)),
}
