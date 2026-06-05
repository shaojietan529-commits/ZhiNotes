# ZhiNotes 当前进度记录

日期：2026-06-05

## 当前定位

ZhiNotes 的目标是 web-based 模块化投研平台。笔记/page 是底层知识库，数据库、报告、
公司研究、会议、组合、文件、AI 和云同步都作为模块接入。

当前仍是 local-first 阶段：本地页面、数据库、文件预览、备份、导出和 Web Beta
准备度检查可以运行；会触碰云端写入、文件上传、AI 外发、权限执行、恢复写入和
schema migration 的能力默认保持关闭。

## 已完成的核心底座

- 模块中心：Notes、Databases、Reports、Files、Company Research、Meetings、
  Portfolio、Projects、Research Graph、AI、Sync 都已有模块入口。
- 笔记底座：page/tree、breadcrumbs、图标、backlinks、版本历史、评论、toggle、
  callout、目录、cover、快捷键、slash command、Notion-style slash alias、
  高级块操作和创建 page 后自动进入新页面。
- 数据库底座：table/list/kanban/calendar/gallery/timeline/chart/form/feed、多视图、
  字段设置、显示属性、CSV/XLSX 导出、确认后的 spreadsheet import。
- 文件/报告底座：HTML、Markdown、PDF、Office、notebook、archive、media 的本地
  metadata routing、预览准备度、上传前检查和高风险边界。
- 投研模块底座：公司研究、会议、报告库、组合、项目、research graph 都有本地 tracker
  和模块入口。
- Web Beta 安全底座：登录、workspace、sync、file presign、audit、permissions、
  restore、cloud migration 相关 route 都有默认关闭合同和本地验证。

## 本轮完成

### 笔记 Slash 高级命令阶段

- Slash 菜单现在补齐了更接近 Notion 的常用别名：`/num`、`/div`、`/turnbullet`、
  `/turnnumber`、`/turnh3`、`/book` 等输入会命中对应块或书签命令。
- 格式和颜色命令也补齐英文可发现性：`/bold`、`/clear formatting`、`/align left`、
  `/red text`、`/gray text`、`/blue background` 等输入会命中对应文字格式或背景色命令。
- 颜色工作流新增 `/default`，只移除文字颜色和背景高亮，不像“清除格式”那样重置整个块；
  背景色也补齐橙色和灰色。
- 新增本地高级块操作入口：`/duplicate`、`/delete`、`/move up`、`/move down` 和
  `/comment`，用于复制、删除、上下移动当前块，以及给当前块或选中文本添加本地评论。
- 复制块链接、复制块 Markdown、复制块 HTML 也已接入 slash 和 Cmd/Ctrl+K，方便把投研
  段落本地复用到报告、邮件或模型输入前的人工整理流程。
- `Cmd/Ctrl+Shift+M` 现在会触发本地评论入口，和 Notion 的评论快捷键保持一致。
- `Cmd/Ctrl+/` 现在会打开本地块菜单，用键盘访问转换块类型、移动、复制、复制链接和评论等操作。
- `Cmd/Ctrl+Shift+9` 现在会运行本地 child-page 流程，和 `/page` 一样创建子页面并自动进入新页面。
- Markdown 输入触发也更接近 Notion：`>` + 空格创建 toggle，`"` + 空格创建 quote，
  `---` + 空格创建 divider。
- `评论当前块` 和块复制导出命令同步加入 Cmd/Ctrl+K 编辑器命令；它们复用现有本地 block
  menu 逻辑，不连接云端、不读取文件 bytes、不调用 AI，也不会外发私人内容。
- `删除当前块` 只是用户主动触发的页面编辑动作，可通过撤销恢复；本轮验证不会删除现有页面内容。

### 文件/报告研究数据预览阶段

- 文件选择器、文件类型识别和能力矩阵现在显式覆盖 SEC/XBRL、XML schema/style、JSONL、
  YAML、TOML 等研究数据/披露文本格式。
- `.xbrl`、`.xsd`、`.xsl`、`.xslt` 会作为本地文本/ XML 预览处理；这只做本地高亮和
  可编辑文本导入路线，不做 XBRL 语义解析、不上传、不调用外部转换、不连接云端或 AI。
