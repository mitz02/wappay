import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX: string = 'api/v1';

  // Bank-Grade Safety Gate: Must be explicitly parsed to boolean
  @IsBoolean()
  IS_SIMULATED: boolean = true;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  DATABASE_MODE?: string = 'mock';

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  // WhatsApp Cloud API Configuration
  @IsString()
  @IsOptional()
  WHATSAPP_ACCESS_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_API_URL?: string = 'https://graph.facebook.com/v21.0';

  @IsNumber()
  @IsOptional()
  WHATSAPP_API_TIMEOUT_MS?: number = 10000;

  @IsString()
  @IsNotEmpty()
  FINANCIAL_MODE: string = 'mock';

  @IsString()
  @IsNotEmpty()
  FINANCIAL_PROVIDER: string = 'sandbox';

  @IsString()
  @IsNotEmpty()
  AI_PROVIDER: string = 'sandbox';

  @IsString()
  @IsOptional()
  GROQ_API_KEY?: string;

  @IsString()
  @IsOptional()
  GROQ_MODEL?: string = 'llama-3.3-70b-versatile';

  @IsString()
  @IsNotEmpty()
  CURRENCY: string = 'NGN';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const transformed = plainToInstance(EnvironmentVariables, {
    ...config,
    PORT: Number(config.PORT || 3000),
    REDIS_PORT: Number(config.REDIS_PORT || 6379),
    IS_SIMULATED:
      config.IS_SIMULATED === undefined
        ? true
        : config.IS_SIMULATED === 'true' || config.IS_SIMULATED === true,
    WHATSAPP_API_TIMEOUT_MS: Number(config.WHATSAPP_API_TIMEOUT_MS || 10000),
    WHATSAPP_VERIFY_TOKEN: config.WHATSAPP_VERIFY_TOKEN || config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  });

  const errors = validateSync(transformed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const formattedErrors = errors
      .map((e) => `Property "${e.property}" failed validation: ${Object.values(e.constraints || {}).join(', ')}`)
      .join('\n');
    throw new Error(`CRITICAL CONFIGURATION ERROR:\n${formattedErrors}`);
  }

  // Enforce production security check
  if (transformed.NODE_ENV === Environment.Production && transformed.IS_SIMULATED === false) {
    if (!transformed.WHATSAPP_ACCESS_TOKEN || !transformed.WHATSAPP_APP_SECRET || !transformed.WHATSAPP_VERIFY_TOKEN) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Live production requires valid WhatsApp credentials.');
    }
  }

  return transformed;
}
