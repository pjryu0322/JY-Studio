import { createServer } from "node:http";
import { serverConfig } from "./config";

const server = createServer((request, response) => {
  const requestUrl = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? `localhost:${serverConfig.serverPort}`}`
  );

  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "Not Found" }));
});

server.listen(serverConfig.serverPort, () => {
  console.log(`JYWorkspace server listening on http://localhost:${serverConfig.serverPort}`);
  console.log(`storage mode: ${serverConfig.storageMode}`);
  console.log(`storage path: ${serverConfig.storageBasePath}`);
  console.log(`log dir: ${serverConfig.logDir}`);
});