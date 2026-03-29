#!/usr/bin/env node

import { Command } from 'commander';
import { createBootstrapToken } from '../src/services/bootstrapAuth.js';

function requiredEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const program = new Command();

program
  .name('bootstrap-token')
  .description('Create a short-lived PinkBrain operator bootstrap token')
  .option('--frontend-url <url>', 'Optional frontend URL to print as a one-click sign-in link')
  .option('--json', 'Print JSON instead of plain text', false)
  .action((options) => {
    const bootstrapTokenSecret = requiredEnv(
      'BOOTSTRAP_TOKEN_SECRET',
      process.env.SESSION_SECRET ?? process.env.API_AUTH_TOKEN,
    );
    const bootstrapTokenTtlMinutes = Number(process.env.BOOTSTRAP_TOKEN_TTL_MINUTES ?? '10');
    const token = createBootstrapToken({
      bootstrapTokenSecret,
      bootstrapTokenTtlMinutes,
    });

    const output = options.frontendUrl
      ? new URL(`/?bootstrap=${encodeURIComponent(token)}`, options.frontendUrl).toString()
      : token;

    if (options.json) {
      process.stdout.write(JSON.stringify({
        token,
        output,
        ttlMinutes: bootstrapTokenTtlMinutes,
      }, null, 2) + '\n');
      return;
    }

    process.stdout.write(`${output}\n`);
  });

program.parse();