- 会议 transcript/subtitle 文件 `.srt`、`.vtt`、`.webvtt`、`.sbv`、`.lrc`、`.ttml`
  也会作为本地文本预览处理，便于会议模块后续人工关联 transcript 页面；这不自动参会、
  不录音、不转写、不调用 AI。

### 会议转录稿接入准备阶段

- 会议模块新增“会议转录稿接入准备”面板，能把字幕/转写文件、纯文本、Markdown、HTML
  可视化报告、PDF、Word/ODT、Excel/CSV 行动项表、音视频录制、ZIP 和 iWork 文件映射到
  当前本地预览或留存路线。
- 这个面板可以导出本地接入矩阵，用来确认哪些格式可原生预览、哪些需要本地转换、哪些只做
  元数据或本地留存，以及哪些入口需要用户再次确认。
- 会议转录稿接入矩阵只读取内置格式能力，不读取真实文件名、文件 bytes、页面正文、转录稿
  文本、录音字节、参会人详情、会议密码、数据库行值、云端数据或 AI 内容；也不会创建页面、
  上传、同步、发布纪要或调用 AI。
- 这一步为下一阶段的真实拖拽上传和会议页关联做准备；真正导入用户文件、转写录音、发送 AI
  或云同步前仍需要单独确认。

### 会议文件本地接入页面阶段

- 会议模块新增“接入会议文件 / 选择会议文件”入口；用户主动选择文件后，ZhiNotes 会把文件保存到
  浏览器本地 IndexedDB，并创建一个本地会议文件页面。
- 新页面会自动包含本地文件预览块，以及“关键表述、开放问题、行动项、投研影响、研究关联、
  安全边界”等复盘区，方便把转录稿、会议材料、行动项表或录音索引接入会议工作流。
- 页面标题会按文件类型自动区分：字幕/文本偏“会议转录稿”，音视频偏“会议录音索引”，
  Excel/CSV 偏“会议行动项表”，HTML/PDF/Word/PPT 偏“会议材料”，ZIP/iWork/未知格式偏
  “会议附件”。
- 这个入口只在用户点击并选择文件后读取该文件；不会自动扫描本地磁盘，不上传、不云同步、
  不自动转写录音、不发布纪要、不调用 AI。文件动作 receipt 的来源现在会标记为 `meetings-module`，
  但 receipt 仍不包含文件名、文件 bytes、文件正文、页面正文或表格值。

### 数据库 Formula 字段阶段

- 新增本地只读 Formula 字段；字段可以用 `{字段名}` 引用同一行的其他字段，支持
  `+ - * /` 和括号，适合先覆盖目标价 upside、估值倍数、简单评分等投研表格场景。
- Formula 结果使用现有数字格式体系：普通数字、百分比、美元、人民币、倍数；这只改变展示，
  不会把计算结果写回 row values。
- Table、List、Gallery、Timeline、Feed、Chart、搜索、排序和 CSV/XLSX 导出都会使用本地计算
  后的 Formula 结果；Form 和 spreadsheet import 会跳过 Formula 写入，避免用户误以为它是手填字段。
- 公式计算器是本地安全表达式解析器，只允许数字、字段引用、括号和基础四则运算，不执行任意代码，
  不读取页面正文、文件内容、云端数据或 AI 内容。

### 数据库视图规则阶段

- 每个数据库 view 现在可以保存多个筛选规则和多个排序规则；筛选可按“全部匹配”或“任一匹配”处理，
  排序按从左到右的优先级处理，更接近 Notion database view 的日常用法。
- 多个筛选现在可以在 view config 里保存 `全部匹配` 或 `任一匹配` 模式；旧 view config 默认
  继续按 `全部匹配` 处理。
- 筛选规则现在支持 `包含`、`不包含`、`等于`、`不等于`、`大于`、`小于`、`早于`、`晚于`、
  `为空`、`不为空`；旧 view config 没有 operator 时继续按 `包含` 处理，inline database 读取
  保存视图时也会应用同一套 operator。
