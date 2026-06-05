# ZhiNotes Notion 对齐记录

日期：2026-06-03

## 隐私边界

- 本次只记录 Notion 的通用交互和功能结构。
- 不记录、复述或迁移用户 Notion 工作区里的具体页面内容、公司名、会议内容或私人数据。
- ZhiNotes 当前实现仍保持本地优先：新数据库、页面、文件预览和图表都只写入本地开发环境。

## 本次观察到的 Notion 体验

### 笔记页

- Database item 可以像普通页面一样打开，右上保留分享、复制链接、收藏、更多操作。
- 页面正文以块为单位，hover 时出现添加块和拖拽手柄。
- 页面可以在 database 预览层里编辑，也可以打开为完整页面。

### Database

- 顶部以视图 tab 切换 table、calendar、board、gallery、chart 等不同看法。
- 每个视图都有自己的筛选、排序、属性显示设置。
- Database row 本质上是一张页面，新建记录后可以直接进入页面继续写笔记。
- Database 适合承载投研资产：报告、会议、公司、组合、行动项之间用 relation 串起来。
- 图表视图可以把结构化属性快速变成分布概览。

## 本次已在 ZhiNotes 实现

- 新增 `chart` database 视图类型。
- 新增本地 `ChartView`，支持按状态、单选、关联、日期、复选框、数字字段分组统计。
- Database 工具栏新增“属性”菜单，可按视图隐藏/显示字段，并随视图保存。
- Database 顶部新增“新建并打开”，让记录创建后直接进入对应页面。
- 字段栏新增字段设置弹层，支持重命名字段、修改字段类型、编辑单选/状态选项。
- 报告、公司、组合、会议等预设跟踪库新增图表视图入口。
- 内嵌 database 也支持显示和创建图表视图。
- 内嵌 database 支持紧凑字段设置弹层，和完整 database 使用同一套字段类型规则。

## 下一批优先差距

- 高级筛选：支持多条件、与/或逻辑、日期范围、空值/非空值。
- 分组：table/list/gallery 增加按状态、类型、公司、日期分组。
- Database 页面预览：点击 row 时先打开侧边预览层，再选择进入完整页面。
- Database 模板：每个数据库可以管理多套记录模板，而不是只使用全局笔记模板。
- Formula / rollup：在 relation 基础上增加自动汇总字段，适合投研打分、组合敞口和会议待办统计。
- Automations：先做本地规则草案，例如“状态变为已完成时记录时间”，上线前再接云端队列。

## 2026-06-06 官方资料复核

资料来源：

- Notion Help Center: Import data into Notion
  `https://www.notion.com/help/import-data-into-notion`
- Notion Help Center: Views, filters, sorts & groups
  `https://www.notion.com/help/views-filters-and-sorts`
- Notion Help Center: Synced blocks
  `https://www.notion.com/en-gb/help/synced-blocks`
- Notion Help Center: Database buttons
  `https://www.notion.com/help/database-buttons`

### 文件导入和原生展示

Notion 已有：

- 直接导入 TXT、Markdown、DOCX、CSV、HTML、PDF。
- Word 导入会尽量保留文本、标题、列表、图片、表格，但不保留评论、修订记录和复杂布局。
- Excel 需要先导出 CSV，再导入为 database；ZIP 导入会把 DOCX/Text/Markdown/HTML/EPUB/OPML
  映射成页面，把 CSV/XLSX/TSV/ODS 映射成 database。
- HTML 导入会保留标题、段落、列表、链接、代码块和简单表格，但复杂样式、脚本、嵌入和历史会被压平或丢失。
- PDF 可导入为 Notion 页面并搜索，但表格、公式、callout、divider、toggle 等结构可能不完整。

ZhiNotes 当前已有：

- Reports/Files/Notes 已经明确区分 HTML 可视化报告、Markdown 笔记、PDF/Office、Excel/CSV 的入口。
- HTML 是 AI 可视化报告的优先原生预览格式；Markdown 是个人笔记的优先可编辑格式。
- Files 模块可以把任意本地文件放进 page 容器；Reports 模块可以为 HTML/Markdown 创建报告页。
- Notes 模块新增格式入口和 Cmd/Ctrl+K 格式入口命令，只做本地路由，不读文件、不上传、不调用 AI。

