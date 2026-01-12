import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSettings: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || "payment-app-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
};

app.use(session(sessionSettings));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

(async () => {
  registerRoutes(app);
  
  const isDev = process.env.NODE_ENV !== "production";
  
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "../dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "../dist/index.html"));
    });
  }

  const port = parseInt(process.env.PORT || "5000");
  app.listen(port, "0.0.0.0", () => {
    console.log(`FreightClear Payments server running on port ${port}`);
  });
})();
