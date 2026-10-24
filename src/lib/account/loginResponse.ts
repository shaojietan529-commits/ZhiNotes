export function loginSendFailureMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload &&
      typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (status === 429) return "验证码请求过于频繁，请 10 分钟后再试。";
  if (status === 403) return "登录请求被访问检查拦截。请在浏览器中重新打开正式网站后再试。";
  if (status === 404) return "当前网址的登录接口不可用，请从 zhi-note.com/account 登录。";
  if (status >= 500) return `登录服务暂时不可用（${status}），请稍后重试；无需清除本机数据。`;
  return `验证码发送未获确认（${status}），请稍后重试。`;
}

export function isLoginCodeSent(payload: unknown): boolean {
  return !!payload && typeof payload === "object" && "status" in payload && payload.status === "sent";
}
