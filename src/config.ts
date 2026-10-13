import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DAILY_LIMIT: z.coerce.number().default(20),
  DRY_RUN: z.enum(["true", "false"]).default("true"),
  AUTO_SUBMIT: z.enum(["true", "false"]).default("false"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  dbUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  isDev: parsed.data.NODE_ENV === "development",
  env: parsed.data.NODE_ENV,
  resumesDir: path.join(__dirname, "../resumes"),
  screenshotsDir: path.join(__dirname, "../screenshots"),
  dailyLimit: parsed.data.DAILY_LIMIT,
  dryRun: parsed.data.DRY_RUN === "true",
  autoSubmit: parsed.data.AUTO_SUBMIT === "true",
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
};
