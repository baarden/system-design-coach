import dotenv from 'dotenv';

// Load environment variables before reading config
dotenv.config();

// Parse comma-separated allowed origins from environment
const parseOrigins = (envVar: string | undefined): string[] => {
  if (!envVar) return [];
  return envVar.split(',').map(s => s.trim()).filter(Boolean);
};

// Default allowed origins for development
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

export const config = {
  enableAuth: process.env.ENABLE_AUTH === 'true',
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS).length > 0
    ? parseOrigins(process.env.ALLOWED_ORIGINS)
    : DEFAULT_ALLOWED_ORIGINS,
  host: process.env.HOST || '127.0.0.1',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  redis: {
    url: process.env.REDIS_URL,
    keyPrefix: process.env.REDIS_KEY_PREFIX || '',
  },
};
