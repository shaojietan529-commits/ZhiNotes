# ZhiNotes Cloud Deployment Plan

日期：2026-06-03

## 平台确认

- 前端托管：Vercel
- 云后端：Supabase
- 可选边缘层：Cloudflare DNS / CDN / WAF

## 部署目标合同

`src/lib/sync/webBetaDeploymentTarget.ts` 记录当前平台策略：

- 第一阶段 Web Alpha：Vercel 托管当前 Next.js 应用和 route handlers。
- 第一阶段云后端：Supabase Auth、Postgres、RLS、Private Storage。
- Cloudflare 第一阶段定位：DNS、CDN、WAF、rate limit、安全 header。
- Cloudflare Pages / Workers：作为后续可选项保留，必须先证明 Next.js
  route、auth callback、环境变量、Supabase 调用、审计和 rollback 都兼容。
- 该合同只在本地生成和导出；不会创建云资源、部署应用、读取 secret、连接
  云服务、写 server data 或上传 workspace data。

`src/lib/sync/webBetaSmokeTestPlan.ts` 记录 preview 部署后的检查计划：

- pre-deploy：`lint`、`verify:web-beta`、production build、route contract。
- preview routes：`/modules/sync`、模块页、`/auth/callback`、窄屏布局。
- cloud defaults：cloud flag 默认关闭时，登录、workspace、sync、file、
  audit、permissions、restore 仍必须是 gated/disabled。
- data safety：文件同步、private storage、payload preview、外部资源、AI 和
  restore write-back 不得在 smoke test 中上传私有内容。
- edge and rollback：Cloudflare staging、provider rollback、migration rollback、
  incident path 和 observability 必须在 private beta 前确认。
- 该计划只生成本地 checklist；不会运行测试、发送网络请求、部署、创建账号、
  连接云服务、读取 secret、写 server data 或上传 workspace data。

`src/lib/sync/privateFileStoragePolicy.ts` 记录 private storage policy：

- 文件云同步必须使用 private Supabase Storage bucket，禁止 public URL 和 public
  listing。
- `/api/files/presign` 只能接收 metadata-only 请求，例如 workspace id、file id、
  file kind、mime type、size、checksum、operation 和 confirmation receipt id。
- signed URL 默认 TTL 为 10 分钟；signed URL 值、file bytes、data URL、file text、
  page text、tokens、cookies 和 secrets 都不得进入 sync、audit 或 permission 导出。
- HTML、Markdown、PDF、Excel、Word、PPT、notebook、archive 和 media 分不同
  file class 处理；archive/media 在上传前还需要额外人工复核。
- 该政策只在本地生成和导出；不会创建 bucket、生成 signed URL、连接云服务、
  读取文件名、读取文件 bytes、写 server data、上传文件或启用 file sync。

当前目标不是一次性做完整云同步，而是先上线一个安全的 private alpha：

1. Vercel 托管 Next.js 前端。
2. Supabase 提供 Auth、Postgres、Storage。
3. 云接口默认 disabled，只有环境变量显式打开后才调用 Supabase。
4. 第一阶段只启用账号和 workspace 元数据，不自动上传本地笔记、文件或数据库内容。

## 环境变量

从 `.env.example` 复制到 `.env.local`：

```bash
cp .env.example .env.local
```

本地默认值应保持：

```txt
ZHINOTES_CLOUD_ENABLED=false
ZHINOTES_ALLOW_CLOUD_WRITES=false
```

只有进入 private alpha 时才设置：

```txt
ZHINOTES_CLOUD_ENABLED=true
ZHINOTES_ALLOW_CLOUD_WRITES=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=workspace-files
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
ZHINOTES_AUTH_REDIRECT_ORIGINS=https://your-vercel-domain.vercel.app
ZHINOTES_AUDIT_RETENTION_DAYS=365
ZHINOTES_ERROR_MONITORING_DSN=...
```

## Supabase 初始步骤

1. 创建 Supabase project。
2. 在 SQL editor 中 review 并执行：

```txt
supabase/migrations/0001_zhinotes_cloud_foundation.sql
```

3. 确认 RLS 已开启。
4. 创建 private storage bucket：

```txt
workspace-files
```

并保持环境变量：

```txt
SUPABASE_STORAGE_BUCKET=workspace-files
```

5. 配置 Auth redirect URL：

```txt
https://your-vercel-domain.vercel.app/auth/callback
```

## 已接入的第一批 API

- `POST /api/auth/login/start`
  - 云开启且允许写入时，向 Supabase Auth 请求 magic link。
  - 只发送邮箱，不读取本地笔记、文件或数据库。

- `GET /api/auth/session`
  - 使用 Bearer token 查询 Supabase Auth user。
  - 不读取 cookies、本地笔记、文件或数据库。

