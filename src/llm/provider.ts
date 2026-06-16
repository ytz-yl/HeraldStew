import { readFile } from "fs/promises"
import { homedir } from "os"
import { join } from "path"
import type { HeraldConfig, LLMProvider, ProviderConfig } from "./types.js"
import { AnthropicProvider } from "./providers/anthropic.js"
import { OpenAICompatibleProvider } from "./providers/openai-compat.js"

export const HERALD_CONFIG_PATH = join(homedir(), ".herald.json")

export async function loadConfig(): Promise<HeraldConfig> {
  // 1. Try reading ~/.herald.json
  try {
    const raw = await readFile(HERALD_CONFIG_PATH, "utf-8")
    return JSON.parse(raw) as HeraldConfig
  } catch {
    // fall through to env-based defaults
  }

  // 2. Derive from environment variables
  return inferConfigFromEnv()
}

function inferConfigFromEnv(): HeraldConfig {
  // OpenAI-compatible override: if HERALD_BASE_URL is set, use that
  const heraldBaseURL = process.env.HERALD_BASE_URL
  const heraldApiKey = process.env.HERALD_API_KEY
  const heraldModel = process.env.HERALD_MODEL

  if (heraldBaseURL && heraldModel) {
    return {
      provider: {
        type: "openai-compatible",
        baseURL: heraldBaseURL,
        apiKey: heraldApiKey,
        model: heraldModel,
      },
    }
  }

  // Default: Anthropic
  return {
    provider: {
      type: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.HERALD_MODEL,
    },
  }
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config)
    case "openai-compatible":
      return new OpenAICompatibleProvider(config)
    default: {
      const _exhaustive: never = config
      throw new Error(`Unknown provider type: ${(_exhaustive as ProviderConfig).type}`)
    }
  }
}

export async function resolveProvider(): Promise<LLMProvider> {
  const config = await loadConfig()
  return createProvider(config.provider)
}
