import chalk from "chalk"

// Render a complete markdown string to terminal-friendly ANSI output.
// Must receive the full text — do NOT call on partial streaming chunks.
export function renderMarkdown(text: string): string {
  const lines = text.split("\n")
  const output: string[] = []
  let inCodeBlock = false
  let codeLang = ""
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block start/end
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
        codeLines = []
        continue
      } else {
        inCodeBlock = false
        output.push(renderCodeBlock(codeLines, codeLang))
        continue
      }
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Headings
    const h3 = line.match(/^### (.+)$/)
    const h2 = line.match(/^## (.+)$/)
    const h1 = line.match(/^# (.+)$/)
    if (h1) { output.push(chalk.bold.underline.white(h1[1])); continue }
    if (h2) { output.push(chalk.bold.hex("#7c6af7")(h2[1])); continue }
    if (h3) { output.push(chalk.bold.hex("#9e8ff0")(h3[1])); continue }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      output.push(chalk.hex("#333355")("─".repeat(process.stdout.columns || 72)))
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)([-*+]) (.+)$/)
    if (ulMatch) {
      const indent = ulMatch[1]
      const bullet = chalk.hex("#7c6af7")("•")
      output.push(`${indent}${bullet} ${inlineMarkdown(ulMatch[3])}`)
      continue
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\. (.+)$/)
    if (olMatch) {
      const indent = olMatch[1]
      const num = chalk.hex("#9e8ff0")(olMatch[2] + ".")
      output.push(`${indent}${num} ${inlineMarkdown(olMatch[3])}`)
      continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      output.push(chalk.hex("#555577")("│ ") + chalk.italic.hex("#a0a0c0")(inlineMarkdown(line.slice(2))))
      continue
    }

    // Empty line
    if (line.trim() === "") {
      output.push("")
      continue
    }

    // Normal paragraph
    output.push(inlineMarkdown(line))
  }

  // Flush unclosed code block
  if (inCodeBlock && codeLines.length) {
    output.push(renderCodeBlock(codeLines, codeLang))
  }

  return output.join("\n")
}

function renderCodeBlock(lines: string[], lang: string): string {
  const width = Math.min(process.stdout.columns || 72, 80)
  const header = lang
    ? chalk.bgHex("#1e1e2e").hex("#9e8ff0")(` ${lang} ` + " ".repeat(Math.max(0, width - lang.length - 3)))
    : chalk.bgHex("#1e1e2e").hex("#555577")(" ".repeat(width))

  const body = lines.map((l) =>
    chalk.bgHex("#141420").hex("#c0cae0")(" " + l)
  )

  const footer = chalk.bgHex("#1e1e2e")(" ".repeat(width))

  return [header, ...body, footer].join("\n")
}

function inlineMarkdown(text: string): string {
  return text
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, (_, m) => chalk.bold.italic.white(m))
    // Bold
    .replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.bold.white(m))
    .replace(/__(.+?)__/g, (_, m) => chalk.bold.white(m))
    // Italic
    .replace(/\*(.+?)\*/g, (_, m) => chalk.italic.hex("#c0cae0")(m))
    .replace(/_(.+?)_/g, (_, m) => chalk.italic.hex("#c0cae0")(m))
    // Inline code
    .replace(/`([^`]+)`/g, (_, m) => chalk.bgHex("#1e1e2e").hex("#a8c7a0")(` ${m} `))
    // Links — show label only
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) =>
      chalk.underline.hex("#7c9ef7")(label) + chalk.hex("#555577")(` (${url})`)
    )
    // Strikethrough
    .replace(/~~(.+?)~~/g, (_, m) => chalk.strikethrough.hex("#666688")(m))
}
