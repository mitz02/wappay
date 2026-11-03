export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  isSimulated: process.env.IS_SIMULATED === 'true',
  database: {
    url: process.env.DATABASE_URL,
    mode: process.env.DATABASE_MODE || 'mock',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
    apiTimeoutMs: parseInt(process.env.WHATSAPP_API_TIMEOUT_MS || '10000', 10),
  },
  financialMode: process.env.FINANCIAL_MODE || 'mock',
  financialProvider: {
    name: process.env.FINANCIAL_PROVIDER || 'sandbox',
    publicKey: process.env.FINANCIAL_PROVIDER_PUBLIC_KEY,
    secretKey: process.env.FINANCIAL_PROVIDER_SECRET_KEY,
    webhookSecret: process.env.FINANCIAL_PROVIDER_WEBHOOK_SECRET,
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'groq',
    apiKey: process.env.OPENAI_API_KEY,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  },
  finance: {
    currency: process.env.CURRENCY || 'NGN',
    precision: 100,
    maxDailyTransferKobo: BigInt(process.env.MAX_DAILY_TRANSFER_LIMIT_KOBO || '50000000'),
    defaultTransferFeeKobo: BigInt(process.env.DEFAULT_TRANSFER_FEE_KOBO || '1000'),
  },
});
