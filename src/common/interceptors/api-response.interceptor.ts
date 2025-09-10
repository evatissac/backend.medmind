import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../interfaces/api-response.interface';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Si ya es una respuesta formateada, la devolvemos tal como está
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Si es una respuesta con mensaje personalizado
        if (data && typeof data === 'object' && 'message' in data && 'data' in data) {
          return {
            success: true,
            message: data.message,
            data: data.data,
          };
        }

        // Respuesta estándar de éxito
        return {
          success: true,
          message: 'OK',
          data: data,
        };
      }),
    );
  }
}