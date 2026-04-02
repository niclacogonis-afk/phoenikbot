import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  clientSecret: process.env['CLIENT_SECRET'] ?? '',
  mongoUri: required('MONGODB_URI'),
  openaiKey: process.env['OPENAI_API_KEY'] ?? '',
  ownerIds: (process.env['BOT_OWNER_ID'] ?? '').split(',').filter(Boolean),
  sessionSecret: process.env['SESSION_SECRET'] ?? 'default-secret',
  dashboardUrl: process.env['DASHBOARD_URL'] ?? 'http://localhost:3000',
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  twitchClientId: process.env['TWITCH_CLIENT_ID'] ?? '',
  twitchClientSecret: process.env['TWITCH_CLIENT_SECRET'] ?? '',
  isDev: process.env['NODE_ENV'] !== 'production',
  /** Opzionale: Bearer o header X-API-Key per `/api/v1/...` */
  dashboardApiKey: process.env['DASHBOARD_API_KEY'] ?? '',
} as const;
