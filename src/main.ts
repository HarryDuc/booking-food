import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: new ConsoleLogger({
        prefix: 'Backend',
      }),
    });
    const configService = app.get(ConfigService);
    const RATE_LIMIT =
      configService.get<number>('RATE_LIMIT') || 15 * 60 * 1000; // Default to 15 minutes for 1000 requests
    const RATE_LIMIT_MAX_REQUESTS =
      configService.get<number>('RATE_LIMIT_MAX_REQUESTS') || 1000;
    const ALLOWED_ORIGINS = configService.get<string>('ALLOWED_ORIGINS') || '*';
    const NODE_ENV = configService.get<string>('NODE_ENV') || 'development';
    const PORT = configService.get<number>('PORT') || 5512;
    // Trust proxy settings
    app.set('trust proxy', 1);

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(RATE_LIMIT as any),
      max: parseInt(RATE_LIMIT_MAX_REQUESTS as any),
      message: {
        success: false,
        error: 'Too many requests from this IP address',
        retryAfter: 'Please try again later',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Security headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      }),
    );

    // CORS configuration
    app.enableCors({
      origin: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',') : true,
      credentials: true,
      methods: ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Webhook-Signature',
      ],
    });

    // Logging
    app.use(
      morgan('combined', {
        skip: (req, res) => NODE_ENV === 'test',
      }),
    );

    // Rate limiting
    app.use(limiter);

    // Body parser
    app.use(
      express.json({
        limit: '10mb',
        verify: (req: any, res: any, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
    );
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Chỉ nén JSON + HTML, bỏ qua static frontend assets
    app.use(
      compression({
        filter: (req, res) => {
          // Nếu client không support thì thôi
          if (!req.headers['accept-encoding']) {
            return false;
          }

          // Bỏ qua file tĩnh frontend: js, css, images, fonts...
          if (
            req.path.match(
              /\.(js|css|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|mp4|zip|gz)$/,
            )
          ) {
            return false;
          }

          // Chỉ nén JSON và HTML
          const contentType = res.getHeader('Content-Type');
          if (contentType) {
            if (
              contentType.toString().includes('application/json') ||
              contentType.toString().includes('text/html')
            ) {
              return true;
            }
            return false;
          }

          // Nếu chưa biết content-type, fallback filter mặc định
          return compression.filter(req, res);
        },
        level: 5, // mức nén 1–9 (càng cao càng nặng CPU)
      }),
    );

    app.setGlobalPrefix('api', { exclude: ['/'] });

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(PORT);

    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`API Allows Using: ${ALLOWED_ORIGINS}`);

    // Graceful shutdown
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`${signal} received, shutting down gracefully`);
        await app.close();
        console.log('Process terminated');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Error starting application:', error.message);
    process.exit(1);
  }
}

bootstrap();
