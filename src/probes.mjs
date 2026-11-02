import { chromium } from 'playwright-core';

export const PROBE_CATALOG = [
  { id: 'navigation', label: 'Data URL navigation', group: 'Navigation' },
  { id: 'locators-forms', label: 'Role/label locators and selectOption', group: 'Locators & forms' },
  { id: 'iframe-locator', label: 'frameLocator interaction', group: 'Frames' },
  { id: 'context-cookie-isolation', label: 'Browser-context cookie isolation', group: 'Contexts' },
  { id: 'timezone-media', label: 'Timezone and media emulation', group: 'Emulation' },
  { id: 'network-route', label: 'Playwright request routing', group: 'Networking' },
];

const UNSUPPORTED_RE = /(?:not supported|unsupported|unknown method|method not found|not implemented|unimplemented|does not support)/i;
const PROBE_GROUPS = Object.fromEntries(PROBE_CATALOG.map(probe => [probe.id, probe.group]));
const FORM_FIXTURE = `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>CDP fixture</title>
<main>
  <label for="project-name">Project name</label>
  <input id="project-name" type="text">
  <label for="output-style">Output style</label>
  <select id="output-style"><option value="full">Full</option><option value="compact">Compact</option></select>
  <button type="button" id="save">Save profile</button>
  <output id="result" role="status">Not saved</output>
</main>
<script>
  document.querySelector('#save').addEventListener('click', () => {
    document.querySelector('#result').textContent =
      document.querySelector('#project-name').value + '|' + document.querySelector('#output-style').value;
  });
</script></html>`;

