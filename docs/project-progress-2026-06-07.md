# ZhiNotes 进度记录

日期：2026-06-07

接续 `docs/project-progress-2026-06-06.md`。本轮按 owner 当面提出的两个新方向推进：
(1) 页面改成简洁的 Notion 风格；(2) 左侧栏精简为三个大类。全程严守 local-first /
privacy-first 边界，未触碰任何需要 owner gate 的能力（云、AI、上传、录音、迁移）。

## 本轮完成

### 一、页面布局 Notion 化（标题 → 属性 → 评论 → 正文）

- 新增本地 `pages.properties` 字段：仅新增、可空、非破坏性。`client.ts` 里加了
  `ensureColumn` 幂等迁移（缺列才 `ALTER TABLE ADD COLUMN`，不丢数据）。
- 新增 `src/lib/pages/pageProperties.ts`：纯本地属性模型（文本/数字/日期/单选/
  复选框/链接），含解析、序列化、增删改的纯函数。
- 新增 `src/components/page/PageProperties.tsx`：标题正下方的 Notion 式属性区块，
  可重命名、改类型值、加选项、"+ 添加属性"。
- 新增 `src/components/page/PageActionsMenu.tsx`：把原来标题下一长排按钮（子页面、
  封面、锁定、宽页面、保存版本、历史、信息、复制页面/链接、导出 HTML/MD、复制、
  打印、删除）全部收进一个 ••• 菜单；外面只留一个收藏星标。
- `PageShell` 顺序重排：封面 → 面包屑+星标+••• → 图标标题 → 属性 → 评论 → 正文 →
  反向链接。页面评论上移到正文之前。

### 二、左侧栏精简为三个大类（其余降级为「备选模块」）

- 新增 `src/lib/pages/moduleWorkspaces.ts`：每个大类由一个**单例本地根页面**承载，
  子孙页面即内容（不建表、不联网）。`getModuleRootId` 对清空的 localStorage 有
  自愈逻辑（按标题复用已有根页）。
- **📅 每日纪要**（`/daily`，`DailyNotesShell`）：月历视图。点某天 → 进入/创建当天
  页面（标题=日期），自动套 Notion 模板：Date / 要点 / Summary 属性 + 正文骨架。
  历法按 `日期` 属性匹配（改标题也不会重复建页）。
- **🧭 产业链研究**（`/industry-chain`，`IndustryChainShell`）：分级页面树看板，
  每个节点都是真实页面，可展开折叠、加下级、单击进入、**双击就地重命名**。
- **🗓️ 会议日程**（`/schedule`，`MeetingScheduleShell`）：月历视图，手动加会议
  （主题/组织者/日期/时间/平台 → 写入页面属性 + 正文骨架）。会议助手 Agent 的
  自动入会/录音/转写/回传为**占位**，页面顶部显式写明安全边界。
- `Sidebar` 顶部展示三大类；原模块中心 + 全部平台模块收进可折叠的「备选模块」。
- `PageTree` 通过 `getModuleRootIdsSync` 隐藏三个模块根页面，避免重复显示。

## 会议助手 Agent 对接（已读 spec，未来分阶段）

owner 在 Codex 本地项目 `/Users/rogertan/Documents/会议助手` 开发会议 Agent，目标与
ZhiNotes 深度集成。Zhinote 侧未来需预留：Meeting Job 数据表、Secret Store、
Artifact/Manifest、Glossary/Context API、结果回传 API、Meetings UI、权限/审计/重试。
本轮只做了**日历 UI + 手动加会议**（owner 选择的 A 档），其余等 Codex 就绪并确认后
再开。严守 spec 安全边界：会议链接/号/密码不入页面与日志；默认不开麦克风/摄像头；
录音前需 `recording_consent_confirmed`；缺条件宁可 blocked。

## 本轮本地验证（全部通过）

```bash
npm run verify:module-workspaces   # 新增
npm run verify:editor
npm run verify:page-structure
npm run verify:file-preview
npm run verify:modules
npm run verify:database
npm run verify:research-workflow
npm run verify:web-beta
npm run verify:button-actions
npm run verify:page-import
npm run lint
npm run build
```

## 仍然阻塞或待 owner 确认

延续既有边界：云上线、文件上传、恢复写入、云迁移、AI 执行、会议自动录制/转写/回传
仍是默认关闭的 gated contract，需 owner 配置环境与边界后单独开启。

## 下一步建议

- 每日纪要：让会议页面可一键归档到当天纪要下（对齐 Notion「当日日期下建会议 page」）。
- 产业链研究：节点拖拽改层级、看板多列视图、节点页内嵌子分类导航。
- 会议日程：搭本地 Meeting Job 数据骨架（B 档，不联网/不录音），为 Agent 回传预留。
