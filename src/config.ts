import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform(v => v === 'true');
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  BIMER_BASE_URL: z.string().url(),
  BIMER_USERNAME: z.string().min(1),
  BIMER_PASSWORD: z.string().min(1),
  BIMER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  BIMER_REFRESH_MARGIN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  BIMER_EXPIRES_IN_UNIT: z.enum(['seconds', 'milliseconds']).default('seconds'),
  ERP_SQL_CONNECTION_STRING: z.string().min(1),
  ERP_CODE_TYPE_ID: z.string().min(1).default('00A0000002'),
  API_KEYS_SHA256: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default(''),
  STATE_DB_PATH: z.string().default('./data/integration.db'),
  SYNC_INITIAL_CURSOR: z.string().regex(/^\d+$/).optional().or(z.literal('')),
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
  SYNC_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
  SYNC_CURSOR_SEMANTICS_CONFIRMED: bool.default(false)
});

export type Config = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config { return schema.parse(env); }