- 旧的单一筛选/排序 view config 保持兼容：打开时会自动转成一条筛选规则或一条排序规则。
- 保存视图会同时记录 row search、filter rules、sort rules、隐藏字段和 chart 分组；这些都只写入
  view config，不会改动数据库行值、页面正文、文件 bytes、云端数据或 AI 内容。
- 属性显示菜单现在支持按字段名、字段类型或字段说明本地搜索，并能一键全部显示或只显示名称列。
- 新增本地 view 分组：Table、List、Gallery、Feed 视图可以按字段分组展示；分组字段同样保存到
  view config，只影响展示，不改 row values。
- Kanban view 现在也会读取保存的分组字段；当字段适合 board 展示时，支持按 status、select 或
  checkbox 分栏。
- Kanban 卡片现在会显示最多 3 个本地属性预览，包括 relation、number、formula、rollup 和系统字段，
  用来快速扫描投研上下文。
- Calendar 和 Timeline view 现在可以保存使用哪个日期字段；没有选择时继续自动 fallback 到第一个
  date 或系统时间字段。
- Calendar view 会把缺少所选日期值的行保留在本地“无日期”区域，避免记录因为没填日期而消失。
- 数据库 view tab 现在有本地管理菜单：重命名、保存视图说明、复制视图配置、复制视图链接、
  删除非最后一个视图；删除是 soft delete，复制链接只生成带 `?view=` 的本地 URL；
  视图说明写入 view config；这些动作不删除行、页面、字段或文件。
- Inline database 现在会应用已保存的 view config：row search、筛选、排序、隐藏属性、图表
  分组和手动排序启用状态都会按所选 view 本地计算展示；inline 本身不写 view config。
- Inline database 的 Table、List、Gallery、Feed 也会读取保存的分组字段并渲染分组区块；
  分组只影响 page 内展示，不写入 row values、页面正文、文件 bytes、云端数据或 AI 内容。

### 数据库 Rollup 汇总字段阶段

- 新增本地只读 Rollup/汇总字段；当前保守版本只基于同一行的 relation 字段做汇总，
  支持“关联数量”和“关联页面标题”两种方式。
- Rollup 结果已接入 Table、List、Gallery、Timeline、Feed、Chart、搜索、排序和 CSV/XLSX 导出；
  Form 和 spreadsheet import 会跳过 Rollup 写入，避免把计算结果当成手填字段。
- Rollup 只读取本地 relation id 和页面标题，不读取关联页面正文、文件 bytes、云端数据或 AI 内容；
  后续如果要做跨数据库属性 rollup，再单独设计权限和数据边界。

### 数据库记录复制阶段

- 数据库记录现在支持本地复制：Table、List、Kanban、Calendar、Gallery、Timeline、Feed
  和 inline database 视图都能从已有记录创建副本。
- 复制记录会新建一个本地 row/page，并复制原记录的标题和字段值；页面正文默认不复制，避免误把长篇
  投研 memo、会议纪要或报告正文复制出多份。
- 这个能力不改数据库 schema，不删除任何记录，不读取上传文件 bytes，不连接云端，不调用 AI，
  也不外发任何私人内容。

### 数据库字段复制阶段

- 完整数据库页和 inline database 的字段设置菜单现在支持“复制字段”。
- 字段复制会复制字段名、字段类型和字段配置，例如选项、数字格式、公式表达式或 rollup 设置；
  它不会复制已有行值，也不会读取页面正文、文件 bytes、云端数据或 AI 内容。
- 这个能力适合快速搭建相似的投研属性，例如多个评分维度、多个日期字段或多个状态字段。

### 数据库字段说明阶段

- 完整数据库页和 inline database 的字段设置菜单现在支持“字段说明”。
- 字段说明保存在本地字段 config 中，用来记录字段口径、投研假设和使用规则，例如目标价口径、
  催化剂日期定义或评分含义。
- 字段说明只读写字段配置，不读取或改写任何行值、页面正文、文件 bytes、云端数据或 AI 内容。
- Table view 的列头现在会在有字段说明时显示本地提示标记，hover 可查看字段口径或投研假设。

