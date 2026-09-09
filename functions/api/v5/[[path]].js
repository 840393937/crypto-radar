// 将 /api/v5/* 请求原样转发到 OKX 公共 API。
// 前端以同源相对路径 /api/v5 调用，彻底消除跨域与 workers.dev 依赖。
//
// 两点踩坑记录（Pages Functions，非 Workers）：
//   1. 必须导出 onRequest / onRequestGet 这类命名导出，
//      写成 Workers 的 export default { fetch() {} } 会得到 0 条路由。
//   2. 本项目的分发约定把 context 对象作为第一个参数传入，
//      真正的 Request 在 ctx.request 上 —— 见 resolveRequest()。

const OKX_BASE = 'https://www.okx.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 兼容 (request, context) 与 (context) 两种调用约定
function resolveRequest(first, second) {
  if (first && typeof first === 'object' && 'request' in first) return first.request;
  return first || (second && second.request) || null;
}

export async function onRequest(first, second) {
  const request = resolveRequest(first, second);
  if (!request) {
    return new Response(
      JSON.stringify({ code: '1', msg: 'proxy error: no request object' }),
      { status: 500, headers: CORS }
    );
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ code: '1', msg: 'method not allowed' }),
      { status: 405, headers: CORS }
    );
  }

  const url = new URL(request.url);
  // 保留 /api/v5/market/... 的完整路径与查询串，原样转发给 OKX
  const targetUrl = `${OKX_BASE}${url.pathname}${url.search}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cf: {
        // 成功响应缓存15秒：多端访问/频繁刷新只会命中边缘一次，是防 429 的主力。
        // 刻意取 15 而非 10：对 429 的保护是单调递增的，15 秒比 10 秒更能摊平请求量。
        cacheTtl: 15,
        cacheEverything: true,
      },
    });
    const data = await res.text();

    // 关键：失败响应（含 429、5xx）绝不能被缓存。
    // 否则一次限流会被缓存 15 秒并共享给所有用户，形成"集体限流"。
    // 用响应头 no-store 覆盖上面的 cf 指令，Cloudflare 以响应头为准。
    const cacheable = res.status >= 200 && res.status < 300;
    const retryAfter = res.headers.get('Retry-After');
    return new Response(data, {
      status: res.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': cacheable ? 'public, max-age=15' : 'no-store',
        ...(cacheable ? {} : retryAfter ? { 'Retry-After': retryAfter } : {}),
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ code: '1', msg: 'proxy error: ' + err.message }),
      { status: 500, headers: CORS }
    );
  }
}