仍缺口：

- ZIP/folder 批量导入还没有把多文件自动拆成 pages/databases。
- DOCX/PDF 还没有本地文本抽取后转成可编辑 page 的稳定路径。
- HTML 还没有“同目录 assets/ZIP assets”保真导入路线。
- 文件导入还缺统一进度队列、失败恢复、部分成功报告和批量导入 receipt。

建议下一步：

- 先做 metadata-only 的 ZIP 导入预检报告，列出将被创建为 page/database/local-retain 的文件数量。
- 再做 Markdown/HTML 批量 page 创建；PDF/DOCX 等需要本地转换器确认后再启用。

### Database 视图体验

Notion 已有：

- 每个 database view 有自己的 layout、property visibility、filter、sort、group 设置。
- 支持 view rename、duplicate、delete、copy link to view。
- 支持 side peek、center peek、full page 三种打开 database item 的方式。
- 高级筛选支持 AND/OR filter groups，官方文档说明可以嵌套到三层。
- 支持 database search、freeze column、group 和 sub-group。

ZhiNotes 当前已有：

- Table/List/Kanban/Calendar/Gallery/Timeline/Chart/Form/Feed 和 inline database 视图。
- 已有多筛选、多排序、字段显示、row search、view 分组、Kanban 分栏、Calendar/Timeline 日期字段选择。
- 已有 Formula、Rollup、字段说明、字段复制、字段排序、视图排序、行排序和表格摘要。
- 已有 view rename、duplicate、delete、copy link、view description、本地 side peek 和 center peek。
  数据库行点击可先打开侧边或居中预览，也可按 view 保存为直接打开完整页面。
- 已有可配置 freeze column：Full database 的 Table 固定序号列和标题列，也可按 table view
  额外固定最多 3 个字段，宽表横向滚动时保留记录识别和关键属性。

仍缺口：

- 还没有 sub-group 二级分组。
- 还没有 nested advanced filter groups。
- 多人协作前，还不能区分“只对我生效”和“保存给所有人”的 view 设置。

建议下一步：

- 第二批继续做 sub-group 和 nested filter groups。
- Nested filter groups 需要重新设计 view config 结构，建议放在数据库硬化阶段。

### Synced blocks

Notion 已有：

- 同步块可以把同一段内容复用到多个页面或 workspace；任一实例更新后，其他位置也会更新。
- 原块所在页面权限会影响其他人能否看到 synced block 内容。

ZhiNotes 当前已有：

- 编辑器已有 synced block 节点和本地导出语义。

仍缺口：

- 还没有完整的跨页面多实例同步编辑、原始块引用关系、权限感知和冲突处理。
- 本地-first 模式下还需要先定义 sync id、实例列表和删除/解除同步语义。

建议下一步：

- 先做本地 synced block registry，只记录 sync id、实例 page/block id 和最后更新时间。
- 云同步和权限上线前，不跨用户同步 synced block 内容。

### Database buttons / Automations

Notion 已有：

- Database button 是一种 property；点击后可以执行自动化动作。
- Button action 可以创建或编辑页面/数据库，并可结合 mentions 和 formulas。

ZhiNotes 当前已有：

- 已有 template row、module starter、tracker intake desk 和本地确认 receipt 的基础。
- 已有只读 database button draft 字段：保存按钮标签和动作预览，Table 点击只弹出预览，不执行写入。
- AI、云同步和高风险写入仍默认关闭。

仍缺口：

- 还没有本地 action runner、真实动作执行、撤销/回滚 receipt。
- 还没有权限模型来限制哪些 button 可以写页面、写字段或创建数据库。

建议下一步：

- 第二步做低风险本地动作，例如设置同一行 status、date、checkbox，并补撤销/回滚 receipt。
- 创建页面、批量写字段、调用 AI、同步云端必须继续放在 owner gate 后面。
