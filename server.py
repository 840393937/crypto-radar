import http.server
import socketserver
import json
import urllib.request
import os

PORT = 8080
OKX_API = "https://www.okx.com/api/v5"

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/'):
            self.proxy_okx()
        else:
            super().do_GET()

    def proxy_okx(self):
        api_path = self.path[4:]
        target = OKX_API + api_path
        try:
            req = urllib.request.Request(target, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, timeout=20)
            data = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            err = json.dumps({"code": "-1", "msg": str(e)}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(err)

    def log_message(self, format, *args):
        pass

class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Server: http://localhost:{PORT}", flush=True)
ThreadedServer(('0.0.0.0', PORT), Handler).serve_forever()
