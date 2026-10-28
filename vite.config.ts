import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Agent as HttpsAgent } from "node:https";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Development proxy only (never used by `vite build` or in production). The backend runs separately.
  const target = env.FRONTEND_API_PROXY || "https://localhost:3001";

  // Optional dev-server HTTPS (needed for camera access on phones). The key/cert are machine-local and
  // git-ignored, so they are only read when present: `vite build` (CI / Netlify) evaluates this config too and
  // must not fail just because the dev certificates are missing.
  const devKeyPath = resolve(process.cwd(), "certs/dev-key.pem");
  const devCertPath = resolve(process.cwd(), "certs/dev-cert.pem");
  const devHttps =
    existsSync(devKeyPath) && existsSync(devCertPath)
      ? { key: readFileSync(devKeyPath), cert: readFileSync(devCertPath) }
      : undefined;

  // The dev server and the dev proxy are always HTTPS. Never disable certificate validation: the backend's mkcert
  // certificate is trusted by pointing Node at the mkcert root CA (DEV_CA_PATH, set by `npm run certs`).
  if (command === "serve" && !devHttps) {
    throw new Error(
      "HTTPS dev certificates not found (certs/dev-key.pem, certs/dev-cert.pem). Install mkcert and run `npm run certs`.",
    );
  }
  const caPath = env.DEV_CA_PATH;
  const proxyAgent =
    caPath && existsSync(caPath)
      ? new HttpsAgent({ ca: readFileSync(caPath) })
      : undefined;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 3000,
      https: devHttps,
      proxy: {
        "/api": { target, changeOrigin: false, secure: true, agent: proxyAgent },
        "/health": { target, changeOrigin: false, secure: true, agent: proxyAgent },
      },
    },
    build: { outDir: "dist" },
  };
});
