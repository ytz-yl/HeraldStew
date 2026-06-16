export const CLAUDE_CODE_KNOWLEDGE = `
## Claude Code
- Docs: https://docs.anthropic.com/en/docs/claude-code
- Install: npm install -g @anthropic-ai/claude-code
- Verify: claude --version
- Config dir: ~/.claude/ (global) or .claude/ (project)
- Settings: .claude/settings.json
- Skills/Commands: .claude/commands/*.md (frontmatter: description:)
- Scheduled tasks: .claude/scheduled_tasks.json
- Project memory: .claude/CLAUDE.md
- Detailed knowledge: use read_file("~/.herald/knowledge/claude-code.md") if available
`
