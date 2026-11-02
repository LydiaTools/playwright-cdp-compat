const STATUS_ORDER = ['pass', 'fail', 'unsupported', 'not-run'];
const STATUS_LABEL = {
  pass: 'PASS',
  fail: 'FAIL',
  unsupported: 'UNSUPPORTED',
  'not-run': 'NOT RUN',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function summarize(targets) {
  const counts = Object.fromEntries(STATUS_ORDER.map(status => [status, 0]));
  for (const target of targets) {
    for (const check of target.checks) counts[check.status] = (counts[check.status] ?? 0) + 1;
  }
  return counts;
}

export function renderTerminal(report) {
  const lines = [
    `Playwright CDP Compat  v${report.tool.version}`,
    `Observed ${report.targets.length} target${report.targets.length === 1 ? '' : 's'} · ${report.generatedAt}`,
    '',
  ];
  for (const target of report.targets) {
    lines.push(`${target.name}${target.browserVersion ? ` · ${target.browserVersion}` : ''}`);
    for (const check of target.checks) {
      lines.push(`  ${STATUS_LABEL[check.status].padEnd(11)} ${check.label} (${check.durationMs} ms)`);
      if (check.status !== 'pass' && check.detail) lines.push(`              ${check.detail}`);
    }
    lines.push('');
  }
  const counts = summarize(report.targets);
  lines.push(`PASS ${counts.pass}  FAIL ${counts.fail}  UNSUPPORTED ${counts.unsupported}  NOT RUN ${counts['not-run']}`);
  return lines.join('\n');
}

function renderBar(counts) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0) || 1;
  return STATUS_ORDER.map(status => {
    const width = (counts[status] / total) * 100;
    return `<span class="bar-segment ${status}" style="width:${width.toFixed(2)}%" title="${STATUS_LABEL[status]} ${counts[status]}"></span>`;
  }).join('');
}

