import fetch from "node-fetch"
import { HttpsProxyAgent } from "https-proxy-agent"

function getAgent(proxy?: string) {
  const p = proxy ?? process.env.https_proxy ?? process.env.http_proxy ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY
  if (p) return new HttpsProxyAgent(p)
  return undefined
}

export async function fetchUrl(url: string, proxy?: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const agent = getAgent(proxy)
    const response = await fetch(url, {
      headers: { "User-Agent": "HeraldStew/0.1.0" },
      signal: controller.signal as never,
      ...(agent ? { agent } : {}),
    })
    clearTimeout(timer)
    if (!response.ok) {
      return `HTTP ${response.status}: ${response.statusText}`
    }
    const text = await response.text()
    return text.length > 20_000 ? text.slice(0, 20_000) + "\n... (truncated)" : text
  } catch (err) {
    return `Error fetching URL: ${err instanceof Error ? err.message : String(err)}`
  }
}
