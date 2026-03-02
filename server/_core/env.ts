export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ytDlpCookiesPath: process.env.YTDLP_COOKIES_PATH ?? "",
  ytDlpCookiesBase64:
    process.env.YTDLP_COOKIES_BASE64 ?? process.env.YTDLP_COOKIES_B64 ?? "",
  ytDlpCookies: process.env.YTDLP_COOKIES ?? "",
};

export const AUTH_ENABLED = Boolean(
  ENV.appId && ENV.cookieSecret && ENV.oAuthServerUrl
);
