import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const prefix = configService.get<string>('apiPrefix') || 'api/v1';
  const isSimulated = configService.get<boolean>('isSimulated');

  // Set global API prefix
  app.setGlobalPrefix(prefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global bank-grade exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('WAPPay Banking API')
    .setDescription(
      'Bank-grade AI-powered conversational financial platform with double-entry accounting ledger.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 WAPPay Banking Core running on: http://localhost:${port}/${prefix}`);
  logger.log(`📖 OpenAPI / Swagger Docs at:    http://localhost:${port}/docs`);
  logger.log(`🛡️ IS_SIMULATED Safety Gate:     ${isSimulated ? 'ENABLED (Sandbox Mode)' : 'DISABLED (Live Mode)'}`);
  logger.log(`=======================================================`);
}

bootstrap();
