import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Agent as HttpsAgent } from "node:https";
import { rootCertificates } from "node:tls";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Dev-proxy target only (never used by `vite build`). Default: the deployed Render API.
  const target = env.FRONTEND_API_PROXY || "https://pnms-backend.onrender.com";
  const targetOrigin = new URL(target).origin;

  const devKeyPath = resolve(process.cwd(), "certs/dev-key.pem");
  const devCertPath = resolve(process.cwd(), "certs/dev-cert.pem");
  const devHttps =
    existsSync(devKeyPath) && existsSync(devCertPath)
      ? { key: readFileSync(devKeyPath), cert: readFileSync(devCertPath) }
      : undefined;

  // Optional extra trust anchor (mkcert root CA) for a LOCAL https backend. It is ADDED to Node's public roots, so
  // a public target such as Render keeps verifying normally; certificate validation is never disabled.
  const caPath = env.DEV_CA_PATH;
  const proxyAgent =
    caPath && existsSync(caPath)
      ? new HttpsAgent({ ca: [...rootCertificates, readFileSync(caPath, "utf8")] })
      : undefined;

  if (command === "serve" && !devHttps) {
    throw new Error("HTTPS dev certificates not found. Run npm run certs.");
  }

  // The backend's CSRF check rejects a mutating request whose Origin header is neither allow-listed nor equal to the
  // Host it received. With changeOrigin the Host becomes the backend's, but the browser's Origin
  // (https://localhost:3000) is forwarded untouched -> POST /api/auth/login returned 403. Rewriting Origin to the
  // target keeps the request same-origin from the backend's point of view WITHOUT weakening CSRF (the token is still required).
  const proxyOptions: ProxyOptions = {
    target,
    changeOrigin: true,
    secure: true,
    cookieDomainRewrite: "",
    ...(proxyAgent ? { agent: proxyAgent } : {}),
    // `proxy` and `proxyReq` are typed by Vite's ProxyOptions (http-proxy server / http.ClientRequest).
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        if (proxyReq.getHeader("origin")) proxyReq.setHeader("origin", targetOrigin);
      });
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 3000,
      https: devHttps,
      proxy: {
        "/api": proxyOptions,
        "/health": proxyOptions,
      },
    },
    build: { outDir: "dist" },
  };
});
