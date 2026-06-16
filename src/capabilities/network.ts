export async function fetchUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "HeraldStew/0.1.0" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      return `HTTP ${response.status}: ${response.statusText}`
    }
    const text = await response.text()
    // truncate very large pages to avoid flooding the context
    return text.length > 20_000 ? text.slice(0, 20_000) + "\n... (truncated)" : text
  } catch (err) {
    return `Error fetching URL: ${err instanceof Error ? err.message : String(err)}`
  }
}
