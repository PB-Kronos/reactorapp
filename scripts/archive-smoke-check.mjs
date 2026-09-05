import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 4187;
const viteBin = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
const server = spawn(
  process.execPath,
  [
    viteBin,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const routes = [
  "/",
  "/archive",
  "/naramo",
  "/a-core-game",
  "/apollo",
  "/apollo/central",
  "/apollo/tner",
  "/reactor",
  "/mainframe",
  "/supervisor",
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw new Error(
    `Vite preview did not become ready: ${String(lastError ?? "unknown error")}`,
  );
}

try {
  await waitForServer();
  for (const route of routes) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`);
    const body = await response.text();
    if (!response.ok || !body.includes('<div id="root"></div>')) {
      throw new Error(`${route} failed: HTTP ${response.status}`);
    }
    console.log(`PASS ${route} (${response.status})`);
  }
} finally {
  server.kill();
}
