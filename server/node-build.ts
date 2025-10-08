import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "./index";
import express from "express";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app from your server factory
(async () => {
  const app = await createServer();
  const port = process.env.PORT || 3000;

  const distPath = path.join(__dirname, "../spa");
  app.use(express.static(distPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });

  process.on("SIGTERM", () => {
    console.log("🛑 Received SIGTERM, shutting down gracefully");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    console.log("🛑 Received SIGINT, shutting down gracefully");
    process.exit(0);
  });
})();
