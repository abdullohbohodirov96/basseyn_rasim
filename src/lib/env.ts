import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(""),
  INITIAL_ADMIN_TELEGRAM_ID: z.string().trim().min(1),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  TELEGRAM_REPORT_GROUP_ID: z.string().optional(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ENDPOINT: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().optional().default(""),
  R2_SIGNED_URL_EXPIRES_SECONDS: z.coerce.number().int().positive().default(900),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(20),

  CRON_SECRET: z.string().min(1),

  APP_URL: z.string().optional().default(""),
  NODE_ENV: z.string().optional().default("development"),

});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Lazily validates and returns process.env.
 * Throws with a descriptive (but secret-free) message if something is missing.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid/missing environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export const MAX_UPLOAD_SIZE_BYTES = () => getEnv().MAX_UPLOAD_SIZE_MB * 1024 * 1024;
