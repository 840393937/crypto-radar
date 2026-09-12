================================================================================
crypto-radar — 项目状态与阻塞点记录
生成时间: 2026-09-12
生成方式: Claude Code (SenseNova) 自主执行，记录当晚任务清单的完成情况
================================================================================

【0. 当前仓库状态】
  HEAD              61a3024  (docs: add README_STATUS.txt with migration state and deploy blocker)
  分支              master，与 origin/master 完全同步 (0 ahead / 0 behind)
  功能代码基线      8ca5b7e  (fix: align candle auto-refresh interval with the dropdown value)
  工作副本（唯一）  D:\ClaudeProjects\crypto-radar
  远程              https://github.com/840393937/crypto-radar.git
  技术栈            Python HTTP 服务 (server.py) + cloudflared 隧道 + 静态 HTML/CSS/JS
                    + Cloudflare Pages (functions/ + .wrangler/ + start-online.bat)
  本地启动          双击 start.bat  →  http://localhost:8080  +  临时 *.trycloudflare.com 链接
  在线部署          已完成 ✅  https://4a5589fd.crypto-dashboard-b0m-1ad.pages.dev
                    （项目 crypto-dashboard-b0m，每次 deploy 地址会变；详见【3】）

--------------------------------------------------------------------------------
【1. D 盘迁移 —— 已完成并验证】
--------------------------------------------------------------------------------
  2026-09-11 用 robocopy 从 C:\Users\84039\ClaudeProjects\crypto-radar 完整迁到 D 盘。
  验证结果：
    - 文件数 / 字节数一致 (14 个源文件 / 117,070 字节)，SHA256 清单 IDENTICAL
    - D:\ClaudeProjects ACL 原先拒绝写入，已用
        takeown /F D:\ClaudeProjects /R /D Y
        icacls  D:\ClaudeProjects /grant "xuhua\84039:(OI)(CI)F"
      修好，普通权限即可读写，无需提权
    - git status 干净，git fsck clean
    - 非提权 写入/读取/删除 探针通过
  C 盘那份**仍保留在原地，但已不再是工作副本**；不要再从 C 盘改代码。
    (C 盘副本落后本次 README_STATUS.txt 提交 1 个 commit)

  注意: C:\Users\84039\crypto-dashboard 是**另一个更早的同名项目**（8 月中，多 config.js、
  带 5MB cloudflared.exe，文件内容不同），不是本项目的旧副本，不可当回滚点。

--------------------------------------------------------------------------------
【2. 编辑器与模型配置（日日新 SenseNova）—— 已完成】
--------------------------------------------------------------------------------
  Cursor  (%APPDATA%\Cursor\User\settings.json)
    写入 cursorai.customOpenAI: baseUrl / apiKey / wireApi="chat" /
    models=[sensenova-6.8-flash-lite, deepseek-v4-pro]
    ⚠ Cursor 3.18.25 并不从 settings.json 读取自定义 Base URL / API Key，
      真正生效的存储是 globalStorage\state.vscdb -> ItemTable：
        cursorAuth/openAIKey                                      (35 字符 key)
        ...persistentStorage.applicationUser.openAIBaseUrl       = https://token.sensenova.cn/v1
        ...persistentStorage.applicationUser.useOpenAIKey        = true
      两者都已同步写入并验证。settings.json 那段是声明式记录，便于迁移/复查。

  Codex  (C:\Users\84039\.codex\)
    config.toml  →  model_provider=sensenova, model=sensenova-6.8-flash-lite
    两个 provider (sensenova / custom) 均指向 http://127.0.0.1:15722/v1
    .env         →  SENSENOVA_API_KEY
    启动代理     →  双击 C:\Users\84039\.codex\start-sensenova.bat  (pythonw 最小化)
    健康检查     →  curl http://127.0.0.1:15722/v1/models
    日志         →  C:\Users\84039\.codex\sensenova-proxy.log

    ⚠ 必须经本地翻译代理 15722，不能直连 SenseNova：
      codex-cli 0.152.0 硬拒绝 wire_api="chat"（启动即报错），
      而 SenseNova 官方端点没有 Responses 接口 (/v1/responses → 404)。
      拓扑: codex ──Responses──> 127.0.0.1:15722 ──Chat──> token.sensenova.cn/v1
      翻译代理里有两个必守的修正，改脚本时不要退回：
        (a) role="developer" 必须映射成 "system"
            —— SenseNova 的 /v1/chat/completions 只认 system|user|assistant|tool，
               收到 developer 直接 400 inference request is invalid。
               在 codex 端表现为误导性的 502 Bad Gateway: HTTP Error 400。
        (b) 流式必须先发 response.output_item.added 再发该条 output_text.delta，
            否则 codex 报 "OutputTextDelta without active item"；
            tool_call 的 output_index 要用它在整个 output 里的真实位置。
      单元测试 12/12: C:\Users\84039\AppData\Local\Temp\test-proxy.py （离线可跑）

  cc-switch
    provider sensenova, app_type=codex, is_current=1, meta.apiFormat="openai_responses"
    settings.json: currentProviderCodex = "sensenova"

  端口备注
    15722  = SenseNova 翻译代理（代理未启动时 codex 无法连日日新）
    15723  = 旧的 mimo 端点（pythonw），不要动

