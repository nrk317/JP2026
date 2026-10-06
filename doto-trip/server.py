"""Doto trip shared workspace. Python 3.10+, standard library only."""
import argparse
import json
import os
import secrets
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('TRIP_DATA_DIR', str(ROOT / 'data')))
DATA.mkdir(exist_ok=True)
KEYFILE = DATA / 'access-key.txt'
if not KEYFILE.exists():
    KEYFILE.write_text(secrets.token_urlsafe(32), encoding='utf-8')
KEY = os.environ.get('TRIP_ACCESS_KEY') or KEYFILE.read_text(encoding='utf-8').strip()
DB = DATA / 'trip.sqlite3'
INITIAL = {'settings': {'title': '道東冬日自駕', 'start': '', 'end': '', 'members': '', 'budget': 0, 'rate': 0.22, 'notes': ''}, 'days': [], 'bookings': [], 'places': [], 'shopping': [], 'packing': [], 'tasks': [], 'expenses': [], 'contacts': []}
with sqlite3.connect(DB) as conn:
    conn.execute('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL)')
    conn.execute('INSERT OR IGNORE INTO workspace VALUES (1, 0, ?)', (json.dumps(INITIAL, ensure_ascii=False),))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'public'), **kwargs)

    def log_message(self, fmt, *args):
        # Request headers and sharing keys are never logged.
        pass

    def reply(self, status, value):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        return secrets.compare_digest(self.headers.get('X-Trip-Key', ''), KEY)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/trip':
            if not self.authorized():
                return self.reply(401, {'error': '請使用完整的旅行分享連結開啟。'})
            with sqlite3.connect(DB) as conn:
                revision, body = conn.execute('SELECT revision, body FROM workspace WHERE id=1').fetchone()
            return self.reply(200, {'revision': revision, 'state': json.loads(body)})
        if path not in ('/', '/index.html', '/app.js', '/style.css', '/favicon.svg'):
            return self.reply(404, {'error': 'Not found'})
        super().do_GET()

    def do_PUT(self):
        if urlsplit(self.path).path != '/api/trip':
            return self.reply(404, {'error': 'Not found'})
        if not self.authorized():
            return self.reply(401, {'error': '分享連結驗證失敗。'})
        # Reject browser cross-origin writes; no permissive CORS headers are sent.
        origin = self.headers.get('Origin')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            return self.reply(403, {'error': 'Origin rejected'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 2_000_000:
                return self.reply(413, {'error': '資料過大，請縮短備註。'})
            value = json.loads(self.rfile.read(size))
            state = value['state']
            if not isinstance(state, dict) or set(state) != set(INITIAL):
                raise ValueError('Invalid state')
            if not isinstance(state['settings'], dict) or any(not isinstance(state[k], list) for k in INITIAL if k != 'settings'):
                raise ValueError('Invalid fields')
            body = json.dumps(state, ensure_ascii=False)
            with sqlite3.connect(DB, timeout=10) as conn:
                cursor = conn.execute('UPDATE workspace SET body=?, revision=revision+1 WHERE id=1 AND revision=?', (body, value['revision']))
                if cursor.rowcount != 1:
                    return self.reply(409, {'error': '旅伴已更新資料。請先下載你的草稿，再載入最新版本。'})
                revision = conn.execute('SELECT revision FROM workspace WHERE id=1').fetchone()[0]
            return self.reply(200, {'revision': revision})
        except (KeyError, ValueError, TypeError, json.JSONDecodeError):
            return self.reply(400, {'error': '資料格式不正確。'})
        except sqlite3.Error:
            return self.reply(503, {'error': '暫時無法儲存；你的修改仍保留在畫面，請重試。'})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default=os.environ.get('TRIP_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '8765')))
    args = parser.parse_args()
    if args.host == '127.0.0.1':
        print(f'Open http://localhost:{args.port}/#key={KEY}', flush=True)
    else:
        print(f'Trip server listening on port {args.port}; use the configured sharing key.', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
