# Systematically Learn and Do - 后端服务

## 快速开始

### 1. 安装依赖

```bash
cd systematic-learning-tool-design
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

必需配置：
- `DEEPSEEK_API_KEY` - DeepSeek API Key

### 3. 启动开发服务器

```bash
# 启动后端（开发模式）
npm run server

# 或者同时启动前端和后端
npm run dev  # 前端
npm run server  # 后端（在另一个终端）
```

### 4. 访问应用

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

## API 端点

### Learn（学习报告）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/learn | 获取所有学习报告 |
| GET | /api/learn/:id | 获取单个报告 |
| POST | /api/learn | 创建新报告并开始研究 |
| PATCH | /api/learn/:id | 更新报告 |
| DELETE | /api/learn/:id | 删除报告 |

### Projects（项目）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 获取所有项目 |
| GET | /api/projects/:id | 获取单个项目 |
| POST | /api/projects | 创建新项目 |
| PATCH | /api/projects/:id | 更新项目 |
| DELETE | /api/projects/:id | 删除项目 |

### Skills（技能）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/skills | 获取所有技能 |
| GET | /api/skills/:id | 获取单个技能 |
| POST | /api/skills | 创建新技能 |
| PATCH | /api/skills/:id | 更新技能 |
| POST | /api/skills/:id/use | 增加使用计数 |
| POST | /api/skills/:id/archive | 归档技能 |

### Settings（设置）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/settings | 获取设置 |
| PATCH | /api/settings | 更新设置 |
| GET | /api/settings/export | 导出数据 |
| POST | /api/settings/import | 导入数据 |

### Feedback（反馈）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/feedback | 获取所有反馈 |
| POST | /api/feedback | 提交反馈 |
| DELETE | /api/feedback/:id | 删除反馈 |

## 三阶段调研工作流

后端集成了完整的调研流程：

1. **阶段1: 横纵分析** - 使用 `horizontal-vertical-analysis` skill
2. **阶段2: 深度调研** - 搜索相关实践，提取关键模式
3. **阶段3: 规划建议** - 生成实施路线图

调用 `POST /api/learn` 会自动执行完整流程。

## 自进化机制

后端支持以下自进化功能：

- **Skill 创建**: 完成后自动保存为可复用模板
- **Skill 改进**: 根据用户反馈更新
- **Curator 维护**: 自动管理技能生命周期

## 目录结构

```
server/
├── index.js              # 入口
├── db/
│   ├── database.js       # SQLite 数据库
│   └── seed.js          # 初始数据
├── routes/
│   ├── learn.js         # 学习报告 API
│   ├── projects.js      # 项目 API
│   ├── feedback.js      # 反馈 API
│   ├── skills.js       # 技能 API
│   ├── settings.js     # 设置 API
│   └── research.js     # 研究 API
├── services/
│   └── aiService.js    # AI 调研服务
└── middleware/
    ├── errorHandler.js # 错误处理
    └── logger.js       # 请求日志
```

## 扩展开发

### 添加新的 AI 模型

修改 `services/aiService.js` 中的 `callAI` 函数：

```javascript
// 使用 OpenAI
const response = await fetch(`${API_BASE_URL}/chat/completions`, {
  // ... 配置
});
```

### 添加 Web 搜索

在 `services/aiService.js` 中集成 Firecrawl 或其他搜索 API。

## License

MIT
