import { Catch, RpcExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';

@Catch()
export class GlobalGrpcExceptionFilter implements RpcExceptionFilter<RpcException> {
  catch(exception: any, host: ArgumentsHost): Observable<any> {
    let statusCode = status.INTERNAL;
    let message = 'Internal service error';

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      message = exception.message;

      switch (httpStatus) {
        case HttpStatus.BAD_REQUEST:
          statusCode = status.INVALID_ARGUMENT;
          break;
        case HttpStatus.UNAUTHORIZED:
          statusCode = status.UNAUTHENTICATED;
          break;
        case HttpStatus.FORBIDDEN:
          statusCode = status.PERMISSION_DENIED;
          break;
        case HttpStatus.NOT_FOUND:
          statusCode = status.NOT_FOUND;
          break;
        case HttpStatus.CONFLICT:
          statusCode = status.ALREADY_EXISTS;
          break;
        case HttpStatus.GATEWAY_TIMEOUT:
        case HttpStatus.REQUEST_TIMEOUT:
          statusCode = status.DEADLINE_EXCEEDED;
          break;
        default:
          statusCode = status.INTERNAL;
      }
    } else if (exception?.code !== undefined && typeof exception.code === 'number') {
      statusCode = exception.code;
      message = exception.message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    return throwError(() => new RpcException({ code: statusCode, message }));
  }
}
