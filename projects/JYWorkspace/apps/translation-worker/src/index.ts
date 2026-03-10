import { workerConfig } from "./config";

console.log(`[translation-worker] starting on port ${workerConfig.workerPort}`);
console.log(`[translation-worker] server url ${workerConfig.serverBaseUrl}`);
console.log(`[translation-worker] storage mode ${workerConfig.storageMode}`);
console.log(`[translation-worker] storage path ${workerConfig.storageBasePath}`);
console.log(`[translation-worker] log dir ${workerConfig.logDir}`);
console.log("[translation-worker] health check ready");

setInterval(() => {
  console.log(`[translation-worker] heartbeat ${new Date().toISOString()}`);
}, 60000);