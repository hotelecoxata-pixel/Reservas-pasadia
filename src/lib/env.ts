/**
 * Acceso centralizado a variables de entorno.
 * Funciona en: runtime Node (Next.js server), Workers de Cloudflare y scripts.
 */

function getEnv(name: string): string | undefined {
  // process.env está disponible en Node y en Workers con nodejs_compat;
  // OpenNext también expone vars vía process.env en el runtime de Cloudflare.
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export const env = {
  get databaseUrl(): string {
    const url = getEnv("DATABASE_URL");
    if (!url) throw new Error("DATABASE_URL no está configurada");
    return url;
  },
  get authSecret(): string {
    const secret = getEnv("AUTH_SECRET");
    if (!secret) throw new Error("AUTH_SECRET no está configurada");
    return secret;
  },
  get resendApiKey(): string | undefined {
    return getEnv("RESEND_API_KEY");
  },
  get digestFromEmail(): string | undefined {
    return getEnv("DIGEST_FROM_EMAIL");
  },
  get digestToEmails(): string[] {
    const raw = getEnv("DIGEST_TO_EMAILS");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get telegramBotToken(): string | undefined {
    return getEnv("TELEGRAM_BOT_TOKEN");
  },
  get telegramChatId(): string | undefined {
    return getEnv("TELEGRAM_CHAT_ID");
  },
  get cronSecret(): string | undefined {
    return getEnv("CRON_SECRET");
  },
  /** Canales disponibles según configuración (para no fallar si falta uno). */
  get emailConfigured(): boolean {
    return Boolean(this.resendApiKey && this.digestFromEmail && this.digestToEmails.length > 0);
  },
  get telegramConfigured(): boolean {
    return Boolean(this.telegramBotToken && this.telegramChatId);
  },
};
