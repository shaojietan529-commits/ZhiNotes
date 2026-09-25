# ZhiNote 会议抓取（Chrome 插件 · MVP）

一个浏览器插件，配合本地会议 Agent 做"双保险"。它解决的核心问题是：
**进门财经、久谦等平台需要登录才能看到会议详情，服务器是"陌生人"进不去**——
插件运行在你已登录的浏览器里，能读到你眼前真实渲染好的页面。

## 它做什么

1. 你在 Chrome 打开一个会议页（已登录、能看到详情）
2. 点工具栏的 ZhiNote 图标 → 点"抓取本页会议信息"
3. 插件读取**当前页面的可见文字**，在当前页弹出主题、日期、起止时间、平台、组织者的核对窗口
4. 可以手动修改字段，组织者、结束时间可清空；主题、日期和开始时间必填。点“发送到 ZhiNote”后，确认字段才会填进 ZhiHui 的“会议信息输入”框
5. 你**核对**后点"导入"——解析和入库都走 ZhiNote 现成的流程

## 安全边界（写死在插件里）

- **只在你点击时**读当前页 —— 没有后台偷读（用 `activeTab`，只有点击后才有权限）
- **只读可见文字** —— 不碰 cookie、密码、登录令牌
- 不读表单输入、隐藏内容或跨域 iframe；过滤敏感字段、导航和页脚。发送内容不包含原始网页正文
- 来源网址去掉认证信息、查询参数和片段；进门财经的数字路演路径保留，其他未知路径只保留站点地址
- **只发到你自己的 ZhiNote**（zhi-note.com / zhi-notes.vercel.app）—— 不发别处
- **最终导入由你点击** —— 插件只负责"把文字捞出来递过去"，不自动写入
- 代码全部在本仓库 `chrome-extension/`，可审计

## 怎么安装（开发者模式 · 加载未打包）

1. 打开 Chrome，地址栏输入 `chrome://extensions`
2. 右上角打开"开发者模式"
3. 点"加载已解压的扩展程序"
4. 选择本仓库的 `chrome-extension/` 文件夹
5. 工具栏出现 ZhiNote 图标即安装成功（如需固定，点拼图图标 → 图钉）

> 注意：MVP 未附带图标文件，Chrome 会显示默认拼图图标，不影响功能。

## 开发与验证

弹窗和应用共用 `src/lib/meetings/meetingInviteIntake.ts`。`meeting-parser.js` 是生成文件，不应手改，也不应在 popup 中另写解析规则。

```sh
node chrome-extension/build-parser.mjs
node chrome-extension/build-parser.mjs --check
node --test chrome-extension/review.test.mjs
node chrome-extension/handshake.test.mjs
npm run verify:meeting-intake
npm run verify:module-workspaces
npm run lint
npm run build
```

修改共享解析器后必须重新生成插件文件。升级后在 Chrome 扩展页刷新本插件，确认版本为 0.1.1；重新抓取会替换旧的核对窗口。

事件名 `zhihui:intake` / `zhihui:ready` / `zhihui:hello` 和 storage key `zhihui_pending_intake` 不变，仍传递字符串。字符串新增版本化的“已确认字段”格式，与应用解析器同批发布。确认字段（包括主动清空的值）不再被网页内容补回；服务端也不再访问这个已确认来源页面。

## 已知限制

- SPA 最多尝试 6 次，等待总计约 4.25 秒；会读取可见的同源 iframe，跨域 iframe 仍需在其页面单独点击插件
- 对无日期或无开始时间的页面会提示没有读到明显会议正文；不会自行猜测时间
- 未知平台网址仅保留站点地址，不保证能直接进入原会议；不会为保留可用链接而保留潜在 token
- 目标域名默认 `zhi-note.com`，固定在 `background.js`；不自动导入、不自动录制
- 本地测试通过不等于线上部署或跨浏览器同步通过，后者需要独立实测

## 后续阶段

- 第二阶段：点一下顺便触发本地 Agent 预约录制
- 第三阶段：完善用户主动点击后的平台兼容性；不后台读取页面
