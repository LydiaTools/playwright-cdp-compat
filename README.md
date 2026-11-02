# Playwright CDP Compat

[简体中文](README.zh-CN.md)

`connectOverCDP()` tells you a browser session attached. It does not tell you whether the operations your agent or test suite depends on will work.

Playwright CDP Compat runs the same small, local fixture probes against one or more Chromium-based CDP endpoints and turns the observed results into a terminal summary, JSON, and a self-contained HTML report. It is a focused capability snapshot—not a compatibility certificate.

**Preview status:** the source is published for inspection and local trials. This preview has not yet been run against a Chrome or Lightpanda endpoint, so it includes no captured compatibility results.

## What it checks

- Navigation to a local `data:` fixture
- Accessible role and label locators, input fill, and `selectOption()`
- `frameLocator()` interaction with a `srcdoc` iframe
- Cookie separation between temporary browser contexts
- IANA timezone and dark color-scheme emulation
- Playwright request routing to a reserved `.invalid` URL

Each operation is reported as `PASS`, `FAIL`, `UNSUPPORTED`, or `NOT RUN`, with elapsed time and a short observation. The fixture uses no production pages, logins, or external sites. Endpoint URLs and credentials are omitted from reports and redacted from captured errors.

## Quick start

Requirements: Node.js 20+ and a running Chromium-based browser that exposes CDP.

```sh
git clone https://github.com/LydiaTools/playwright-cdp-compat.git
cd playwright-cdp-compat
npm install

export CDP_URL="http://127.0.0.1:9222"
mkdir -p reports
node src/cli.mjs \
  --target chrome=@env:CDP_URL \
  --json reports/chrome.json \
  --html reports/chrome.html
```

To compare two endpoints, start each browser and add another target:

```sh
export LIGHTPANDA_CDP_URL="ws://127.0.0.1:9222"
node src/cli.mjs \
  --target chrome=@env:CDP_URL \
  --target lightpanda=@env:LIGHTPANDA_CDP_URL \
  --html reports/compare.html
```

The process connects to the endpoint and disconnects after the probes. Use a disposable browser profile when starting a local browser for this purpose. For remote endpoints with credentials, pass them through environment variables; do not paste tokens into a committed file.

## Read results carefully

- `PASS` means the named operation completed against this fixture in this run.
- `FAIL` means the operation did not match the fixture's expected result.
- `UNSUPPORTED` is used when the endpoint reports an explicit unsupported or unknown-method condition.
- `NOT RUN` means a prerequisite such as establishing the CDP connection was unavailable.

A pass does not establish general Playwright Test compatibility, reliability under load, or support for unlisted APIs. A `connectOverCDP()` connection also has lower fidelity than Playwright's own protocol connection; see the [Playwright API documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp).

## Options

```text
--target name=endpoint       Repeatable; name uses letters, numbers, dot, _ or -
--target name=@env:VARIABLE  Read a CDP endpoint from an environment variable
--json file                  Write a JSON report
--html file                  Write a self-contained HTML report
--timeout-ms number          Per-operation timeout, 500–120000 ms (default 8000)
--fail-on-unsupported        Return exit code 1 if any operation is unsupported
--help                       Show all options
```

Exit code is `0` when no probe failed, `1` when a probe failed (or unsupported behavior was made fatal), and `2` for invalid command-line input.

## Scope and next steps

This first preview covers a small set of observable operations. It does not run the Playwright Test runner, certify a browser, cover every Playwright API, or compare against a complete Chromium baseline. The feature list is informed by the open [Lightpanda Playwright/CDP compatibility discussion](https://github.com/lightpanda-io/browser/issues/3076); it is not affiliated with or endorsed by Lightpanda.

If a probe reveals a real mismatch, open an issue with the browser/version, Playwright version, probe name, and a sanitized report. Remove endpoint details, credentials, and private browser data before sharing.

## License

MIT. See [LICENSE](LICENSE).
