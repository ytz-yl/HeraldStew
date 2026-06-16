# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run dev          # 直接运行（tsx，无需编译）
npm run build        # 编译到 dist/（tsup）
npm run lint         # TypeScript 类型检查（tsc --noEmit）
npm test             # 运行测试（vitest）
```

编译产物入口：`dist/index.js`，对应 CLI 命令 `herald`。

## 项目定位

HeraldStew 是**对话式 AI Agent 配置向导**，不执行具体编程任务，只负责帮用户安装和配置 ClaudeCode、Hermes、OpenCode、Codex 等 AI Agent 工具（skills、cron、hooks、MCP 等）。Herald 始终只有一个持久主 session。

## 架构概览

```
src/
  cli/index.ts          # 入口：commander 解析，默认启动 TUI，-m 走非交互模式
  tui/                  # 全屏 TUI（ink v7 + React）
    app.tsx             # 根组件：session 生命周期、wrappedExecutor、压缩触发
    run.tsx             # render() 入口，alternateScreen: true
    components/         # Header / MessageList / ToolCard / InputBar
    markdown.tsx        # Markdown → ink React 元素（必须对完整字符串调用，不能流式）
    theme.ts            # Catppuccin 色板常量
  llm/
    types.ts            # 所有共享接口：ChatMessage、LLMProvider、AssistantMessage（含 usage?）、HeraldConfig
    client.ts           # provider 无关的 agentic loop，返回 AgentLoopResult { text, inputTokens }
    provider.ts         # resolveProvider()、loadConfig()，读取 ~/.herald/settings.json（兼容旧 ~/.herald.json）
    providers/          # anthropic.ts / openai-compat.ts，均返回 usage token 数
    prompts.ts          # buildSystemPrompt(summary?, summaryRecent?)，动态注入压缩摘要
    tools.ts            # 7 个工具的 JSON Schema 定义（含 read_memory / write_memory）
  memory/
    types.ts            # HeraldSession 接口（无 agents 字段，agent 状态由 LLM 写入 memory 目录）
    store.ts            # loadSession() / saveSession()，读写 ~/.herald/session.json
    compaction.ts       # estimateTokens()、shouldCompact()、compactHistory()（LLM 摘要压缩）
  capabilities/         # 7 个工具的实现：shell、file、network、detect_environment、memory（read/write）
  agents/claude-code/   # Claude Code 的安装和配置知识（installer、config）
  utils/                # detect.ts（环境检测）、logger.ts
```

## 关键数据流

**启动**：`loadSession()` → 恢复 `historyRef` → `buildSystemPrompt()` 注入压缩摘要（若有）。

**每轮对话**：用户输入 → `runAgentLoop()` → `wrappedExecutor`（展示 ToolCard）→ 工具执行 → `saveSession()` → 超限时 `compactHistory()`。

**压缩触发**：`session.lastTokenCount`（优先用 API 返回的 `usage.inputTokens`，fallback 字符数/4）> `maxContextTokens - 20000`。压缩后旧消息替换为结构化摘要注入 system prompt，`session.messages` 清空重建。

## 配置文件

| 路径 | 用途 |
|------|------|
| `~/.herald/settings.json` | provider 配置 + `maxContextTokens`（默认 80000）|
| `~/.herald/session.json` | 持久 session：消息历史、压缩摘要 |
| `~/.herald/memory/{agent}/` | LLM 自主维护的 agent 记忆目录（agent.json / tasks.json / notes.json 等）|

`herald.example.json` 包含各 provider 的完整配置示例。

## 重要约束

- **`src/ui/`** 是废弃目录（早期非全屏方案的遗留文件），不要修改或引用。
- TUI 的 markdown 渲染器（`tui/markdown.tsx`）只能对**完整字符串**调用，不能在流式 token 上逐块调用。
- `tsup` 会自动添加 shebang，`src/cli/index.ts` 不需要写 `#!/usr/bin/env node`。
- OpenAI compat provider 开启了 `stream_options: { include_usage: true }` 来获取 token 计数，部分兼容 API 可能不支持（会被忽略）。
