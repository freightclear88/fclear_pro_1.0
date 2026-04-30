import { Strategy as LocalStrategy } from "passport-local";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { storage } from "./storage";

const authTokens = new Map<string, { userId: string; createdAt: number }>();
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

export function generateAuthToken(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  authTokens.set(token, { userId, createdAt: Date.now() });
  return token;
}

function resolveAuthUserId(req: any): string | null {
  if (req.session?.userId && req.session?.isAuthenticated) {
    return req.session.userId;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const entry = authTokens.get(token);
    if (entry && Date.now() - entry.createdAt < TOKEN_TTL) {
      return entry.userId;
    }
    if (entry) authTokens.delete(token);
  }
  return null;
}

export function getAuthUserId(req: any): string | null {
  return resolveAuthUserId(req);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    store: sessionStore,
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local strategy: look up user by email, verify bcrypt password
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!user.password) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const match = await bcrypt.compare(password, user.password);
          if (!match) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, { id: user.id });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      cb(null, user || false);
    } catch (err) {
      cb(err);
    }
  });

  // POST /api/login is handled by routes.ts using bcrypt directly.
  // GET /api/login — redirect to frontend login page for browser navigation
  app.get("/api/login", (_req, res) => {
    res.redirect("/login");
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.authUserId = userId;
  return next();
};

// Middleware to check subscription access
export const requireSubscription: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.authUserId = userId;
    const accessInfo = await storage.checkUserAccess(userId);

    if (!accessInfo.hasAccess) {
      return res.status(403).json({
        message: "Subscription required",
        subscriptionStatus: accessInfo.subscriptionStatus,
        isTrialActive: accessInfo.isTrialActive
      });
    }

    // Check usage limits for specific operations
    const path = req.path;
    if (path.includes('/shipments') && req.method === 'POST') {
      if (accessInfo.usageLimits.shipments.max !== -1 &&
          accessInfo.usageLimits.shipments.current >= accessInfo.usageLimits.shipments.max) {
        return res.status(403).json({
          message: "Shipment limit reached",
          usageLimits: accessInfo.usageLimits
        });
      }
    }

    if (path.includes('/documents') && req.method === 'POST') {
      if (accessInfo.usageLimits.documents.max !== -1 &&
          accessInfo.usageLimits.documents.current >= accessInfo.usageLimits.documents.max) {
        return res.status(403).json({
          message: "Document limit reached",
          usageLimits: accessInfo.usageLimits
        });
      }
    }

    req.userAccess = accessInfo;
    next();
  } catch (error) {
    console.error("Subscription check error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check admin access
export const requireAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.authUserId = userId;

    const user = await storage.getUser(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        message: "Admin access required"
      });
    }

    next();
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check agent access (agents have admin-like permissions but not full admin)
export const requireAgent: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.authUserId = userId;

    const user = await storage.getUser(userId);
    if (!user || (!user.isAgent && !user.isAdmin)) {
      return res.status(403).json({
        message: "Agent access required"
      });
    }

    next();
  } catch (error) {
    console.error("Agent check error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check chat access based on subscription plan
export const requireChatAccess: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.authUserId = userId;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user has chat access based on subscription
    const subscriptionPlan = user.subscriptionPlan || 'free';

    if (subscriptionPlan === 'free') {
      return res.status(403).json({
        message: "Chat access requires Starter or Pro subscription",
        upgradeRequired: true,
        requiredPlans: ['starter', 'pro']
      });
    }

    // Allow access for starter, pro, and any other paid plans
    next();
  } catch (error) {
    console.error("Chat access check error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