### 数据库字段顺序阶段

- 完整数据库页和 inline database 的字段设置菜单现在支持字段前移/后移。
- 名称/title 字段保持固定第一列，用来打开页面；其它字段只交换本地 position metadata。
- 字段顺序调整不读取或改写任何行值、页面正文、文件 bytes、云端数据或 AI 内容。

### 数据库视图顺序阶段

- 数据库 view tab 设置菜单现在支持左移/右移。
- 视图顺序调整只交换本地 view position metadata，不改变筛选、排序、分组、隐藏属性或任何行值。
- 这一步主要用于把最常用的投研视图放到前面，例如表格、看板、动态流或图表。

### 数据库行顺序阶段

- Table、List、Gallery 视图现在支持行上移/下移；inline database 也共用同一套本地 row ordering。
- 行顺序调整只交换本地 row position metadata，不读取或改写字段值、页面正文、文件 bytes、云端数据或 AI 内容。
- 当前只在手动排序语境下启用；按日期、状态或更新时间组织的视图暂不放手动行排序按钮，避免操作后视觉结果不明显。

### 数据库表格摘要阶段

- Table view 现在在底部显示 Notion-like 字段摘要：标题覆盖、checkbox 完成度、number/formula/rollup
  合计与平均、日期覆盖、唯一值数量都会基于当前可见行本地计算。
- 表格摘要不写入 row values，不读取页面正文，不读取文件 bytes，不连接云端，也不调用 AI；inline
  database 和分组 table 复用同一套只读摘要。

### 数据库删除确认阶段

- 完整数据库页和 inline database 现在都会在删除字段或删除记录前弹出本地确认。
- 删除记录仍然沿用已有 soft delete：数据库 row 和它对应的本地页面会一起软删除；不会上传或外发任何内容。
- 删除字段只移除字段配置，不删除页面正文、文件 bytes、云端数据或 AI 内容；这一步主要降低误触 `x`
  导致结构突然消失的风险。

### 文件与 Markdown 原生展示阶段

- 扩展本地文件格式识别：Markdown 族现在包括 `.rmd`、`.qmd`；研究文本/引用文件包括
  LaTeX、BibTeX、RIS、reStructuredText、AsciiDoc、Mermaid、Org、Stata、SAS、Julia
  等常见格式。
- 增强文本预览高亮：LaTeX、BibTeX、RIS、Mermaid、Julia、SAS、Stata 等文件会进入更
  准确的语言映射和代码块语言菜单。
- 报告模块导入页面标题更接近原文件：HTML 优先使用 `<title>` 或第一个 H1；Markdown
  优先使用 frontmatter `title` 或第一个一级标题。
- 编辑器内直接上传文件也会生成本地 metadata-only receipt；receipt 不包含文件名、文件
  bytes、文件正文、页面正文或表格值。
- 报告模块的文件动作 receipt 卡片会显示来源：编辑器上传、页面预览块或报告模块。
- Markdown 从报告模块导入为页面时，`[[已有页面名]]` 会解析为本地页面 mention，并写入
  wiki link 关系；找不到同名页面时仍保留未解析 wiki-reference。

### 通用文件页面入口阶段

- Files 模块新增“创建文件页面”入口；用户主动选择任意本地文件后，ZhiNotes 会把文件保存到
  浏览器本地 IndexedDB，并创建一个通用文件 page。
- Files 模块里的已有本地文件卡片也新增“从本地文件创建 Page”动作；这会复用已经保存在
  浏览器本地的文件，不需要重新选择文件。
- 新页面会自动包含本地文件预览块、格式路线表、推荐去向、复核清单、研究关联区和安全边界，
  适合先把“不知道属于报告/会议/笔记/数据库哪个模块”的文件放入统一 page 容器。
- 该入口仍不会自动扫描本地磁盘，不上传、不云同步、不调用 AI、不加载 HTML 外部资源、不执行文件、
  不解压写入工作区、不删除原文件，也不会创建数据库行。
