import * as Sentry from '@sentry/react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, boolean | number | string | null | undefined>;

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const observabilityEnabled = Boolean(sentryDsn);

Sentry.init({
  dsn: sentryDsn,
  enabled: observabilityEnabled,
  sendDefaultPii: false,
  tracesSampleRate: 0
});

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {})
    };
  }

  return { name: 'UnknownError', message: String(error) };
}

function writeLog(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    context
  };
  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.info(output);
  }

  Sentry.addBreadcrumb({
    category: 'app',
    message,
    level: level === 'warn' ? 'warning' : level,
    data: context
  });
}

export const logger = {
  debug: (message: string, context?: LogContext) => writeLog('debug', message, context),
  info: (message: string, context?: LogContext) => writeLog('info', message, context),
  warn: (message: string, context?: LogContext) => writeLog('warn', message, context),
  error: (message: string, context?: LogContext) => writeLog('error', message, context)
};

export function captureAppError(error: unknown, context: LogContext = {}) {
  const serialized = serializeError(error);
  logger.error(serialized.message, { ...context, errorName: serialized.name });

  if (!observabilityEnabled) return;

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}

export function setObservabilityUser(userId: string | null) {
  if (!observabilityEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
