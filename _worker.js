// Whole-app Pages Function。
// /api/v5/* -> 原样转发到 OKX 公共 API（同源，免跨域、免 workers.dev 依赖）
// 其它请求   -> getAssetFromKV 交回 Pages 静态资源

import { getAssetFromKV } from '@cloudflare/pages-function';

const OKX_BASE = 'https://www.okx.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/v5' || url.pathname.startsWith('/api/v5/')) {
      return proxy(request, url);
    }

    const asset = await getAssetFromKV({ request });
    return asset ?? new Response('Not found', { status: 404 });
  },
};

async function proxy(request, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ code: '1', msg: 'method not allowed' }),
      { status: 405, headers: CORS }
    );
  }

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
