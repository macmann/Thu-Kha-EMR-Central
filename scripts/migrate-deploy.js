#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function executePrisma(args) {
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

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runPrisma(args, { ignoreErrorCodes = [] } = {}) {
  const result = executePrisma(args);
  const combined = `${result.stdout}${result.stderr}`;

  if (result.status !== 0) {
    const shouldIgnore = ignoreErrorCodes.some((code) => combined.includes(code));
    if (!shouldIgnore) {
      process.exit(result.status || 1);
    }
  }

  return result;
}

function extractFailedMigrations(output) {
  const matches = new Set();
  const regex = /The `([^`]+)` migration/g;
  let match;

  while ((match = regex.exec(output)) !== null) {
    matches.add(match[1]);
  }

  return [...matches];
}

function markMigrationsAsRolledBack(migrations) {
  migrations.forEach((migration) => {
    runPrisma(['migrate', 'resolve', '--rolled-back', migration], {
      ignoreErrorCodes: ['P3012'],
    });
  });
}

function deployWithAutoResolve() {
  const firstAttempt = executePrisma(['migrate', 'deploy']);

  if (firstAttempt.status === 0) {
    return;
  }

  const output = `${firstAttempt.stdout}${firstAttempt.stderr}`;
  const failedMigrations = output.includes('P3009') ? extractFailedMigrations(output) : [];

  if (failedMigrations.length === 0) {
    process.exit(firstAttempt.status || 1);
  }

  markMigrationsAsRolledBack(failedMigrations);

  const secondAttempt = executePrisma(['migrate', 'deploy']);
  if (secondAttempt.status !== 0) {
    process.exit(secondAttempt.status || 1);
  }
}

deployWithAutoResolve();