function renderTarget(target) {
  const rows = target.checks.map(check => `
      <tr>
        <td data-label="Capability"><span class="group">${escapeHtml(check.group ?? 'Connection')}</span><strong>${escapeHtml(check.label)}</strong></td>
        <td data-label="Result"><span class="status ${escapeHtml(check.status)}">${STATUS_LABEL[check.status]}</span></td>
        <td data-label="Observed">${escapeHtml(check.detail)}</td>
        <td data-label="Time" class="duration">${check.durationMs} ms</td>
      </tr>`).join('');
  const version = target.browserVersion ? ` · ${escapeHtml(target.browserVersion)}` : '';
  return `
    <section class="target-section" aria-labelledby="target-${escapeHtml(target.name)}">
      <div class="target-heading"><div><p class="eyebrow">TARGET</p><h2 id="target-${escapeHtml(target.name)}">${escapeHtml(target.name)}<span>${version}</span></h2></div><p class="target-time">${target.durationMs} ms total</p></div>
      <div class="table-wrap"><table><caption class="sr-only">Capability observations for ${escapeHtml(target.name)}</caption><thead><tr><th scope="col">Capability</th><th scope="col">Result</th><th scope="col">Observed behavior</th><th scope="col">Time</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
}

export function renderHtml(report) {
  const counts = summarize(report.targets);
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const observed = counts.pass + counts.fail + counts.unsupported;
  const targets = report.targets.map(renderTarget).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="A local observation report for selected Playwright operations over CDP.">
  <title>CDP capability report · ${escapeHtml(report.generatedAt)}</title>
  <style>
    :root{color-scheme:light;--ink:#18343b;--muted:#5e7377;--paper:#f4f2ec;--line:#d7ddd7;--pass:#157e72;--fail:#a34336;--unsupported:#a86b13;--quiet:#879598;--white:#fffefa;--navy:#102a33}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .masthead{background:var(--navy);color:#f4f3ec;padding:clamp(28px,6vw,68px) max(22px,calc((100vw - 1120px)/2)) 32px}
    .masthead-inner{max-width:1120px;margin:0 auto}.eyebrow{margin:0 0 8px;color:#85d5c8;font-size:11px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:0;max-width:760px;font-size:clamp(32px,6vw,58px);letter-spacing:-.045em;line-height:1.03;font-weight:670}.lede{max-width:720px;margin:16px 0 0;color:#c4d3d1;font-size:16px}
    .stamp{display:flex;gap:14px;flex-wrap:wrap;margin-top:24px;color:#adc0be;font-size:12px}.stamp span+span:before{content:"/";margin-right:14px;color:#68807f}
    main{max-width:1120px;margin:0 auto;padding:30px 22px 72px}.overview{display:grid;grid-template-columns:minmax(220px,1.1fr) minmax(0,2fr);gap:26px;align-items:center;padding:23px 0 27px;border-bottom:1px solid var(--line)}
    .ratio{font-size:clamp(32px,5vw,48px);font-variant-numeric:tabular-nums;line-height:1;font-weight:680;letter-spacing:-.05em}.ratio small{font-size:14px;letter-spacing:0;color:var(--muted);font-weight:500}.summary-text{margin:10px 0 0;color:var(--muted);font-size:13px}.bar{height:10px;display:flex;overflow:hidden;border-radius:99px;background:#e4e7e2}.bar-segment{height:100%;min-width:0}.bar-segment.pass{background:var(--pass)}.bar-segment.fail{background:var(--fail)}.bar-segment.unsupported{background:#dfa944}.bar-segment.not-run{background:#d3dad8}
    .legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px}.legend-item{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px}.dot{width:8px;height:8px;border-radius:50%}.dot.pass{background:var(--pass)}.dot.fail{background:var(--fail)}.dot.unsupported{background:#dfa944}.dot.not-run{background:#aab5b4}
    .scope-note{margin:24px 0 34px;padding:12px 15px;border-left:3px solid #7bb9af;background:#e9eee8;color:#435b5d;font-size:13px}.target-section{margin:0 0 38px}.target-heading{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:12px}.target-heading h2{margin:0;font-size:25px;letter-spacing:-.03em}.target-heading h2 span{font-size:13px;color:var(--muted);font-weight:450;letter-spacing:0}.target-time{margin:0;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
    .table-wrap{overflow-x:auto;background:var(--white);border:1px solid var(--line)}table{width:100%;border-collapse:collapse;text-align:left}thead{background:#e9eeea;color:#576d70;font-size:10px;letter-spacing:.1em;text-transform:uppercase}th,td{padding:13px 15px;border-bottom:1px solid #e5e8e2;vertical-align:top}th{font-weight:700}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#faf9f4}td strong{display:block;font-size:13px;font-weight:620}.group{display:block;margin-bottom:3px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em}.status{display:inline-block;padding:3px 7px;border:1px solid currentColor;border-radius:2px;font-size:10px;font-weight:750;letter-spacing:.06em;white-space:nowrap}.status.pass{color:var(--pass)}.status.fail{color:var(--fail)}.status.unsupported{color:var(--unsupported)}.status.not-run{color:var(--quiet)}td[data-label="Observed"]{min-width:280px;color:#42595d;font-size:12px}.duration{white-space:nowrap;color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
    footer{max-width:1120px;margin:0 auto;padding:0 22px 32px;color:var(--muted);font-size:11px}.footer-rule{height:1px;margin-bottom:14px;background:var(--line)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:720px){main{padding-top:20px}.overview{grid-template-columns:1fr;gap:18px}.target-heading h2{font-size:21px}.table-wrap{overflow:visible;background:transparent;border:0}table,tbody{display:block}thead{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}tbody tr{display:grid;grid-template-columns:1fr auto;gap:4px 12px;margin:0 0 10px;padding:12px;background:var(--white);border:1px solid var(--line)}td{display:block;padding:0;border:0}td[data-label="Capability"]{grid-column:1;grid-row:1}td[data-label="Result"]{grid-column:2;grid-row:1;align-self:start}td[data-label="Observed"]{grid-column:1/-1;min-width:0;padding-top:5px}td[data-label="Time"]{grid-column:1/-1;text-align:right;font-size:10px}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
  </style>
</head>
<body>
  <header class="masthead"><div class="masthead-inner"><p class="eyebrow">Playwright over CDP · field report</p><h1>What did this browser actually do?</h1><p class="lede">A small set of repeatable operations, observed through one CDP connection. This report describes this run; it is not a compatibility certificate.</p><div class="stamp"><span>Generated ${escapeHtml(report.generatedAt)}</span><span>Probe ${escapeHtml(report.tool.version)}</span><span>${report.targets.length} target${report.targets.length === 1 ? '' : 's'}</span></div></div></header>
  <main>
    <section class="overview" aria-label="Run summary"><div><div class="ratio">${observed}<small> / ${total} observed</small></div><p class="summary-text">PASS ${counts.pass} · FAIL ${counts.fail} · UNSUPPORTED ${counts.unsupported} · NOT RUN ${counts['not-run']}</p></div><div><div class="bar" role="img" aria-label="${counts.pass} passed, ${counts.fail} failed, ${counts.unsupported} unsupported, ${counts['not-run']} not run">${renderBar(counts)}</div><div class="legend">${STATUS_ORDER.map(status => `<span class="legend-item"><i class="dot ${status}"></i>${STATUS_LABEL[status]} ${counts[status]}</span>`).join('')}</div></div></section>
    <p class="scope-note">Only the listed operations ran. A pass does not imply broader Playwright compatibility; unsupported or failed behavior should be interpreted against your own workload.</p>
    ${targets}
  </main>
  <footer><div class="footer-rule"></div>Generated locally by Playwright CDP Compat. Endpoint URLs and credentials are omitted from this report.</footer>
</body>
</html>`;
}
