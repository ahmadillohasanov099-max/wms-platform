import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle Prisma known errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        // Unique constraint violation
        const fields =
          (exception.meta?.target as string[])?.join(', ') ?? 'field';
        return response.status(HttpStatus.CONFLICT).json({
          success: false,
          error: 'Conflict',
          message: `Bu ${fields} allaqachon mavjud (unique constraint violation)`,
          statusCode: HttpStatus.CONFLICT,
          timestamp: new Date().toISOString(),
        });
      }
      if (exception.code === 'P2025') {
        // Record not found (e.g., update on non-existent record)
        return response.status(HttpStatus.NOT_FOUND).json({
          success: false,
          error: 'Not Found',
          message: "Ma'lumot topilmadi",
          statusCode: HttpStatus.NOT_FOUND,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Handle NestJS HttpExceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      return response.status(status).json({
        success: false,
        error: exceptionResponse.error || 'ERROR',
        message: exceptionResponse.message || exception.message,
        statusCode: status,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle any other unhandled errors
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Serverda kutilmagan xatolik yuz berdi',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
    });
  }
}
