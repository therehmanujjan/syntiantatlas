import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createWinstonLogger } from './common/logger/logger.config';

async function bootstrap() {
  // Configure Winston logger BEFORE creating the NestJS app
  const logLevel = process.env.LOG_LEVEL || 'info';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logger = createWinstonLogger(logLevel, nodeEnv);

  const app = await NestFactory.create(AppModule, {
    logger,
    rawBody: true,
  });
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api');

  // Security
  app.use(helmet());
  app.use(compression());

  // Sentry request handler (must be first middleware)
  const sentryDsn = configService.get<string>('SENTRY_DSN');
  if (sentryDsn) {
    app.use(Sentry.Handlers.requestHandler());
  }

  // CORS
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS', 'http://localhost:3000');
  app.enableCors({
    origin: allowedOrigins.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Sentry error handler (must be after all controllers but before other error middleware)
  if (sentryDsn) {
    app.use(Sentry.Handlers.errorHandler());
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Syntiant Atlas API')
    .setDescription('Enterprise Web3 Fractional Real Estate Investment Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('health', 'Health check endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('properties', 'Property management endpoints')
    .addTag('investments', 'Investment endpoints')
    .addTag('transactions', 'Transaction endpoints')
    .addTag('admin', 'Admin panel endpoints')
    .addTag('kyc', 'KYC verification endpoints')
    .addTag('notifications', 'Notification endpoints')
    .addTag('settings', 'System settings endpoints')
    .addTag('tickets', 'Support ticket endpoints')
    .addTag('dividends', 'Dividend distribution endpoints')
    .addTag('marketplace', 'Secondary marketplace endpoints')
    .addTag('payments', 'Payment processing endpoints')
    .addTag('analytics', 'Analytics and reporting endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Start
  const port = configService.get<number>('PORT') || configService.get<number>('API_PORT', 8080);
  await app.listen(port);
  console.log(`Syntiant Atlas API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`Environment: ${nodeEnv}`);
  console.log(`Log level: ${logLevel}`);
  console.log(`Sentry: ${sentryDsn ? 'enabled' : 'disabled'}`);
}

bootstrap();
