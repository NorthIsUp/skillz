---
name: Linear issue tracker
description: teamclara uses Linear for issue tracking with CLA- ticket prefix, accessible via MCP
type: reference
---

teamclara tracks issues in Linear. Ticket IDs use the prefix `CLA-` (e.g., CLA-820).

Linear MCP is configured in `.mcp.json` using `$LINEAR_TOKEN` env var. Use `mcp__linear-api__get_issue` to fetch ticket details.
