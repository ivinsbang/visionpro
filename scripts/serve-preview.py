import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'none'; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Serve the local Windows spatial-workspace preview.")
    parser.add_argument("--port", type=int, default=8765, help="Loopback HTTP port (default: 8765).")
    arguments = parser.parse_args()
    if not 1 <= arguments.port <= 65535:
        parser.error("Port must be between 1 and 65535.")

    preview_root = Path(__file__).resolve().parents[1] / "apps" / "preview-web"
    handler = partial(PreviewHandler, directory=str(preview_root))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", arguments.port), handler)
    except OSError as error:
        parser.exit(1, f"Could not start preview: {error}. Try --port with another port.\n")

    print(f"Local preview: http://127.0.0.1:{arguments.port}", flush=True)
    print("Synthetic preview only. No CME connections. Press Ctrl+C to stop.", flush=True)
    with server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