- `POST /api/auth/logout`
  - 云开启且允许写入时结束 Supabase Auth session。

- `GET /auth/callback`
  - 接收 Supabase magic link 返回的浏览器 hash token。
  - 将 token 保存到浏览器本地 cloud session，并清理地址栏里的 token。

- `GET /api/workspaces`
  - 使用 Bearer token 列出当前用户可访问的 cloud workspace 元数据和 role。
  - 不读取页面正文、文件 bytes、数据库 rows 或本地 sync queue。

- `POST /api/workspaces`
  - 云开启、允许写入且提供 Bearer token 时，创建空 workspace 和 owner membership。
  - 只写入用户 profile、workspace 元数据和 membership；不上传本地笔记、文件、数据库 rows 或 sync queue。

- `GET /api/workspaces/:workspaceId/bootstrap`
  - 使用 Bearer token 读取 workspace 元数据和当前用户 membership。
  - 不拉取页面正文、文件 bytes、数据库 rows。

## 仍保持 disabled 的 API

- `POST /api/sync/push`
- `GET /api/sync/pull`
- `POST /api/files/presign`
- `POST /api/permissions/check`
- `POST /api/audit/events`
- `POST /api/backup/restore-apply`

这些会真正接触 workspace 数据、文件或权限，所以必须等 payload preview、权限检查、冲突处理和 rollback 证明完成后再打开。

## Private Alpha 判定

可以上 Vercel private alpha 的条件：

- `npm run lint` 通过。
- `npm run verify:web-beta` 通过，确认环境变量、Web Beta API route、模块
  route、deployment target、smoke test plan、Supabase migration 表结构和
  本地合同对齐。
- `npm run verify:web-beta:smoke` 通过，确认 preview smoke checklist、页面
  route、高风险 API 默认 disabled/gated、local-only 隐私边界和 Sync UI 导出
  入口对齐。
- `npm run build` 通过。
- Sync 模块里的 `Smoke test plan` 已导出或人工复核，且 preview route、auth
  callback、disabled cloud defaults、private storage disabled、Cloudflare edge
  staging、rollback 和 observability 都有明确通过条件。
- Sync 模块里的 `Private file storage policy` 已导出或人工复核，且确认
  `/api/files/presign` 仍是 disabled stub，没有生成 signed URL 或上传文件。
- Supabase migration 已在测试 project 跑通。
- Vercel 环境变量已配置，但生产写入开关默认可先保持 false。
- 登录 magic link 在测试邮箱上跑通。
- `/auth/callback` 能清理 URL token 并回到 `/modules/sync`。
- `GET /api/workspaces` 可以列出当前用户可访问的 workspace metadata。
- `POST /api/workspaces` 可以创建空 workspace 和 owner membership。
- workspace bootstrap 可以返回当前用户 role。
- 本地 workspace 连接云 workspace 前，必须先用当前 session 对选中的
  workspace 完成 bootstrap membership 检查，并导出/保留 metadata-only
  link receipt。
- Cloud sync opt-in gate 必须同时看到 linked workspace、bootstrap proof、
  payload preview、conflict baseline、disabled push API 和 owner confirmation
  phrase；只有 cloud workspace id 不足以进入同步。
- Cloud sync owner confirmation phrase 可以在本地生成 receipt，但 receipt 不会开启 push。
- AI 外发和 restore write-back confirmation phrase 可以在本地生成 receipt，但 receipt 不会开启 `/api/ai/run` 或 `/api/backup/restore-apply`。
- HTML 外部资源加载 confirmation phrase 可以在本地生成 receipt，但默认仍阻止远程资源，且 receipt 不包含报告正文、URL 列表、token 或文件 bytes。
- Spreadsheet bulk import confirmation phrase 可以在本地生成 receipt；导入仍只写入本地浏览器数据库，receipt 不包含 cell values 或文件 bytes。
- High-risk action registry 可以在本地导出，集中列出 typed confirmation phrase、覆盖状态和缺失控制；registry 不开启任何高风险动作。

## 后续云同步顺序

1. Workspace bootstrap QA、local workspace link proof 和 link receipt 确认。
2. Cloud sync opt-in gate：确认 linked workspace、payload preview、conflict baseline、disabled push API、owner confirmation phrase 和本地 confirmation receipt。
3. Pages/databases 云端最小 CRUD。
4. Sync payload preview 二次确认。
5. `sync_log` push acknowledgement。
6. Pull cursor 和冲突标记。
7. Private Storage signed upload/download。
8. Permission check 和 audit events。
9. Restore rollback 和 write-back。
10. AI provider、retention、final payload preview 和 typed confirmation receipt。
11. HTML/Report external resource allowlist、typed confirmation receipt 和审计事件。
12. Spreadsheet/database bulk import confirmation、rollback plan 和 audit events。
13. High-risk action registry 和模块接入规范。
