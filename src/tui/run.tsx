import React from "react"
import { render } from "ink"
import { App } from "./app.js"
import type { LLMProvider, ProviderConfig } from "../llm/types.js"

export function startTUI(provider: LLMProvider, providerConfig: ProviderConfig) {
  const { unmount } = render(
    <App provider={provider} providerConfig={providerConfig} />,
    {
      alternateScreen: true,
      exitOnCtrlC: true,
    }
  )
  return unmount
}
