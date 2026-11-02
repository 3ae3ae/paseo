#!/usr/bin/env python3
"""Local scripted model; the OMP process and shell execution remain real."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

EVIDENCE = Path(__file__).parent

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        body = json.dumps({'object': 'list', 'data': [{'id': 'qa-shell', 'object': 'model', 'owned_by': 'local-qa'}]}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        messages = request.get('messages', [])
        completed = any(m.get('role') == 'tool' for m in messages)
        with (EVIDENCE / 'stub-requests.jsonl').open('a') as log:
            log.write(json.dumps({'path': self.path, 'model': request.get('model'), 'stream': request.get('stream'), 'messageRoles': [m.get('role') for m in messages], 'response': 'text' if completed else 'bash sleep 90'}) + '\n')
        base = {'id': 'chatcmpl-local-qa', 'object': 'chat.completion.chunk', 'created': 1793570000, 'model': 'qa-shell'}
        delta = {'role': 'assistant', 'content': 'Command finished.'} if completed else {'role': 'assistant', 'tool_calls': [{'index': 0, 'id': 'call_sleep_90', 'type': 'function', 'function': {'name': 'bash', 'arguments': json.dumps({'command': 'sleep 90'})}}]}
        finish = 'stop' if completed else 'tool_calls'
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        for part in [{'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]}, {'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish}], 'usage': {'prompt_tokens': 100, 'completion_tokens': 20, 'total_tokens': 120}}]:
            self.wfile.write(('data: ' + json.dumps({**base, **part}) + '\n\n').encode())
        self.wfile.write(b'data: [DONE]\n\n')
        self.wfile.flush()

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
(EVIDENCE / 'stub-port.json').write_text(json.dumps({'port': server.server_port}))
print(f'Local model stub listening on 127.0.0.1:{server.server_port}', flush=True)
server.serve_forever()
