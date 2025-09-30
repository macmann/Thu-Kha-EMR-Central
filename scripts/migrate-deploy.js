#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const FAILED_MIGRATION = '20250501000000_system_admin_role';

function runPrisma(args, allowP3012 = false) {
  const result = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (allowP3012 && typeof result.stderr === 'string' && result.stderr.includes('P3012')) {
      return;
    }
    process.exit(result.status ?? 1);
  }
}

runPrisma(['migrate', 'resolve', '--rolled-back', FAILED_MIGRATION], true);
runPrisma(['migrate', 'deploy']);
