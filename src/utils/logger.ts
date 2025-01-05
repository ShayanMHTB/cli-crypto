import winston from 'winston';
import path from 'path';

const logDir = 'logs';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

export const logCommand = (command: string, args: any): void => {
  logger.info('Command executed', {
    command,
    arguments: args,
    timestamp: new Date().toISOString(),
  });
};

export const logError = (error: Error, context?: string): void => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
};

export default logger;
