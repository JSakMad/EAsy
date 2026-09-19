import { z } from "zod";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

dotenv.config({ path: resolve(fileURLToPath(new URL("../../../.env", import.meta.url))), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/easy_a_finder"),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  ADMIN_API_KEY: z.string().min(16).optional(),
  GROQ_API_KEY: z.string().optional(),
  RMP_INGESTION_ENABLED: z.enum(["true", "false"]).default("false"),
  RMP_TERMS_REVIEWED: z.enum(["true", "false"]).default("false"),
  RMP_CONTACT_EMAIL: z.string().email().optional(),
  RMP_REQUEST_DELAY_MS: z.coerce.number().int().min(2500).default(5000),
  RMP_MAX_REQUESTS_PER_RUN: z.coerce.number().int().min(1).max(200).default(50),
  RMP_MAX_REQUESTS_PER_DAY: z.coerce.number().int().min(1).max(1000).default(200),
  RMP_MAX_PROFESSORS_PER_RUN: z.coerce.number().int().positive().max(500).default(5),
  RMP_SCHOOL_LEGACY_ID: z.literal("1247").default("1247"),
  RMP_SCHOOL_RELAY_ID: z.literal("U2Nob29sLTEyNDc=").default("U2Nob29sLTEyNDc="),
});

export const config = schema.parse(process.env);

export function assertIngestionAllowed() {
  if (config.RMP_INGESTION_ENABLED !== "true" || config.RMP_TERMS_REVIEWED !== "true") {
    throw new Error("RMP ingestion is disabled. Set RMP_INGESTION_ENABLED=true and RMP_TERMS_REVIEWED=true to enable it.");
  }
}
