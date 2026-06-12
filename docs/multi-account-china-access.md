# 多账号登录 + 中国可访问性：实施指南

目标：让 ZhiNotes 可以分享给朋友（多账号登录），同时保证在中国大陆能正常打开。
总体路线：Cloudflare 做域名和 CDN（解决墙的问题）→ 邮箱验证码登录（避开被墙的
OAuth）→ 数据按账号/工作区云化（后续阶段）。

## Phase 1：域名 + Cloudflare（你来操作，约 1 小时）

### 1. 买域名（推荐顺序）

| 注册商 | 推荐理由 | 价格参考 (.com/年) |
| --- | --- | --- |
| Cloudflare Registrar | 成本价无加价、续费不涨价、买完直接就在 Cloudflare 里，少一步迁移 | ~$10 |
| Porkbun | 便宜、界面简单、免费 WHOIS 隐私 | ~$11 |
| Namecheap | 老牌、稳定，但续费比首年贵 | 首年 ~$6，续费 ~$16 |

- 建议：直接在 **Cloudflare**（dash.cloudflare.com → Domain Registration）注册，
  因为下一步本来就要用 Cloudflare。注册需要一张 Visa/Mastercard。
- 后缀选 **`.com`**（在中国解析最稳定、最不容易被 DNS 污染）。`.app` 也可以。
  避免 `.xyz`、`.top` 等廉价后缀（垃圾站多，信誉差）。
- 不要在阿里云/腾讯云买：需要实名认证，且会被引导走备案流程。只要服务器和
  CDN 节点不在中国大陆境内，就**不需要 ICP 备案**。

### 2. 接入 Cloudflare

1. 域名加入 Cloudflare（在 Cloudflare 买的会自动完成）。
2. Vercel 项目 → Settings → Domains → 添加你的域名。
3. 按 Vercel 提示在 Cloudflare DNS 里加 CNAME 记录，**橙色云图标保持开启**
   （Proxied）——这就是中国用户的流量入口走 Cloudflare 而不是直连 Vercel 的关键。
4. Cloudflare SSL/TLS 模式设为 **Full (strict)**。

### 3. 验证中国可达

- 用 [itdog.cn/http](https://www.itdog.cn/http/) 输入你的新域名，看全国各省
  能否打开（绿色为正常）。
- 对照测试：直接测 `*.vercel.app` 地址通常是失败/超时的，新域名应该明显更好。

## Phase 2：邮箱验证码登录（代码已就绪，配置后生效）

代码位置：`src/lib/account/server.ts` + `src/app/api/account/*` + `/account` 页面。
未配置时所有接口返回 501，不发邮件、不写云端数据。

### 你需要做的配置

1. 注册 [resend.com](https://resend.com)（免费 100 封/天），拿到 API Key。
2. （推荐）在 Resend 里验证你的域名，发件人就能用 `login@你的域名`；
   不验证则只能用 Resend 的测试发件地址给你自己的邮箱发信。
3. 在 Vercel 项目 → Settings → Environment Variables 添加：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `RESEND_API_KEY` | Resend 控制台的 key | 发验证码邮件 |
| `ZHINOTES_ACCOUNT_ALLOWED_EMAILS` | `you@x.com,friend@y.com` | 受邀邮箱白名单，逗号分隔；不在名单的邮箱无法登录 |
| `ZHINOTES_ACCOUNT_EMAIL_FROM` | `ZhiNotes <login@你的域名>` | 可选；默认用 Resend 测试地址 |

KV（Upstash）已经连接，无需新配置。

### 登录体验

- 新设备首次登录：输入邮箱 → 收 6 位验证码 → 输入 → 完成。
- 之后 90 天免登录，持续使用会自动续期；退出登录或清浏览器数据才需要重新验证。
- 安全措施：验证码只存哈希、10 分钟过期、最多试 5 次、每邮箱 10 分钟最多发 3 封。

## Phase 3（未实施）：数据按账号云化 + 工作区共享

- 持仓云同步从"共享密码"升级为"按账号/工作区隔离"。
- 邀请邮箱加入工作区（owner / editor / viewer 角色）。
- 笔记/页面云同步放最后（需要冲突合并，工作量最大）。

## 边界提醒

- 本阶段只做"身份"，不动任何本地数据；笔记、文件、持仓仍只存在本机浏览器。
- 所有云端行为继续遵守现有门控：未配置环境变量 = 完全停用。
