import type { ChatMessage } from "../llm/types.js"

export interface HeraldSession {
  version: 1
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  summary: string
  summaryRecent: string
  lastTokenCount: number
}
