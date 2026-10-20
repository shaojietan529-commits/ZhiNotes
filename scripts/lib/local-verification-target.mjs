export function configuredLocalVerificationServer(value = process.env.ZHINOTES_VERIFY_BASE_URL) {
  if (value === undefined) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ZHINOTES_VERIFY_BASE_URL must be a localhost HTTP origin with an explicit port.");
  }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !url.port || Number(url.port) < 1) {
    throw new Error("ZHINOTES_VERIFY_BASE_URL must be a localhost HTTP origin with an explicit port.");
  }
  return { baseUrl: url.origin, port: Number(url.port) };
}
