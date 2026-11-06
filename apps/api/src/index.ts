import { APP_NAME } from "@atlas/shared";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { createDb } from "./db/client.js";

export const SERVICE_NAME = `${APP_NAME} API`;

async function start() {
  const config = readConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  const app = createApp({ db, config, logger: true });
  app.addHook("onClose", () => pool.end());
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await app.close();
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await shutdown();
  }
}

if (import.meta.main) {
  start().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Startup failed");
    process.exitCode = 1;
  });
}
