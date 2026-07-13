import http.server
import os
import socketserver
import threading

from app.workers.celery_app import celery_app


def run_health_server():
    """
    Render's free Web Service tier requires binding to a port and responding
    to health checks. Celery workers don't do this natively, so this tiny
    HTTP server runs in a background thread purely to satisfy that
    requirement — it has no functional role in notification processing.
    """
    port = int(os.environ.get("PORT", 10000))

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"worker alive")

        def log_message(self, format, *args):
            pass  # keep Celery's own logs clean

    with socketserver.TCPServer(("0.0.0.0", port), Handler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    health_thread = threading.Thread(target=run_health_server, daemon=True)
    health_thread.start()

    celery_app.worker_main(argv=["worker", "--loglevel=info", "--concurrency=2"])