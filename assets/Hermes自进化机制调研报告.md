# Hermes Agent 自进化机制深度调研报告

## 一、概述

Hermes Agent 是 Nous Research 开发的自进化 AI Agent，其核心特点是**内置学习闭环**——能够从经验中学习、自我改进，并持续积累知识。

> 官方定义："The only agent with a built-in learning loop — it creates skills from experience, improves them during use, nudges itself to persist knowledge, and builds a deepening model of who you are across sessions."

---

## 二、自进化机制的核心能力

### 2.1 自主 Skill 创建（Autonomous Skill Creation）

**触发条件**：
- 完成复杂任务（5+ 工具调用）后
- 从错误中成功恢复后
- 用户纠正 Agent 后

**行为**：
Agent 会自动将解决复杂任务的经验封装为可复用的 SKILL.md 文件，下一次遇到类似任务时可直接调用，显著提升效率。

### 2.2 Skill 自我改进（Skill Self-Improvement）

**能力**：
- 使用 `skill_manage patch` 原地修改已有 skill
- 使用 `skill_manage edit` 重写 skill 内容
- 在使用过程中自动优化

**无需额外配置**，内置于 Hermes Agent 中。

### 2.3 Curator 自动维护

Curator 是后台运行的 skill 生命周期管理系统：

| 功能 | 说明 |
|------|------|
| 追踪使用 | 记录每个 skill 的 `use_count`、`view_count`、`patch_count` |
| 标记 stale | 长时间不活跃的 skill 被标记 |
| 自动归档 | 超过阈值后自动归档，保留备份 |
| 保护机制 | pinned skill 不会被任何自动操作影响 |

**配置**（`config.yaml`）：
```yaml
curator:
  enabled: true
  interval_hours: 24
  min_idle_hours: 168      # 7天不活跃视为 stale
  stale_after_days: 30
  archive_after_days: 60
```

**CLI 命令**：
```bash
hermes curator status     # 查看状态
hermes curator run        # 手动运行
hermes curator pin <name> # 保护 skill
hermes curator archive    # 归档
```

---

## 三、进化框架：Hermes Agent Self-Evolution

### 3.1 项目简介

**GitHub**: `NousResearch/hermes-agent-self-evolution` (⭐5.0k)

这是一个**进化自改进管道**，使用 DSPy + GEPA (Genetic-Pareto Prompt Evolution) 来优化 skills、工具描述、System Prompt 和代码。

**特性**：
- 无需 GPU，仅需 API 调用
- 基于真实执行轨迹进行优化
- 支持合成数据和真实会话历史

### 3.2 五个进化阶段

| 阶段 | 目标 | 引擎 | 状态 |
|------|------|------|------|
| **Phase 1** | Skill 文件 (SKILL.md) | DSPy + GEPA | ✅ 已实现 |
| **Phase 2** | 工具描述 | DSPy + GEPA | 🔲 计划中 |
| **Phase 3** | System Prompt 部分 | DSPy + GEPA | 🔲 计划中 |
| **Phase 4** | 工具实现代码 | Darwinian Evolver | 🔲 计划中 |
| **Phase 5** | 持续改进循环 | 自动化管道 | 🔲 计划中 |

### 3.3 快速开始

```bash
# 安装
git clone https://github.com/NousResearch/hermes-agent-self-evolution.git
cd hermes-agent-self-evolution
pip install -e ".[dev]"

# 指向 hermes-agent 仓库
export HERMES_AGENT_REPO=~/.hermes/hermes-agent

# 使用合成数据进化 skill
python -m evolution.skills.evolve_skill \
    --skill github-code-review \
    --iterations 10 \
    --eval-source synthetic

# 或使用真实会话历史（Claude Code, Copilot, Hermes）
python -m evolution.skills.evolve_skill \
    --skill github-code-review \
    --iterations 10 \
    --eval-source sessiondb
```

### 3.4 Guardrails（保障机制）

所有进化变体必须通过：

1. **完整测试套件** — `pytest tests/ -q` 必须 100% 通过
2. **大小限制** — Skills ≤15KB，工具描述 ≤500 字符
3. **缓存兼容性** — 不能在对话中途改变
4. **语义保持** — 不能偏离原始目的
5. **PR 审核** — 所有变更必须经过人工审核，不能直接提交

---

## 四、与你的项目集成

### 4.1 在 Deep Research Workflow 中实现自进化

根据你的设计文档，自进化机制可以这样实现：

```
用户反馈 → 分析问题 → 调用对应 skill 补充调研 → 更新报告
```

**实现方式**：

1. **Skill 创建**
   - 当完成复杂调研任务后，自动创建新 skill
   - 例如：创建 "微服务架构调研" skill

2. **Skill 改进**
   - 根据用户反馈修改已有 skill
   - 使用 `skill_manage patch` 或 `edit`

3. **Curator 集成**
   - 自动管理不断增长的 skill 库
   - 归档长期不用的调研 skill

### 4.2 自进化触发条件

在你的 Web 端应用中，可以设置以下触发点：

| 触发条件 | 动作 |
|----------|------|
| 用户对调研结果不满意 | 标记需要补充的维度，触发重新调研 |
| 调研完成 5+ 工具调用 | 自动保存为可复用 skill |
| 用户选择"保存为模板" | 手动触发 skill 创建 |
| 长期未使用的调研 skill | Curator 自动归档 |

### 4.3 技术实现参考

**Skill 创建示例**：
```python
# 使用 Hermes 的 skill_manage 工具
skill_manage(
    action="create",
    name="微服务架构调研",
    content="""---
name: microservices-research
description: 微服务架构深度调研 skill
---
# 微服务架构调研
[内容...]
""",
    category="research"
)
```

---

## 五、相关资源

- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/docs/)
- [Skills 系统文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)
- [Self-Evolution GitHub](https://github.com/NousResearch/hermes-agent-self-evolution)
- [Curator 功能文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/curator)

---

## 六、总结

Hermes Agent 的自进化机制是其核心差异化能力：

1. **内置学习闭环**：从经验中创建 skill，持续自我改进
2. **自动化维护**：Curator 自动管理 skill 生命周期
3. **进化框架**：Self-Evolution 项目提供更高级的优化能力
4. **安全保障**：多重 Guardrails 确保安全可控

在你的深度调研应用中集成这一机制，可以实现：
- 调研能力的持续积累
- 个性化调研模板的自动生成
- 基于用户反馈的自我优化

---

*报告生成时间: 2025-08-13*
*参考来源: Hermes Agent 官方文档、GitHub 项目、arXiv 论文*