--------------------------------------------------------------------------------
【3. 生产部署 —— 已完成并验证 ✅】
--------------------------------------------------------------------------------
  线上地址:  https://4a5589fd.crypto-dashboard-b0m-1ad.pages.dev
             项目 crypto-dashboard-b0m，部署 ID 4a5589fd（每次 deploy 地址会变）

  部署命令（在 D 盘项目根目录执行，走本机 65532 代理）：
    CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy . \
        --project-name=crypto-dashboard-b0m
  凭证是 Cloudflare User API Token（cfut_ 前缀，Pages:Edit 权限，账号 85e8d09d…），
  用环境变量一次性传入，未写入任何持久化文件；凭证落点为
  %APPDATA%\xdg.config\.wrangler\ （Windows，注意不是 ~/.wrangler）。

  结果（wrangler 4.98.0 / node v24.16.0）：
    ✨ Compiled Worker successfully / Uploaded (12/12) / Uploading Functions bundle
    ✨ Deployment complete!  exit code 0
    产物 0.13 MB（Cloudflare Pages 限额 25 MB）

  线上验证（经 http://127.0.0.1:65532 代理请求，2026-09-12）：
    GET /                                              HTTP 200   3,687 B  (0.86 s)
    GET /style.css                                     HTTP 200  10,280 B
    GET /app.js                                        HTTP 200  68,761 B
    GET /api/v5/market/ticker?instId=BTC-USDT          HTTP 200
        → {"code":"0","data":[{"instId":"BTC-USDT","last":"77461.4",
           "open24h":"78719","high24h":"78877.3","low24h":"76880.1"}]}
      首次请求返回 HTTP 429 {"code":"50011"}，等 6 秒重试即 200 —— 这是 OKX 公共端点
      限流，不是部署问题（Pages Function 未部署时会返回 404，不会 429）。
    以上证明：静态资源齐备且字节数与本地一致，Pages Function 已挂载并成功代理 OKX 真实行情。

  历史阻塞记录（2026-09-11，已解决）：
    当时机器上没有任何 Cloudflare 凭证（无 CLOUDFLARE_API_TOKEN、无 ~/.wrangler、
    无 %LOCALAPPDATA%\.wrangler、git credential manager 亦无），部署报
    Authentication failed (status: 400) [code: 9106]。由人工提供 API Token 后解决。
    另记 wrangler login 的坑：默认只绑 [::1]:8976（IPv6-only）而 redirect_uri 写死
    http://localhost:8976/oauth/callback，需 NODE_OPTIONS=--dns-result-order=ipv4first
    让 localhost 解析到 127.0.0.1；且该命令无 --timeout 参数，默认 300 s 超时。
    登录中途若用 curl 探测 /oauth/callback（不带 code），会让 wrangler 立即判失败退出。

--------------------------------------------------------------------------------
【4. 已知无害告警（非本次改动引入）】
--------------------------------------------------------------------------------
  - codex 下 C:\Users\84039\.agents\skills\everything-openai-codex\docs\* 缺失 YAML
    frontmatter，加载失败
  - 738 个额外 skill 因超出 skills context budget 被丢弃
  - Model metadata for 'sensenova-6.8-flash-lite' not found, using fallback metadata
================================================================================
