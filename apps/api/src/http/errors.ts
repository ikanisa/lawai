import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export type HttpErrorBody = {
  error: string;
  message?: string;
  details?: unknown;
};

type LogLevel = 'error' | 'warn' | 'info' | null;

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly logLevel: LogLevel;

  constructor(status: number, code: string, message?: string, details?: unknown, logLevel: LogLevel = 'warn') {
    super(message ?? code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.logLevel = logLevel;
  }
}

export class ValidationError extends HttpError {
  public readonly target: 'query' | 'body' | 'headers' | 'params';
  public readonly issues: ReturnType<ZodError['flatten']>;

  constructor(target: 'query' | 'body' | 'headers' | 'params', error: ZodError) {
    const issues = error.flatten();
    super(400, 'invalid_request', `Invalid ${target}`, { target, issues }, 'warn');
    this.name = 'ValidationError';
    this.target = target;
    this.issues = issues;
  }
}

export class DomainError extends HttpError {
  constructor(code: string, message?: string, status = 400, details?: unknown, logLevel: LogLevel = 'warn') {
    super(status, code, message, details, logLevel);
    this.name = 'DomainError';
  }
}

export function mapErrorToHttp(error: unknown): { status: number; body: HttpErrorBody; logLevel: LogLevel } {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        ...(error.message && error.message !== error.code ? { message: error.message } : {}),
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      logLevel: error.logLevel,
    };
  }

  if (error instanceof ZodError) {
    const validation = new ValidationError('body', error);
    return mapErrorToHttp(validation);
  }

  if (error && typeof error === 'object' && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    const statusCode = (error as { statusCode: number }).statusCode;
    const message = error instanceof Error ? error.message : 'request_failed';
    return {
      status: statusCode,
      body: { error: 'request_failed', message },
      logLevel: statusCode >= 500 ? 'error' : 'warn',
    };
  }

  const message = error instanceof Error ? error.message : undefined;
  return {
    status: 500,
    body: {
      error: 'internal_server_error',
      ...(message ? { message } : {}),
    },
    logLevel: 'error',
  };
}

export function sendErrorResponse(reply: FastifyReply, error: unknown, request?: FastifyRequest) {
  const mapped = mapErrorToHttp(error);
  if (request && mapped.logLevel) {
    request.log[mapped.logLevel]({ err: error }, 'http_error_handled');
  }
  return reply.code(mapped.status).send(mapped.body);
}
