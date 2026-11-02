# Playwright CDP Compat

[English](README.md)

`connectOverCDP()` 成功，只说明 Playwright 连上了浏览器；它没有告诉你，Agent 或测试真正依赖的操作是否可用。

Playwright CDP Compat 用同一组本地夹具，检查一个或多个 Chromium 系 CDP 端点，并生成终端摘要、JSON 和可独立打开的 HTML 报告。它是一份有限范围的能力快照，不是兼容性认证。

**预览状态：**当前公开的是供检查和本地试用的源码，尚未连接 Chrome 或 Lightpanda 端点运行，因此没有附带兼容性实测结果。

## 会检查什么

- 使用本地 `data:` 夹具导航
- 可访问角色与标签定位、输入框填写、`selectOption()`
- 在 `srcdoc` iframe 中使用 `frameLocator()` 操作
- 临时浏览器上下文之间的 Cookie 隔离
- IANA 时区与深色配色模拟
- 将请求路由到保留的 `.invalid` 域名

每项结果标为 `PASS`、`FAIL`、`UNSUPPORTED` 或 `NOT RUN`，附耗时和简短观察。夹具不打开生产网页、不登录、不请求外部网站。报告会省略端点地址，并清理捕获错误中的 URL 与凭据。

## 快速开始

需要 Node.js 20+，以及一个已启动并开放 CDP 的 Chromium 系浏览器。

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

比较两个端点时，分别启动浏览器并增加一个目标：

```sh
export LIGHTPANDA_CDP_URL="ws://127.0.0.1:9222"
node src/cli.mjs \
  --target chrome=@env:CDP_URL \
  --target lightpanda=@env:LIGHTPANDA_CDP_URL \
  --html reports/compare.html
```

工具连接端点，完成探测后断开连接。为此启动本地浏览器时，建议使用一次性浏览器配置目录。远程端点含凭据时，用环境变量传入；不要把令牌写进仓库文件。

## 如何看结果

- `PASS`：本次运行中，该操作按夹具预期完成。
- `FAIL`：操作结果没有达到夹具的预期。
- `UNSUPPORTED`：端点明确返回了“不支持”或“未知方法”等错误。
- `NOT RUN`：连接等前置条件不可用，因此没有执行该项。

某项通过不能证明完整支持 Playwright Test、负载下稳定，或支持未列出的 API。Playwright 官方文档也说明 `connectOverCDP()` 的保真度低于 Playwright 自身协议连接，详见 [API 文档](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)。

## 参数

```text
--target name=endpoint       可重复；名称可用字母、数字、点、_ 或 -
--target name=@env:VARIABLE  从环境变量读取 CDP 端点
--json file                  写出 JSON 报告
--html file                  写出单文件 HTML 报告
--timeout-ms number          单项超时，500–120000 毫秒，默认 8000
--fail-on-unsupported        任一操作不支持时返回退出码 1
--help                       显示所有参数
```

没有探测失败时退出码为 `0`；有失败项（或启用严格的不支持判定）为 `1`；命令参数错误为 `2`。

## 范围与反馈

这个早期版本覆盖一小组可观察操作，不运行 Playwright Test runner，不认证浏览器，不覆盖所有 Playwright API，也不提供完整 Chromium 基线。功能列表参考了 [Lightpanda 的 Playwright/CDP 兼容讨论](https://github.com/lightpanda-io/browser/issues/3076)；本项目与 Lightpanda 无隶属或背书关系。

如果探测发现实际不一致，欢迎提交 Issue，附浏览器及版本、Playwright 版本、探测名称和脱敏报告。分享前请删除端点详情、凭据和私人浏览器数据。

## 许可

MIT，见 [LICENSE](LICENSE)。
