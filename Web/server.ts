import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoint to read wiki_database.json dynamically from disk
  app.get("/api/wiki-data", (req, res) => {
    try {
      const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
      const rootPath = path.join(process.cwd(), "wiki_database.json");

      let filePath = publicPath;
      if (!fs.existsSync(filePath) && fs.existsSync(rootPath)) {
        filePath = rootPath;
      }

      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(fileData);
        return res.json({ success: true, count: json.length, data: json });
      }

      return res.status(404).json({ success: false, error: "Archivo wiki_database.json no encontrado" });
    } catch (err: any) {
      console.error("Error leyendo wiki_database.json:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API endpoint to update wiki_database.json
  app.post("/api/wiki-data", (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, error: "Data debe ser un arreglo de entidades" });
      }

      const jsonStr = JSON.stringify(data, null, 2);
      const publicPath = path.join(process.cwd(), "public", "wiki_database.json");
      const rootPath = path.join(process.cwd(), "wiki_database.json");

      if (!fs.existsSync(path.dirname(publicPath))) {
        fs.mkdirSync(path.dirname(publicPath), { recursive: true });
      }

      fs.writeFileSync(publicPath, jsonStr, "utf-8");
      fs.writeFileSync(rootPath, jsonStr, "utf-8");

      return res.json({ success: true, count: data.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
