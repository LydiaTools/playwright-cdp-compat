#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { inspectTarget } from './probes.mjs';
import { renderHtml, renderTerminal } from './report.mjs';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const DEFAULT_TIMEOUT_MS = 8_000;

function usage() {
  return `Playwright CDP Compat — observe a small capability matrix against local fixtures.

Usage:
  cdp-compat --target <name>=<endpoint-or-env> [options]

Options:
  --target <name>=<endpoint>  Add a Chromium CDP target; repeatable
  --target <name>=@env:NAME    Read the endpoint from an environment variable
  --json <file>               Write a machine-readable JSON report
  --html <file>               Write a self-contained HTML report
  --timeout-ms <number>       Per-operation timeout (default: ${DEFAULT_TIMEOUT_MS})
  --fail-on-unsupported       Exit with code 1 if any probe is unsupported
  --version                   Print the version
  --help                      Show this help

Endpoint values are never written into reports. For credentialed endpoints, use
the @env form so the URL does not appear in shell history or process arguments.`;
}

function parseArgs(argv) {
  const options = { targets: [], jsonPath: null, htmlPath: null, timeoutMs: DEFAULT_TIMEOUT_MS, failOnUnsupported: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { ...options, help: true };
    if (arg === '--version') return { ...options, version: true };
    if (arg === '--fail-on-unsupported') { options.failOnUnsupported = true; continue; }
    if (['--target', '--json', '--html', '--timeout-ms'].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      index += 1;
      if (arg === '--target') options.targets.push(value);
      else if (arg === '--json') options.jsonPath = value;
      else if (arg === '--html') options.htmlPath = value;
      else {
        const timeout = Number(value);
        if (!Number.isInteger(timeout) || timeout < 500 || timeout > 120_000) {
          throw new Error('--timeout-ms must be an integer from 500 through 120000.');
        }
        options.timeoutMs = timeout;
      }
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (options.targets.length === 0 && !options.help && !options.version) throw new Error('Add at least one --target.');
  if (options.jsonPath && options.htmlPath && options.jsonPath === options.htmlPath) throw new Error('JSON and HTML output paths must be different.');
  return options;
}

function parseTargets(specs) {
  const seen = new Set();
  return specs.map(spec => {
    const separator = spec.indexOf('=');
    if (separator < 1 || separator === spec.length - 1) throw new Error('Each target must use name=endpoint or name=@env:VARIABLE.');
    const name = spec.slice(0, separator);
    let endpoint = spec.slice(separator + 1);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(name)) throw new Error('Target names may contain letters, numbers, dot, underscore, and hyphen.');
    if (seen.has(name)) throw new Error(`Duplicate target name: ${name}.`);
    seen.add(name);
    if (endpoint.startsWith('@env:')) {
      const variableName = endpoint.slice(5);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName)) throw new Error('Invalid environment variable reference for a target.');
      endpoint = process.env[variableName];
      if (!endpoint) throw new Error(`Environment variable ${variableName} is missing or empty.`);
    }
    let parsed;
    try { parsed = new URL(endpoint); } catch { throw new Error(`Target ${name} has an invalid CDP endpoint.`); }
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error(`Target ${name} must use an HTTP(S) or WebSocket(S) CDP endpoint.`);
    }
    return { name, endpoint };
  });
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) { console.log(usage()); return 0; }
    if (options.version) { console.log(packageJson.version); return 0; }
    const targets = parseTargets(options.targets);
    const report = {
      schemaVersion: 1,
      tool: { name: 'playwright-cdp-compat', version: packageJson.version },
      generatedAt: new Date().toISOString(),
      targets: [],
    };
    for (const target of targets) report.targets.push(await inspectTarget(target, options.timeoutMs));

    console.log(renderTerminal(report));
    if (options.jsonPath) await writeFile(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (options.htmlPath) await writeFile(options.htmlPath, renderHtml(report), 'utf8');

    const allChecks = report.targets.flatMap(target => target.checks);
    const failures = allChecks.some(check => check.status === 'fail');
    const unsupported = options.failOnUnsupported && allChecks.some(check => check.status === 'unsupported');
    return failures || unsupported ? 1 : 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Run with --help for usage.');
    return 2;
  }
}

process.exitCode = await main();
