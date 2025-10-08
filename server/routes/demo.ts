import { RequestHandler } from "express";
import { DemoResponse } from "server/shared/api";
import { getDb } from "../index";

export async function handleDemo(req, res) {
  try {
    const db = getDb();
    const rows = await db.collection("EXPORT_PDF").find({}).toArray();

    res.setHeader("Cache-Control", "no-cache"); // Disable caching
    res.status(200).json({ rows });
  } catch (error) {
    console.error("Error in handleDemo:", error);
    res.status(500).json({ error: "Failed to fetch demo data" });
  }
}
