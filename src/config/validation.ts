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
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsNotEmpty()
  FINANCIAL_PROVIDER: string = 'sandbox';

  @IsString()
  @IsNotEmpty()
  AI_PROVIDER: string = 'sandbox';

  @IsString()
  @IsNotEmpty()
  CURRENCY: string = 'NGN';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const transformed = plainToInstance(EnvironmentVariables, {
    ...config,
    PORT: Number(config.PORT || 3000),
    REDIS_PORT: Number(config.REDIS_PORT || 6379),
    IS_SIMULATED: config.IS_SIMULATED === 'true' || config.IS_SIMULATED === true,
  });

  const errors = validateSync(transformed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const formattedErrors = errors
      .map((e) => `Property "${e.property}" failed validation: ${Object.values(e.constraints || {}).join(', ')}`)
      .join('\n');
    throw new Error(`CRITICAL CONFIGURATION ERROR:\n${formattedErrors}`);
  }

  // Double check Production safety gate
  if (transformed.NODE_ENV === Environment.Production && transformed.IS_SIMULATED === true) {
    // Allowed during initial sandbox verification in production environment
    console.warn('⚠️ WARNING: Running in production environment with IS_SIMULATED=true. Live transactions are disabled.');
  }

  return transformed;
}
