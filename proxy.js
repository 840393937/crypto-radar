const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8081;
const TARGET_APIS = {
    'binance': 'https://api.binance.com',
    'okx': 'https://www.okx.com',
    'coingecko': 'https://api.coingecko.com'
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.search || '';

    // 解析目标API
    let targetApi = 'binance';
    let targetPath = path;

    if (path.startsWith('/binance/')) {
        targetApi = 'binance';
        targetPath = path.replace('/binance', '');
    } else if (path.startsWith('/okx/')) {
        targetApi = 'okx';
        targetPath = path.replace('/okx', '');
    } else if (path.startsWith('/coingecko/')) {
        targetApi = 'coingecko';
        targetPath = path.replace('/coingecko', '');
    }

    const targetUrl = TARGET_APIS[targetApi] + targetPath + query;

    console.log(`Proxying: ${targetUrl}`);

    const protocol = targetUrl.startsWith('https') ? https : http;

    const proxyReq = protocol.get(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
            'Content-Type': proxyRes.headers['content-type'] || 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    });

    proxyReq.setTimeout(15000, () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Timeout' }));
    });
});

server.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log('Usage:');
    console.log(`  Binance: http://localhost:${PORT}/binance/api/v3/ticker/24hr`);
    console.log(`  OKX: http://localhost:${PORT}/okx/api/v5/market/tickers?instType=SPOT`);
    console.log(`  CoinGecko: http://localhost:${PORT}/coingecko/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`);
});