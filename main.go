package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// web/ holds the whole client: index.html, the game modules, and the
// vendored Three.js build (the CSP allows same-origin scripts only, so no CDN).
//
//go:embed web
var webFiles embed.FS

func main() {
	port := getenv("PORT", "8080")
	mux := http.NewServeMux()

	// Healthcheck: static and dependency-free. It must never touch storage.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok\n"))
	})

	webRoot, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal(err)
	}
	// Local development only: WEB_DIR=web serves the client from disk so edits
	// show on reload without rebuilding. Never set in the deployed image.
	if dir := os.Getenv("WEB_DIR"); dir != "" {
		webRoot = os.DirFS(dir)
		log.Printf("serving client from disk: %s", dir)
	}
	static := http.FileServer(http.FS(webRoot))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r) // no directory listings
			return
		}
		// Embedded files carry no modtime, so steer caching explicitly: the
		// pinned library is immutable per release, everything else revalidates.
		if strings.HasPrefix(r.URL.Path, "/lib/") {
			w.Header().Set("Cache-Control", "public, max-age=86400")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		static.ServeHTTP(w, r)
	})

	addr := "0.0.0.0:" + port
	log.Printf("range-rat listening on %s", addr)
	srv := &http.Server{
		Addr:              addr,
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}

// securityHeaders sets conservative browser hardening on every response.
// Same-origin everything; inline style only (scripts are modules from /js).
// The importmap is an inline script, so script-src keeps 'unsafe-inline'.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
