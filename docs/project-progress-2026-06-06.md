# ZhiNotes 进度记录

日期：2026-06-06

接续 `docs/project-progress-2026-06-05.md`。本轮在自驱动循环里推进，目标是朝
"可上云正式发布"逐步打磨，同时严守 local-first / privacy-first 边界。

## 本轮完成

### 批量"文件 → 页面"导入（第一优先级）

这是把本地 Markdown / HTML / 文本文件批量变成 ZhiNotes 页面的完整闭环，分三步落地，
每一步都先预览、再确认、可回退：

1. **导入计划核心**（`src/lib/files/pageImportPlan.ts`）
   - 纯元数据规划器：只读文件名、扩展名、大小，绝不读取文件内容字节。
   - 把每个文件分流到四个车道：导入为页面 / 数据库候选 / 本地留存 / 阻塞复核。
   - 生成失败回退计划（逆序撤销）和必经确认 gate（批量建页确认、HTML 外部资源
     复核、数据库列映射、回退就绪）。
   - 可导出清单 `buildExportablePageImportManifest` 会**剔除文件名**，只保留扩展名
     分组、数量、大小、车道和回退步骤数，符合 ZIP 预览同款隐私规则。
   - 验证脚本：`npm run verify:page-import`。

2. **Files 模块导入预览面板**（`src/components/modules/PageImportPlanPanel.tsx`）
   - 用户选择一批文件后，展示每个文件的去向、目标模块、是否需转换、是否需确认，
     以及汇总指标、回退步骤数、必经 gate，并提供"导出计划 JSON"。
   - 这一步只预览，不创建、不上传、不调用 AI。

3. **确认后批量执行 + 回退**（`src/lib/files/pageImportExecutor.ts`）
   - 勾选确认框后才执行：Markdown / 纯文本转为页面正文，其它 page-import 与
     local-retain 文件创建为带安全预览块的本地文件页。
   - 表格走数据库模块列映射确认、未知格式走单独复核，本步骤跳过不创建。
   - 中途任意一步失败，自动回退本次已创建的全部页面，工作区恢复原状。
   - 本地执行：仅在确认导入时读取字节，创建本地页面，绝不上传 / 同步 / 调用 AI。

### Database button 本地动作运行器（第二优先级起步）

- 新增 `src/lib/database/buttonActions.ts`：纯逻辑、可撤销的本地动作运行器。
- 按钮只能设置**同一行**字段（状态/单选、复选框、日期），动作类型为 set-select、
  set-checkbox、toggle-checkbox、set-date-today、clear-field。
- 每次运行返回新值 + 撤销快照 + 变更字段列表；不写库、不建页/库、不联网、不调用 AI。
- 向后兼容：未配置动作的按钮仍是预览态。验证脚本：`npm run verify:button-actions`。
- 这是对齐 Notion database button 的第一步；接 UI（按钮单元格 + 撤销回执）放后续阶段。

### 编辑器浮动工具条（Notion 对齐 UI）

- 新增 `EditorBubbleMenu`：选中文字时出现的浮动工具条，含加粗/斜体/下划线/删除线/
  行内代码/高亮、链接和清除格式，复用编辑器已有命令。
- 自动跳过图片、内嵌数据库、文件预览等节点选择；自包含组件，挂载在编辑器表面，
  带浅色/深色样式。新增直接依赖 `@tiptap/extension-bubble-menu`。
- 纯本地 UI，无任何 I/O；补齐高频 Notion 交互缺口。

## 本轮本地验证

以下命令均通过：

```bash
npm run verify:page-import      # 新增
npm run verify:button-actions   # 新增
npm run verify:file-preview
npm run verify:editor
npm run verify:database
npm run verify:modules
npm run lint
npm run build
```

构建时补装了代码已引用但本地缺失的依赖 `xlsx`、`mammoth`（仅本地安装，依赖清单原已声明）。

## 仍然阻塞或待用户确认

延续 06-05 记录：云上线、文件上传、恢复写入、云迁移、AI 执行仍是默认关闭的 gated
contract，需要 owner 在配置好环境变量、迁移回退和外发边界后再单独开启。

## 下一步建议

- 第二优先：继续对齐 Notion database 体验（嵌套筛选组、relation/rollup UX、模板、
  button 动作预览），真实执行仍需确认。
- 持续按 Notion 交互范式打磨 Notes / 页面 / 数据库的 UI 细节。
- 第三优先：Web 上线准备（部署、Postgres/cloud sync、auth、audit、backup/restore、
  权限），保持本地行为不变，云端能力分阶段 owner 确认。