function cleanError(error, endpoint) {
  let message = error instanceof Error ? error.message : String(error);
  if (endpoint) message = message.split(endpoint).join('[CDP endpoint redacted]');
  return message
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/gi, '[URL redacted]')
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
    .replace(/\b((?:token|api[-_ ]?key|secret|password|authorization)\s*[:=]\s*)[^\s,;"'<>]+/gi, '$1[redacted]')
    .replace(/(?:\/Users\/|\/home\/)[^\s"'<>]+/g, '[local path redacted]')
    .replace(/[A-Z]:\\Users\\[^\s"'<>]+/g, '[local path redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 360);
}

function classifyError(error) {
  return UNSUPPORTED_RE.test(error instanceof Error ? error.message : String(error))
    ? 'unsupported'
    : 'fail';
}

async function recordProbe(target, id, label, run) {
  const started = performance.now();
  try {
    const detail = await run();
    return {
      id,
      label,
      group: PROBE_GROUPS[id],
      status: 'pass',
      durationMs: Math.round(performance.now() - started),
      detail,
    };
  } catch (error) {
    return {
      id,
      label,
      group: PROBE_GROUPS[id],
      status: classifyError(error),
      durationMs: Math.round(performance.now() - started),
      detail: cleanError(error, target.endpoint),
    };
  }
}

async function withPage(context, timeoutMs, run) {
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
  try {
    return await run(page);
  } finally {
    await page.close().catch(() => {});
  }
}

async function runNavigation(target, context, timeoutMs) {
  return recordProbe(target, 'navigation', 'Data URL navigation', () => withPage(context, timeoutMs, async page => {
    const html = '<!doctype html><title>CDP fixture</title><h1>Local fixture ready</h1>';
    await page.goto(`data:text/html,${encodeURIComponent(html)}`, { waitUntil: 'load', timeout: timeoutMs });
    const heading = await page.getByRole('heading', { name: 'Local fixture ready' }).textContent();
    if (heading !== 'Local fixture ready') throw new Error('The local fixture heading did not match.');
    return 'Loaded and read a local data URL; no website was contacted.';
  }));
}

async function runLocatorsAndForms(target, context, timeoutMs) {
  return recordProbe(target, 'locators-forms', 'Role/label locators and selectOption', () => withPage(context, timeoutMs, async page => {
    await page.setContent(FORM_FIXTURE, { waitUntil: 'load', timeout: timeoutMs });
    await page.getByLabel('Project name').fill('Field notes', { timeout: timeoutMs });
    await page.getByLabel('Output style').selectOption('compact', { timeout: timeoutMs });
    await page.getByRole('button', { name: 'Save profile' }).click({ timeout: timeoutMs });
    const result = await page.getByRole('status').textContent();
    if (result !== 'Field notes|compact') throw new Error(`Form result was ${JSON.stringify(result)}.`);
    return 'Filled a labeled input, selected an option, clicked by role, and read the status output.';
  }));
}

async function runFrame(target, context, timeoutMs) {
  return recordProbe(target, 'iframe-locator', 'frameLocator interaction', () => withPage(context, timeoutMs, async page => {
    await page.setContent('<iframe id="fixture-frame" title="Child fixture"></iframe>', { timeout: timeoutMs });
    const frameHtml = `<!doctype html><button type="button">Frame action</button><output role="status">Ready</output><script>document.querySelector('button').addEventListener('click',()=>document.querySelector('output').textContent='Frame clicked')</script>`;
    await page.locator('#fixture-frame').evaluate((frame, srcdoc) => { frame.srcdoc = srcdoc; }, frameHtml);
    const frame = page.frameLocator('#fixture-frame');
    await frame.getByRole('button', { name: 'Frame action' }).click({ timeout: timeoutMs });
    const result = await frame.getByRole('status').textContent();
    if (result !== 'Frame clicked') throw new Error(`Frame result was ${JSON.stringify(result)}.`);
    return 'Clicked a button inside a srcdoc iframe and read its local result.';
  }));
}

async function runContextIsolation(target, browser) {
  return recordProbe(target, 'context-cookie-isolation', 'Browser-context cookie isolation', async () => {
    let first;
    let second;
    try {
      first = await browser.newContext();
      second = await browser.newContext();
      await first.addCookies([{ name: 'cdp_compat_first', value: 'one', url: 'https://compat.invalid/' }]);
      await second.addCookies([{ name: 'cdp_compat_second', value: 'two', url: 'https://compat.invalid/' }]);
      const firstCookies = await first.cookies('https://compat.invalid/');
      const secondCookies = await second.cookies('https://compat.invalid/');
      const firstNames = new Set(firstCookies.map(cookie => cookie.name));
      const secondNames = new Set(secondCookies.map(cookie => cookie.name));
      if (!firstNames.has('cdp_compat_first') || firstNames.has('cdp_compat_second')) {
        throw new Error('The first context did not keep its cookie state isolated.');
      }
      if (!secondNames.has('cdp_compat_second') || secondNames.has('cdp_compat_first')) {
        throw new Error('The second context did not keep its cookie state isolated.');
      }
      return 'Two temporary contexts retained separate synthetic cookies.';
    } finally {
      await second?.close().catch(() => {});
      await first?.close().catch(() => {});
    }
  });
}

async function runEmulation(target, browser, timeoutMs) {
  return recordProbe(target, 'timezone-media', 'Timezone and media emulation', async () => {
    let context;
    try {
      context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
      const observed = await withPage(context, timeoutMs, async page => {
        await page.setContent('<main>Local emulation fixture</main>', { timeout: timeoutMs });
        await page.emulateMedia({ colorScheme: 'dark' });
        return page.evaluate(() => ({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          dark: matchMedia('(prefers-color-scheme: dark)').matches,
        }));
      });
      if (observed.timezone !== 'America/Los_Angeles' || observed.dark !== true) {
        throw new Error(`Observed timezone=${observed.timezone}; dark=${observed.dark}.`);
      }
      return 'Resolved the configured IANA timezone and dark color-scheme media query.';
    } finally {
      await context?.close().catch(() => {});
    }
  });
}

async function runNetworkRoute(target, context, timeoutMs) {
  return recordProbe(target, 'network-route', 'Playwright request routing', () => withPage(context, timeoutMs, async page => {
    const routeUrl = 'https://compat.invalid/__cdp_compat_probe';
    const routeHandler = route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ routed: true, marker: 'local-fixture' }),
    });
    await page.route(routeUrl, routeHandler);
    try {
      await page.setContent('<main>Local routing fixture</main>', { timeout: timeoutMs });
      const response = await page.evaluate(async url => {
        const result = await fetch(url);
        return { ok: result.ok, body: await result.json() };
      }, routeUrl);
      if (!response.ok || response.body.routed !== true || response.body.marker !== 'local-fixture') {
        throw new Error('The synthetic request did not return the route fixture response.');
      }
      return 'Intercepted a reserved .invalid URL and returned a synthetic local response.';
    } finally {
      await page.unroute(routeUrl, routeHandler).catch(() => {});
    }
  }));
}

function notRunChecks(reason) {
  return PROBE_CATALOG.map(probe => ({
    ...probe,
    status: 'not-run',
    durationMs: 0,
    detail: reason,
  }));
}

export async function inspectTarget(target, timeoutMs) {
  const started = performance.now();
  let browser;
  const checks = [];
  let browserVersion = null;
  try {
    browser = await chromium.connectOverCDP(target.endpoint, { timeout: timeoutMs });
    browserVersion = await browser.version().catch(() => null);
    checks.push({
      id: 'connection',
      label: 'CDP connection',
      group: 'Connection',
      status: 'pass',
      durationMs: Math.round(performance.now() - started),
      detail: 'Attached with Playwright connectOverCDP.',
    });
    const defaultContext = browser.contexts()[0];
    if (!defaultContext) {
      checks.push(...notRunChecks('The endpoint exposed no default browser context.'));
    } else {
      checks.push(await runNavigation(target, defaultContext, timeoutMs));
      checks.push(await runLocatorsAndForms(target, defaultContext, timeoutMs));
      checks.push(await runFrame(target, defaultContext, timeoutMs));
      checks.push(await runContextIsolation(target, browser));
      checks.push(await runEmulation(target, browser, timeoutMs));
      checks.push(await runNetworkRoute(target, defaultContext, timeoutMs));
    }
  } catch (error) {
    if (checks.length === 0) {
      checks.push({
        id: 'connection',
        label: 'CDP connection',
        group: 'Connection',
        status: classifyError(error),
        durationMs: Math.round(performance.now() - started),
        detail: cleanError(error, target.endpoint),
      });
      checks.push(...notRunChecks('The CDP connection did not complete.'));
    } else {
      checks.push({
        id: 'probe-runner',
        label: 'Probe runner',
        group: 'Runner',
        status: 'fail',
        durationMs: Math.round(performance.now() - started),
        detail: cleanError(error, target.endpoint),
      });
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  const completedIds = new Set(checks.map(check => check.id));
  for (const probe of PROBE_CATALOG) {
    if (!completedIds.has(probe.id)) {
      checks.push({
        ...probe,
        status: 'not-run',
        durationMs: 0,
        detail: 'An earlier probe stopped this run before this operation started.',
      });
    }
  }

  return {
    name: target.name,
    browserVersion,
    durationMs: Math.round(performance.now() - started),
    checks,
  };
}
