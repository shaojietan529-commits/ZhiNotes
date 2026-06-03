# ZhiNotes Cloud Deployment Plan

日期：2026-06-03

## 平台确认

- 前端托管：Vercel
- 云后端：Supabase
- 可选边缘层：Cloudflare DNS / CDN / WAF

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
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
ZHINOTES_AUTH_REDIRECT_ORIGINS=https://your-vercel-domain.vercel.app
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
- `npm run build` 通过。
- Supabase migration 已在测试 project 跑通。
- Vercel 环境变量已配置，但生产写入开关默认可先保持 false。
- 登录 magic link 在测试邮箱上跑通。
- `/auth/callback` 能清理 URL token 并回到 `/modules/sync`。
- `GET /api/workspaces` 可以列出当前用户可访问的 workspace metadata。
- `POST /api/workspaces` 可以创建空 workspace 和 owner membership。
- workspace bootstrap 可以返回当前用户 role。
- Cloud sync owner confirmation phrase 可以在本地生成 receipt，但 receipt 不会开启 push。
- AI 外发和 restore write-back confirmation phrase 可以在本地生成 receipt，但 receipt 不会开启 `/api/ai/run` 或 `/api/backup/restore-apply`。
- HTML 外部资源加载 confirmation phrase 可以在本地生成 receipt，但默认仍阻止远程资源，且 receipt 不包含报告正文、URL 列表、token 或文件 bytes。

## 后续云同步顺序

1. Workspace bootstrap QA 和 local workspace link 确认。
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
