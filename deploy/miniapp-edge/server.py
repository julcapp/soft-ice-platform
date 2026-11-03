#!/usr/bin/env python3
import json
import mimetypes
import os
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("PORT", "8780"))
HOST = os.environ.get("HOST", "127.0.0.1")
STATIC_ROOT = Path(os.environ.get("MINIAPP_STATIC_ROOT", str(Path(__file__).resolve().parent / "dist"))).resolve()
CORE_BASE = os.environ.get("MINIAPP_CORE_API_BASE", "http://127.0.0.1:8800").rstrip("/")
GATEWAY_BASE = os.environ.get("MINIAPP_GATEWAY_API_BASE", "http://127.0.0.1:8801").rstrip("/")
GATEWAY_DIR = Path(os.environ.get("MINIAPP_GATEWAY_DIR", "/home/julcapp/soft-ice-worktrees/max-miniapp-gateway/backend"))
GATEWAY_ENV_FILE = Path(os.environ.get("MINIAPP_GATEWAY_ENV_FILE", "/etc/softice/display-backend.env"))
GATEWAY_LOG = Path(os.environ.get("MINIAPP_GATEWAY_LOG", "/home/julcapp/softice-logs/miniapp-gateway.log"))

gateway_process = None
stopping = threading.Event()


def load_env_file(path):
    result = {}
    if not path.is_file():
        return result
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        result[key.strip()] = value
    return result


def gateway_environment():
    env = os.environ.copy()
    env.update(load_env_file(GATEWAY_ENV_FILE))
    env.update({
        "PORT": "8801",
        "HOST": "127.0.0.1",
        "NODE_ENV": os.environ.get("MINIAPP_GATEWAY_NODE_ENV", "development"),
        "BOT_WEBHOOKS_ENABLED": "true",
        "BOT_MINI_APP_URL": "https://miniapp.utimoshi.ru",
        "MINI_APP_URL": "https://miniapp.utimoshi.ru",
        "MAX_BOT_USERNAME": "id7017438363_bot",
    })
    return env


def start_gateway():
    global gateway_process
    GATEWAY_LOG.parent.mkdir(parents=True, exist_ok=True)
    log = open(GATEWAY_LOG, "ab", buffering=0)
    gateway_process = subprocess.Popen(
        ["/usr/bin/node", "src/miniappGateway.js"],
        cwd=str(GATEWAY_DIR),
        env=gateway_environment(),
        stdout=log,
        stderr=subprocess.STDOUT,
    )


def watch_gateway():
    while not stopping.is_set():
        proc = gateway_process
        if proc is None:
            start_gateway()
        elif proc.poll() is not None and not stopping.is_set():
            time.sleep(2)
            start_gateway()
        time.sleep(1)


def target_base(path):
    if path == "/api/webhooks/max":
        return GATEWAY_BASE
    if path.startswith("/api/v1/auth/max-mini-app/"):
        return GATEWAY_BASE
    if path.startswith("/api/v1/catalog/"):
        return GATEWAY_BASE
    if path.startswith("/api/"):
        return CORE_BASE
    return None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self): self.handle_request()
    def do_HEAD(self): self.handle_request(head_only=True)
    def do_POST(self): self.handle_request()
    def do_PUT(self): self.handle_request()
    def do_PATCH(self): self.handle_request()
    def do_DELETE(self): self.handle_request()
    def do_OPTIONS(self): self.handle_request()

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def handle_request(self, head_only=False):
        parsed = urllib.parse.urlsplit(self.path)
        base = target_base(parsed.path)
        if base:
            return self.proxy(base, head_only=head_only)
        if self.command not in ("GET", "HEAD"):
            return self.json_error(405, "METHOD_NOT_ALLOWED")
        return self.serve_static(parsed.path, head_only=head_only)

    def proxy(self, base, head_only=False):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        target = base + self.path
        headers = {}
        excluded = {"host", "content-length", "connection", "transfer-encoding"}
        for key, value in self.headers.items():
            if key.lower() not in excluded:
                headers[key] = value
        headers["Host"] = urllib.parse.urlsplit(base).netloc
        request = urllib.request.Request(target, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read()
                self.send_response(response.status)
                self.copy_response_headers(response.headers, len(payload))
                self.end_headers()
                if not head_only and self.command != "HEAD":
                    self.wfile.write(payload)
        except urllib.error.HTTPError as error:
            payload = error.read()
            self.send_response(error.code)
            self.copy_response_headers(error.headers, len(payload))
            self.end_headers()
            if not head_only and self.command != "HEAD":
                self.wfile.write(payload)
        except Exception as error:
            self.json_error(502, "UPSTREAM_UNAVAILABLE", str(error))

    def copy_response_headers(self, source, content_length):
        excluded = {"connection", "transfer-encoding", "content-length"}
        for key, value in source.items():
            if key.lower() not in excluded:
                self.send_header(key, value)
        self.send_header("Content-Length", str(content_length))

    def serve_static(self, path, head_only=False):
        relative = urllib.parse.unquote(path).lstrip("/")
        candidate = (STATIC_ROOT / relative).resolve() if relative else (STATIC_ROOT / "index.html").resolve()
        try:
            candidate.relative_to(STATIC_ROOT)
        except ValueError:
            return self.json_error(403, "FORBIDDEN")
        if not candidate.is_file():
            candidate = (STATIC_ROOT / "index.html").resolve()
        if not candidate.is_file():
            return self.json_error(503, "MINIAPP_BUILD_MISSING")
        payload = candidate.read_bytes()
        content_type, _ = mimetypes.guess_type(candidate.name)
        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        if candidate.name == "index.html":
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        elif "/assets/" in str(candidate).replace("\\", "/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if not head_only:
            self.wfile.write(payload)

    def json_error(self, status, code, detail=None):
        payload = json.dumps({"error": {"code": code, "detail": detail}}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)


def shutdown(_signum, _frame):
    stopping.set()
    if gateway_process and gateway_process.poll() is None:
        gateway_process.terminate()
        try:
            gateway_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            gateway_process.kill()
    raise SystemExit(0)


if __name__ == "__main__":
    if not STATIC_ROOT.is_dir():
        raise SystemExit("MINIAPP_STATIC_ROOT does not exist: " + str(STATIC_ROOT))
    if not (GATEWAY_DIR / "src" / "miniappGateway.js").is_file():
        raise SystemExit("Mini App gateway code is missing: " + str(GATEWAY_DIR))
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    start_gateway()
    threading.Thread(target=watch_gateway, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
