import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar prefijo global para todas las rutas
  app.setGlobalPrefix('api/v1');
  
  // Aplicar interceptor de respuestas globalmente
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  
  // Aplicar filtros de excepción globalmente
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
  
  // Configurar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  
  // Habilitar CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 MedMind API running on http://localhost:${port}/api/v1`);
}
bootstrap();
