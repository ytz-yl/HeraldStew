import React from "react"
import { render } from "ink"
import { App } from "./app.js"
import type { LLMProvider, ProviderConfig } from "../llm/types.js"

export function startTUI(provider: LLMProvider, providerConfig: ProviderConfig, maxContextTokens = 80000) {
  const { unmount } = render(
    <App provider={provider} providerConfig={providerConfig} maxContextTokens={maxContextTokens} />,
    {
      alternateScreen: true,
      exitOnCtrlC: true,
    }
  )
  return unmount
}
