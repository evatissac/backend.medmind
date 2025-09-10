import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Obtener el mensaje y posibles errores de validación
    const exceptionResponse = exception.getResponse();
    let message = exception.message || 'Internal server error';
    let errors: any = null;
    let code: string | undefined = undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || message;
      
      // Si hay errores de validación (class-validator)
      if (responseObj.message && Array.isArray(responseObj.message)) {
        message = 'The given data was invalid.';
        errors = responseObj.message;
        code = 'validation_failed';
      }
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        message,
        ...(code ? { code } : {}),
        ...(errors ? { errors } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException 
      ? exception.message 
      : 'Internal server error';

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code: 'internal_error',
      },
    };

    response.status(status).json(errorResponse);
  }
}