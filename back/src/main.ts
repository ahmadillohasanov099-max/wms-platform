import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import {
  HttpExceptionFilter,
  LoggingInterceptor,
  ResponseInterceptor,
} from './common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Prevent uncaught exceptions from killing the Node process
  process.on('uncaughtException', (err) => {
    logger.error('CRITICAL: Uncaught Exception intercepted:', err.stack || err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      'CRITICAL: Unhandled Rejection intercepted at:',
      promise,
      'reason:',
      reason,
    );
  });

  const app = await NestFactory.create(AppModule);

  // HTTP Response Compression (Gzip / Brotli - 70-80% payload size reduction)
  app.use(compression());

  // HTTP Security Headers (Hide X-Powered-By, Clickjacking protection, XSS protection)
  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Ombor boshqaruv tizimi API')
      .setDescription('Ombor boshqaruv tizimi REST API hujjatlari')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0', () => {
    logger.log(`Server started on port ${port} 🟢`);
    logger.log(`Swagger docs available at: http://localhost:${port}/docs`);
  });
}
bootstrap();
