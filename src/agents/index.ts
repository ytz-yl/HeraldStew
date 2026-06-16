import { CLAUDE_CODE_KNOWLEDGE } from "./claude-code/knowledge.js"
import { OPENCODE_KNOWLEDGE } from "./opencode/knowledge.js"
import { HERMES_KNOWLEDGE } from "./hermes/knowledge.js"
import { CODEX_KNOWLEDGE } from "./codex/knowledge.js"

export const BUILTIN_AGENT_KNOWLEDGE =
  CLAUDE_CODE_KNOWLEDGE + OPENCODE_KNOWLEDGE + HERMES_KNOWLEDGE + CODEX_KNOWLEDGE
