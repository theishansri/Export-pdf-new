// src/createServer.ts or src/server.ts

import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, Db } from "mongodb";

import { handleDemo } from "./routes/demo";
import { getRum, getRumSummary, postRum } from "./routes/rum";
import exportPdf from "./routes/exportPdf";
import { handleDownloadPdfPuppeteer } from "./routes/puppeteerPdf";
import exportPdfKit from "./routes/exportpdfkitnew";

const uri: string = process.env.MONGODB_URI || "";
const client = new MongoClient(uri);

let db: Db;

async function connectToDatabase(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db(); // uses default DB from URI
    console.log("✅ Connected to MongoDB");
  }
  return db;
}

function getDb(): Db {
  if (!db) {
    throw new Error(
      "❌ MongoDB not connected. Call connectToDatabase() first.",
    );
  }
  return db;
}

// 👇 Export this if you want to use getDb in route handlers
export { getDb };

export async function createServer() {
  const app = express();

  // ✅ Connect to MongoDB
  await connectToDatabase();

  // ✅ Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ✅ Routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/export-pdf-puppeteer", handleDownloadPdfPuppeteer);
  app.post("/api/export-pdf", exportPdf);
  app.post("/api/export-pdf-kit", exportPdfKit);

  app.post("/api/rum", postRum);
  app.get("/api/rum", getRum);
  app.get("/api/rum/summary", getRumSummary);

  return app;
}
