# Systematically Learn and Do

A web tool for **structured self-learning** and **project planning**.
Powered by the [横纵分析法 (horizontal-vertical analysis)](skills/horizontal-vertical-analysis.md)
framework, with an integrated self-evolving Skill library.

> 系统化学习与执行：一个辅助你系统学习、规划项目、并随使用持续自我改进的工具。

---

## Features

### Learn (学习模式)
- 输入任意主题，AI 自动生成包含**横向对比、纵向脉络、深度调研、学习路线**的结构化研究报告
- 三阶段实时进度（SSE 流式推送），可手动重连/取消
- 历史报告自动按状态、收藏、字数排序
- 一键导出 PDF / 复制分享链接
- **报告版本快照 + 恢复**（每次内容变更自动留档）

### Project (项目模式)
- 为项目自动生成**调研报告 + 实施路线图**
- 任务清单按阶段分组（准备 / 调研 / 执行 / 收尾）
- 截止日期倒计时、进度统计

### Skill (技能库)
- 从已生成的报告**自动提炼 Skill 模板**（Step 1.4 的 `extractSkillTemplate`）
- 一键"使用模板"——新研究自动套用既有 Skill 的 `{subject}` 占位符
- 状态机：`active → watch → stale → archived`，由后台 Curator 定时维护
- 使用次数、评分、版本号全程追踪
- 进化日志记录每一次 Skill 创建/更新/归档/置顶

### Feedback (反馈)
- 用户评分 + 改进建议
- 低分（< 3星）的反馈自动写入对应 Skill 的"改进点"区块
- Skill 评分使用指数移动平均（近因权重 40%）

### Settings (设置)
- 主题（浅/深/跟随系统）+ 报告正文字号
- 分析深度 / 调研资源数 / 规划模板
- 数据导出/导入 JSON 备份

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind 4 |
| State | Zustand (split into per-domain slices) |
| Markdown | react-markdown + remark-gfm |
| Icons | lucide-react |
| Backend | Express 5 (plain JS) |
| DB | better-sqlite3 (single file: `data/systematically.db`) |
| AI | DeepSeek-compatible OpenAI Chat Completions API |
| Tests | node:test (no extra deps) |

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env and set DEEPSEEK_API_KEY to your real key

# 3. Dev (frontend + backend concurrently)
npm run dev          # Vite at http://localhost:5174 + API at http://localhost:3001

# 4. Tests
npm test

# 5. Production build
npm run build
npm start            # serves the SPA + API from a single Express process
```

The default `.env` includes a real key from a previous test session. **Replace it with your own before deploying** — the server will warn at startup if it's still the placeholder.

---

## Project Structure

```
src/
├── App.tsx                   # Hash router + per-route ErrorBoundary
├── components/
│   ├── ErrorBoundary.tsx     # Per-route crash isolation
│   ├── ReportViewer.tsx       # Markdown render with TOC
│   ├── StageProgress.tsx     # Three-stage progress UI
│   ├── Header.tsx            # Top nav (pushState-based navigation)
│   ├── navItems.tsx          # Shared desktop + mobile nav config
│   └── ui.tsx                # Button, Modal, StatusBadge, Toast, ...
├── pages/
│   ├── LearnPage.tsx
│   ├── LearnDetailPage.tsx   # Includes version history modal
│   ├── ProjectPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── SkillPage.tsx         # Skill library + "use as template"
│   ├── FeedbackPage.tsx
│   └── SettingsPage.tsx
├── store/
│   ├── useStore.ts           # Root Zustand store (composes slices)
│   ├── useUIStore.ts         # router / toasts / loading / stuck
│   ├── useReportStore.ts     # Learn reports + SSE streaming
│   ├── useProjectStore.ts    # Projects + tasks
│   ├── useFeedbackStore.ts   # Feedback + evolution trigger
│   ├── useSkillStore.ts      # Skills + evolution logs
│   ├── useSettingsStore.ts   # User preferences + import/export
│   ├── mappers.ts            # DB row -> front-end type
│   ├── optimistic.ts         # Optimistic update helper with rollback
│   └── types.ts              # Combined AppState type
├── services/apiClient.ts      # fetch wrapper + EventSource
├── utils/
│   ├── cn.ts                 # tailwind-merge / clsx
│   └── skillTemplate.ts      # Extract reusable Skill from a report
└── index.css                 # Tailwind 4 + print styles

server/
├── index.js                  # Express bootstrap
├── config.js                 # Env loading + validateConfig()
├── db/database.js            # SQLite schema + init
├── routes/                   # learn, projects, feedback, skills, settings, research
├── services/
│   ├── aiService.js          # DeepSeek wrapper + stage prompts
│   ├── learnStream.js        # EventEmitter for SSE
│   └── curator.js            # Skill lifecycle background task
├── middleware/
│   ├── errorHandler.js
│   ├── rateLimit.js          # In-memory sliding-window per IP
│   └── logger.js             # Structured JSON access logs + X-Request-Id
└── validators.js             # Runtime validation (enum / range / length)

test/
├── validators.test.js        # 20 unit tests
├── skillTemplate.test.js     # 5 unit tests
└── api.test.js               # 11 integration tests (spawn server in child)

skills/                       # Markdown source for system Skills (horizontal-vertical-analysis, deep-research-workflow, plan)
```

---

## Self-Evolution

The tool applies Hermes-style self-evolution principles:

1. **Skill auto-creation**: After a Learn report finishes, `extractSkillTemplate` extracts its heading structure and auto-creates a Skill marked `report:<id>` so it can be traced back to its origin.
2. **Feedback-driven Skill updates**: User feedback with rating < 3 stars appends an "改进点（来自反馈）" section to the linked Skill's content, bumps the version, and marks it as `watch`.
3. **Curator background loop**: Every 24h, scans Skills and demotes:
   - `active` → `watch` after 30 days without update
   - `watch` → `stale` after 90 days
   - `stale` → `archived` after 180 days
   - `pinned` / `archived` are never auto-transitioned.

Each transition is logged to `evolution_logs` so the Skill page can show a full history.

---

## API Surface (summary)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Liveness + readiness; returns 200 or 503 |
| POST | `/api/learn` | Create report + start AI research |
| GET | `/api/learn` | List reports |
| GET | `/api/learn/:id` | One report |
| PATCH | `/api/learn/:id` | Update (favorite / status / content) |
| DELETE | `/api/learn/:id` | Delete |
| GET | `/api/learn/:id/stream` | **SSE** stream of progress / complete / error events |
| GET | `/api/learn/:id/versions` | Version history (with content) |
| POST | `/api/learn/:id/versions/:vid/restore` | Restore a version |
| POST | `/api/projects` | Create project + start research |
| GET/PATCH/DELETE | `/api/projects[/:id]` | CRUD |
| POST/PATCH/DELETE | `/api/projects/:id/tasks[/:taskId]` | Tasks |
| GET/POST | `/api/skills` | List + create |
| GET/PATCH/DELETE/POST(use\|archive\|pin) | `/api/skills/:id` | CRUD + lifecycle |
| GET | `/api/skills/evolution/logs` | Curator / feedback evolution log |
| GET/POST/DELETE | `/api/feedback` | User feedback |
| GET/PATCH | `/api/settings` | User preferences |
| GET/POST | `/api/settings/(export\|import)` | Data export / import |

Every PATCH / POST that takes a body runs through `server/validators.js` first; invalid input gets `400 Validation failed` with `details: [...]` listing every failing field.

---

## License

MIT.