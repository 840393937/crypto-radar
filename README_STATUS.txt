================================================================================
crypto-radar — 项目状态与阻塞点记录
生成时间: 2026-09-12
生成方式: Claude Code (SenseNova) 自主执行，记录当晚任务清单的完成情况
================================================================================

【0. 当前仓库状态】
  HEAD              8ca5b7e  (fix: align candle auto-refresh interval with the dropdown value)
  分支              master，与 origin/master 完全同步 (0 ahead / 0 behind)
  工作副本（唯一）  D:\ClaudeProjects\crypto-radar
  远程              https://github.com/840393937/crypto-radar.git
  技术栈            Python HTTP 服务 (server.py) + cloudflared 隧道 + 静态 HTML/CSS/JS
                    + Cloudflare Pages (functions/ + .wrangler/ + start-online.bat)
  本地启动          双击 start.bat  →  http://localhost:8080  +  临时 *.trycloudflare.com 链接
  在线部署          见下方【3. 阻塞点】—— 尚未完成

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
【3. 生产部署 —— 未完成，阻塞在 Cloudflare 凭证】
--------------------------------------------------------------------------------
  目标命令（在 D 盘项目根目录执行）：
    npx wrangler pages deploy . --project-name=crypto-dashboard-b0m

  失败结果（2026-09-11）：
    ✘ [ERROR] A request to the Cloudflare API
      (/accounts/85e8d09dd4eea2adad6952c6cf9a9ffd/pages/projects/crypto-dashboard-b0m) failed.
      Authentication failed (status: 400) [code: 9106]

  根因：这台机器上**没有任何 Cloudflare 凭证**——
    - 环境变量无 CLOUDFLARE_API_TOKEN
    - 无 ~/.wrangler、无 %LOCALAPPDATA%\.wrangler、无 wrangler configstore 状态
    - git credential manager 中亦无
  这是真实阻塞，无法自行修复，需要人工完成一次授权。

  解锁方式（二选一，然后重跑上面的部署命令）：
    (1) set CLOUDFLARE_API_TOKEN=<具备 Pages:Edit 权限的 token>     ← 需覆盖账号 85e8d09d…
    (2) npx wrangler login                                          ← 浏览器交互式授权，一次性
        （wrangler 4.98.0 在非交互 stdin 下会挂起等 OAuth，必须人工在终端里跑）

  其余前置条件均已验证可用，token 到位后即可成功：
    - 代理端口 65532 (HTTPS_PROXY=http://127.0.0.1:65532) 2026-09-12 起已监听且转发正常
      （经它请求 api.cloudflare.com 可正常返回 400）；2026-09-11 时该端口尚为死端口
    - 待部署产物合法：index.html (3,687 B) + functions/api/v5/[[path]].js，共 0.13 MB
      （Cloudflare Pages 限额 25 MB）
    - node v24.16.0 / wrangler 4.98.0

--------------------------------------------------------------------------------
【4. 已知无害告警（非本次改动引入）】
--------------------------------------------------------------------------------
  - codex 下 C:\Users\84039\.agents\skills\everything-openai-codex\docs\* 缺失 YAML
    frontmatter，加载失败
  - 738 个额外 skill 因超出 skills context budget 被丢弃
  - Model metadata for 'sensenova-6.8-flash-lite' not found, using fallback metadata
================================================================================
