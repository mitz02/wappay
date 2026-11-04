import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';

let handlerPromise: Promise<(req: Request, res: Response) => unknown> | undefined;

async function createHandler() {
  const server = express();
  server.get('/', (_req, res) => res.redirect('/docs'));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const prefix = configService.get<string>('apiPrefix') || 'api/v1';

  app.setGlobalPrefix(prefix, {
    exclude: [
      'webhooks/whatsapp',
      'webhooks/whatsapp/(.*)',
      'gift',
      'gift/(.*)',
      'media',
      'media/(.*)',
      'register',
      'register/(.*)',
      'flows',
      'flows/(.*)',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WAPPay Banking API')
    .setDescription('Sandbox conversational financial platform')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.init();
  Logger.log(`WAPPay serverless handler initialized at /${prefix}`, 'Bootstrap');
  return (req: Request, res: Response) => server(req, res);
}

export default async function handler(req: Request, res: Response) {
  handlerPromise ??= createHandler();
  try {
    const appHandler = await handlerPromise;
    return appHandler(req, res);
  } catch (error) {
    handlerPromise = undefined;
    Logger.error(error, 'Failed to initialize WAPPay serverless handler');
    return res.status(500).json({
      statusCode: 500,
      message: 'WAPPay failed to initialize. Check deployment environment variables and database connectivity.',
    });
  }
}
