#!/usr/bin/env python3
"""Optional Tier 1 endpoint (T6). The web app works without it.

    GOOGLE_API_KEY=... agent/.venv/bin/python agent/server.py --port 8787
    then open the app with   index.html?agent=http://127.0.0.1:8787

POST /ask  {"question": "..."}  ->  {"fact_ids": [...], "confidence": "...", "tier": "adk"|"static", "why": "..."}

It returns fact IDs only, never answer text. The browser renders the words from its own
reviewed files (app/qa/answers.json and facts.json), so even a compromised endpoint cannot
put new sentences or numbers on the page. With no API key it answers 503 and the app uses
the static answers. It listens on 127.0.0.1 only.
"""
import argparse
import asyncio
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import grounded_ask as g  # noqa: E402

ROOT = g.ROOT


def make_service(story_id):
    facts = g.load_json(ROOT / f"app/stories/{story_id}.facts.json")
    qa = g.load_json(ROOT / "app/qa/answers.json")
    # The browser has the static matcher; here "static" just means "no facts chosen".
    return g.GroundedAsk(facts, qa, g.DEFAULT_MODEL, lambda q: {"matched": False, "factIds": []})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--story", default="mur-sst-mauritius-2023")
    args = ap.parse_args()
    has_key = bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"))
    service = make_service(args.story) if has_key else None
    if not has_key:
        print("No GOOGLE_API_KEY or GEMINI_API_KEY: /ask will answer 503 and the app will use static answers.")

    class H(BaseHTTPRequestHandler):
        def _send(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self._send(204, {})

        def do_POST(self):
            if self.path != "/ask":
                return self._send(404, {"error": "not found"})
            if service is None:
                return self._send(503, {"error": "no API key configured"})
            try:
                n = min(int(self.headers.get("Content-Length", "0")), 2000)
                q = json.loads(self.rfile.read(n)).get("question", "")
            except (ValueError, AttributeError):
                return self._send(400, {"error": "bad request"})
            r = asyncio.run(service.ask(str(q)))
            self._send(200, {"fact_ids": r.get("factIds", []) if r["tier"] == "adk" else [], "confidence": r.get("modelConfidence", "none"),
                             "tier": r["tier"], "why": r.get("why", "")})

        def log_message(self, *a):  # keep question text out of logs
            pass

    print(f"Listening on http://127.0.0.1:{args.port}/ask")
    HTTPServer(("127.0.0.1", args.port), H).serve_forever()


if __name__ == "__main__":
    main()