- 文件动作 receipt 的来源新增 `files-module`；receipt 仍不包含文件名、文件 bytes、文件正文、
  页面正文、表格值、token、credential、prompt、云端数据或 AI 输出。

### 页面复制导出阶段

- 普通 page 顶部操作区新增“导出/复制”菜单，把下载 HTML、下载 Markdown、复制 MD、
  复制 HTML、打印 PDF 和复制链接聚合在一起，避免页面顶部操作区过于拥挤。
- 菜单支持点击外部或按 Escape 关闭。
- 这个菜单可以把当前页面直接复制为 Markdown 或可独立打开的 HTML 文本。
- `Cmd/Ctrl+K` 也新增“复制页面 Markdown”和“复制页面 HTML”动作，和页面工具栏走同一套
  本地 copy pipeline。
- `Cmd/Ctrl+K` 现在也能搜索“导出当前页面 HTML”和“导出当前页面 Markdown”，和页面顶部的
  HTML/MD 下载按钮走同一套本地导出 pipeline，并和 workspace 级“导出 Markdown”区分开。
- Markdown 复制复用现有 HTML-to-Markdown 转换器，保留标题、列表、toggle、callout、目录、
  文件预览链接、公式、同步块和嵌入等已有导出语义；HTML 复制复用现有 standalone HTML 导出结构。
- 这个能力只在用户主动触发时读取当前编辑器 HTML，并写入浏览器本地剪贴板；不会下载文件、
  上传、云同步、调用 AI、读取链接页面正文、读取数据库 row values 或读取上传文件 bytes。

### 笔记空状态起步阶段

- 当浏览器本地还没有任何页面时，Notes 模块会在第一屏显示“第一篇笔记”面板，提前提供
  “新建空白笔记”和前几个投研模板入口。
- 这个面板只展示本地创建入口；不会自动创建页面、写入工作区、上传、同步或调用 AI。
- 创建动作仍然必须由用户点击触发，创建后继续沿用已有流程自动进入新页面。

### 笔记格式入口阶段

- Notes 模块新增“格式入口”面板，明确 Markdown 笔记、HTML 可视化报告、PDF/Word/PPT、
  Excel/CSV 应先进入哪个本地模块。
- Markdown 和 HTML 报告会引导到 Reports，PDF/Word/PPT 先进入 Files，Excel/CSV 进入
  Databases 做确认后的结构化导入。
- Notes 工作台的“建议顺序”现在也会包含“确认文件格式入口”，空工作区时排在创建第一篇笔记之后，
  已有页面时作为固定复核步骤。
- `Cmd/Ctrl+K` 现在也能直接搜索“Markdown 笔记入口”“HTML 报告入口”“PDF / Office 文件入口”
  和“Excel / CSV 导入入口”。
- 这个面板只做路由说明和跳转，不读取文件、不创建页面、不写数据库、不上传、不调用 AI。

### ZIP 批量导入预检合同阶段

- Files 模块新增“ZIP 批量导入预检”面板和导出合同。
- 当前合同只定义未来 ZIP 导入路线：Markdown/HTML/Word/EPUB/OPML 进入 page/import，
  CSV/Excel/ODS 进入 database import，PDF/PPT 先本地留存，未知格式进入阻塞复核。
- 这个阶段不会读取真实 ZIP、ZIP 内文件名、条目 bytes，不解压、不创建页面、不创建数据库、
  不上传、不调用 AI。
- 合同列出未来必须 gate：条目清单预览、批量创建确认、HTML assets 安全复核和 rollback receipt。

### Sync/API 防护阶段

- 新增共享 `ApiGuardPanel`，统一 API 防护展示结构。
- 已迁移到共享面板的防护：
  - `POST /api/sync/push`
  - `GET /api/sync/pull`
  - `POST /api/files/presign`
  - `POST /api/audit/events`
  - `POST /api/backup/restore-preview`
  - `POST /api/backup/restore-apply`
  - `POST /api/cloud/migrations/apply`
- `SyncShell.tsx` 删除多套重复 summary/field/fixture/gate 小组件，后续新增类似防护时可以
  复用统一模板。
