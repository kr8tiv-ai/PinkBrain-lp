import type { Config } from '../config/index.js';

export function createLoggerOptions(config: Config): Record<string, unknown> {
  return {
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.x-api-key',
        'config.apiAuthToken',
        'config.bagsApiKey',
        'config.heliusApiKey',
        'config.signerPrivateKey',
      ],
      censor: '[REDACTED]',
    },
    transport: config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  };
}
