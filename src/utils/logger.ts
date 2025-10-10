type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = process.env.LOG_LEVEL;
const configuredLevel: LogLevel =
  envLevel && envLevel in levelPriority ? (envLevel as LogLevel) : 'info';

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= levelPriority[configuredLevel];
}

type LogContext = Record<string, unknown> | undefined;

function buildLogMessage(message: string, context?: LogContext) {
  if (!context || Object.keys(context).length === 0) {
    return message;
  }

  try {
    return `${message} ${JSON.stringify(context)}`;
  } catch {
    return message;
  }
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (!shouldLog(level)) return;

  const line = buildLogMessage(message, context);

  switch (level) {
    case 'debug':
      console.debug(line);
      break;
    case 'info':
      console.info(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
    default:
      console.log(line);
      break;
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    write('debug', message, context);
  },
  info(message: string, context?: LogContext) {
    write('info', message, context);
  },
  warn(message: string, context?: LogContext) {
    write('warn', message, context);
  },
  error(message: string, context?: LogContext) {
    write('error', message, context);
  },
};

export type Logger = typeof logger;
