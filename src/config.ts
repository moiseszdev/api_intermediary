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
  PARTNER_COMPANY_CODE: z.coerce.number().int().positive().default(1),
  STOCK_COMPANY_CODES: z.string().regex(/^\d+(,\d+)*$/).default('1'),
  STOCK_SECTOR_IDS: z.string().regex(/^[A-Za-z0-9]{10}(,[A-Za-z0-9]{10})*$/).default('00A0000008'),
  PRICE_TABLE_CODE: z.string().min(1).default('01'),
  PRICE_TABLE_ID: z.string().regex(/^[A-Za-z0-9]{10}$/).default('00A000001Q'),
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
