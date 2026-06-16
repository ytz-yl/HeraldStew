import chalk from "chalk"

export const theme = {
  // Brand
  brand: (s: string) => chalk.hex("#7c6af7").bold(s),
  brandDim: (s: string) => chalk.hex("#5a4fc4")(s),

  // Roles
  userLabel: (s: string) => chalk.hex("#64b5f6").bold(s),
  assistantLabel: (s: string) => chalk.hex("#7c6af7").bold(s),

  // Tool display
  toolBadge: (name: string) =>
    chalk.bgHex("#2a2a3e").hex("#9e8ff0")(` ⚡ ${name} `),
  toolKey: (s: string) => chalk.hex("#9e8ff0")(s),
  toolVal: (s: string) => chalk.hex("#a8c7a0")(s),
  toolOutput: (s: string) => chalk.hex("#666688")(s),
  toolSuccess: (s: string) => chalk.hex("#7ec89a")(s),
  toolError: (s: string) => chalk.hex("#e06c75")(s),

  // Status
  success: (s: string) => chalk.hex("#7ec89a")(s),
  error: (s: string) => chalk.hex("#e06c75")(s),
  warn: (s: string) => chalk.hex("#e5c07b")(s),
  dim: (s: string) => chalk.hex("#555577")(s),

  // Separators
  divider: () => chalk.hex("#2a2a3e")("─".repeat(process.stdout.columns || 80)),
  thinDivider: () => chalk.hex("#1e1e2e")("─".repeat(process.stdout.columns || 80)),
}
