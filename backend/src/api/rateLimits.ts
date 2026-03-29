export const GLOBAL_API_RATE_LIMIT = {
  global: true,
  max: 60,
  timeWindow: '1 minute',
} as const;

export const AUTH_SESSION_RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
} as const;

export const AUTH_LOGIN_RATE_LIMIT = {
  max: 5,
  timeWindow: '1 minute',
} as const;

export const AUTH_BOOTSTRAP_RATE_LIMIT = {
  max: 5,
  timeWindow: '1 minute',
} as const;

export const AUTH_LOGOUT_RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
} as const;

export const STATS_RATE_LIMIT = {
  max: 30,
  timeWindow: '1 minute',
} as const;

export const VALIDATION_PUBLIC_KEY_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute',
} as const;

export const VALIDATION_TOKEN_MINT_RATE_LIMIT = {
  max: 30,
  timeWindow: '1 minute',
} as const;

export const VALIDATION_SCHEDULE_RATE_LIMIT = {
  max: 60,
  timeWindow: '1 minute',
} as const;
