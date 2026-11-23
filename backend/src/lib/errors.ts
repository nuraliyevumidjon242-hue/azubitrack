export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Nicht authentifiziert.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Keine Berechtigung für diese Aktion.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Ressource nicht gefunden.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);

export const tooManyRequests = (message = 'Zu viele Anfragen. Bitte später erneut versuchen.') =>
  new AppError(429, 'RATE_LIMITED', message);

export const serviceUnavailable = (message: string, details?: unknown) =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message, details);
