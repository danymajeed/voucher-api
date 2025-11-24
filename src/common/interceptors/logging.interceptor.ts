import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body } = request;
    const correlationId = request.headers['x-correlation-id'] || uuidv4();

    // Add correlation ID to request and response headers
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const now = Date.now();
    const userId = request.user?.id || 'anonymous';

    this.logger.log({
      correlationId,
      userId,
      method,
      url,
      body: this.sanitizeBody(body),
      message: 'Request started',
    });

    return next.handle().pipe(
      tap({
        next: (_data) => {
          const responseTime = Date.now() - now;
          this.logger.log({
            correlationId,
            userId,
            method,
            url,
            statusCode: response.statusCode,
            responseTime: `${responseTime}ms`,
            message: 'Request completed',
          });
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error({
            correlationId,
            userId,
            method,
            url,
            statusCode: error.status || 500,
            responseTime: `${responseTime}ms`,
            error: error.message,
            message: 'Request failed',
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'refreshToken', 'accessToken'];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

export function generateUuid(): string {
  return uuidv4();
}