- `docs/cloud-deployment.md` 已补齐 disabled API 列表和共享防护面板说明。

## 本轮本地验证

以下命令已通过：

```bash
npm run verify:database
npm run lint
npm run build
```

Formula 字段、数据库视图规则、view 分组、Rollup 和记录复制阶段还做过 `/modules/databases`
浏览器只读检查，数据库模块可以正常渲染。

文件与 Markdown 原生展示阶段已通过：

```bash
npm run verify:file-preview
npm run verify:editor
npm run lint
npm run build
```

文件与 Markdown 原生展示阶段的每个小提交都至少跑过上述相关验证；最终版本已再次通过。

通用文件页面入口阶段已通过：

```bash
npm run verify:file-preview
npm run lint
npm run build
```

浏览器只读检查也已通过：`/modules/files` 能渲染“创建文件页面”入口、通用文件入口说明和
本地/导出边界，页面没有运行时错误。

会议转录稿接入准备阶段已通过：

```bash
npm run verify:research-workflow
npm run verify:file-preview
npm run lint
npm run build
```

浏览器只读检查也已通过：`/modules/meetings` 能渲染会议转录稿接入准备面板，能看到
`导出接入矩阵`、`.srt`、`.vtt` 和录音索引等关键内容，页面没有运行时错误。

此前 Sync/API 防护阶段也已通过：

```bash
npm run verify:web-beta
npm run verify:web-beta:smoke
npm run verify:modules
npm run verify:editor
npm run verify:database
npm run verify:file-preview
npm run verify:ai
npm run verify:research-workflow
npm run verify:page-structure
npm run verify:replay-harness
npm run lint
npm run build
```

`npm run verify:web-alpha` 的前四步通过，但它内部再次调用 `npm run build` 时，
Turbopack 在当前 Codex 沙盒里两次遇到 `binding to a port: Operation not permitted`。
单独运行 `npm run build` 已连续通过，所以这更像是当前沙盒执行组合命令时的限制，不是
应用代码本身的构建失败。醒来后如果要生成正式 Web Alpha receipt，可以在允许权限的环境
里重跑一次。

浏览器本地检查也已通过：

- `/modules/sync` 能渲染共享 API 防护面板。
- 文件签名、审计事件、恢复预览、恢复应用、同步推送、同步拉取、云迁移应用防护均可见。
- 检查后浏览器已切回用户原本的 page。

## 仍然阻塞或待用户确认

- GitHub push：本地提交已完成，但 HTTPS 认证仍需要用户回来处理。
- 云上线：还不能正式打开 cloud writes 或 cloud sync；需要 Supabase/Vercel 环境变量、
  preview smoke、Auth redirect、migration rollback 和 owner decision。
- 文件上传：`/api/files/presign` 仍是 disabled guard，不生成 signed URL，不上传文件。
- 恢复写入：restore preview/apply 仍是 disabled guard，不读取备份 payload，不写 workspace。
- 云迁移：cloud migration apply 仍是 disabled guard，不运行 SQL，不写 cloud schema。
- AI：仍需要用户明确选择上下文并确认外发边界后才能执行真实 AI 请求。

## 醒来后建议试用

1. 打开 `/modules` 看模块总览和进度快照。
2. 打开 `/modules/notes` 和一个 page，检查笔记工作流是否顺手。
3. 打开 `/modules/reports`，上传一个 HTML 报告，确认新页面标题是否来自 `<title>` 或 H1，
   并检查预览块、格式路线、receipt 来源是否清楚。
4. 在 `/modules/reports` 导入一个 Markdown/R Markdown/Quarto 笔记，确认页面标题、
   可编辑内容和 `[[已有页面名]]` 内部链接解析是否符合预期。
5. 在普通 page 里用工具栏或 `/file` 上传文件，确认页面预览正常，并在报告模块的 receipt
   历史里看到来源为“编辑器上传”。
6. 打开 `/modules/sync`，检查 Web Beta、备份恢复、文件、防护面板和导出按钮是否清楚。
7. 如果要继续上云，下一步先解决 GitHub push 认证，再做 Vercel preview 和 Supabase 测试项目。
