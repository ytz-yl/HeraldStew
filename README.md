# HeraldStew

**对话式 AI Agent 配置向导。** 通过自然语言帮你安装、配置和管理 Claude Code、Hermes、OpenCode、Codex 等 AI 编程工具。

HeraldStew 不直接执行代码任务，而是扮演"AI 工具链管家"的角色——配置 skills、cron、hooks、MCP，读写各工具的配置文件，记住你的偏好，跨会话保持上下文。

---

## 安装

```bash
npm install -g heraldstew
```

**前置要求：** Node.js ≥ 20

---

## 快速开始

### 1. 配置 LLM Provider

创建 `~/.herald/settings.json`：

```json
{
  "provider": {
    "type": "anthropic",
    "apiKey": "sk-ant-..."
  }
}
```

也可以用环境变量代替 apiKey：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 2. 启动

```bash
herald
```

---

## 使用示例

```
你: 帮我安装 claude code

Herald: 好的，先检测一下你的系统环境…
        ✓ detect_environment
        检测到 Linux，执行安装：
        ✓ run_command  npm install -g @anthropic-ai/claude-code
        安装完成！版本 1.x.x

你: 给 claude code 加一个每天早上 9 点提醒站会的 cron

Herald: ✓ read_file  ~/.claude/scheduled_tasks.json
        ✓ write_file ~/.claude/scheduled_tasks.json
        已添加 cron：每天 09:00 → "早上好！记得站会 👋"

你: 帮我把 opencode 的文档保存下来

Herald: ✓ fetch_url  https://opencode.ai/docs  proxy=http://127.0.0.1:7897
        ✓ write_file ~/.herald/knowledge/opencode.md
        已保存，下次直接从本地读取。
```

---

## 配置说明

配置文件路径：`~/.herald/settings.json`

```json
{
  "provider": {
    "type": "anthropic",
    "model": "claude-opus-4-8",
    "apiKey": "sk-ant-..."
  },
  "maxContextTokens": 80000
}
```

### 使用 OpenAI 兼容接口

```json
{
  "provider": {
    "type": "openai-compatible",
    "baseURL": "https://api.openrouter.ai/v1",
    "apiKey": "sk-or-...",
    "model": "anthropic/claude-opus-4-8"
  }
}
```

完整示例见仓库中的 [`herald.example.json`](./herald.example.json)。

---

## 功能特性

- **全屏 TUI**：基于 ink v7，Catppuccin 配色，实时显示工具调用进度
- **跨会话记忆**：对话历史持久化到 `~/.herald/session.json`，重启无缝续接
- **Context 压缩**：超出 token 限制时自动总结历史，保持上下文不中断
- **Agent 记忆目录**：`~/.herald/memory/{agent}/` 由 LLM 自主维护各工具的状态
- **知识库**：`~/.herald/knowledge/{agent}.md` 存放详细文档，LLM 按需读取
- **流式命令输出**：安装命令实时显示进度；超时后自动转后台，herald 可安全退出
- **代理支持**：`fetch_url` 支持通过环境变量或参数动态指定 HTTP 代理

---

## 目录结构

```
~/.herald/
  settings.json          # Provider 配置 + maxContextTokens
  session.json           # 持久化对话历史与压缩摘要
  memory/
    claude-code/
      agent.json         # 安装状态、版本
      tasks.json         # 历史配置任务
      notes.json         # 偏好与备注
    hermes/
    opencode/
    codex/
  knowledge/
    claude-code.md       # 详细知识（LLM 按需读取）
    opencode.md
    hermes.md
```

---

## CLI 命令

```bash
herald              # 启动交互界面（默认）
herald -m "..."     # 单次对话，非交互模式
herald doctor       # 检测已安装的 AI 工具及版本
herald --version    # 查看版本号
```

TUI 内置命令：

```
/doctor   # 环境检测（不调用 LLM）
Ctrl+C    # 退出
```

---

## 支持的 Agent 工具

| 工具 | 安装命令 | 文档 |
|------|----------|------|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |
| OpenCode | `npm install -g opencode-ai` | [opencode.ai](https://opencode.ai/docs) |
| Hermes | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh \| bash` | [hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/docs/) |
| Codex | `npm install -g @openai/codex` | [github.com/openai/codex](https://github.com/openai/codex) |

---

## License

MIT
