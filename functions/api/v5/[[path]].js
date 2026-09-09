// 将 /api/v5/* 请求原样转发到 OKX 公共 API。
// 前端以同源相对路径 /api/v5 调用，彻底消除跨域与 workers.dev 依赖。
//
// 注意：Pages Functions 必须导出 onRequest / onRequestGet 这类命名导出，
// 而不是 Workers 的 export default { fetch() {} } —— 否则 0 条路由。

const OKX_BASE = 'https://www.okx.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(request) {
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
        cacheTtl: 15, // 缓存15秒，解决限流和延迟
        cacheEverything: true,
      },
    });
    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ code: '1', msg: 'proxy error: ' + err.message }),
      { status: 500, headers: CORS }
    );
  }
}
