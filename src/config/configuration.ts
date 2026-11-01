export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  isSimulated: process.env.IS_SIMULATED === 'true',
  database: {
    url: process.env.DATABASE_URL,
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
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  },
  financialProvider: {
    name: process.env.FINANCIAL_PROVIDER || 'sandbox',
    publicKey: process.env.FINANCIAL_PROVIDER_PUBLIC_KEY,
    secretKey: process.env.FINANCIAL_PROVIDER_SECRET_KEY,
    webhookSecret: process.env.FINANCIAL_PROVIDER_WEBHOOK_SECRET,
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'sandbox',
    apiKey: process.env.OPENAI_API_KEY,
  },
  finance: {
    currency: process.env.CURRENCY || 'NGN',
    precision: 100,
    maxDailyTransferKobo: BigInt(process.env.MAX_DAILY_TRANSFER_LIMIT_KOBO || '50000000'),
    defaultTransferFeeKobo: BigInt(process.env.DEFAULT_TRANSFER_FEE_KOBO || '1000'),
  },
});
