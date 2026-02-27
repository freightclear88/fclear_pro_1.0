import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

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
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // In development, use the first domain from REPLIT_DOMAINS
    // In production, use the actual hostname
    const hostname = req.hostname === 'localhost' 
      ? process.env.REPLIT_DOMAINS!.split(",")[0] 
      : req.hostname;
    
    passport.authenticate(`replitauth:${hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // In development, use the first domain from REPLIT_DOMAINS
    // In production, use the actual hostname
    const hostname = req.hostname === 'localhost' 
      ? process.env.REPLIT_DOMAINS!.split(",")[0] 
      : req.hostname;
    
    passport.authenticate(`replitauth:${hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Check for native login session
  if (!req.session?.userId || !req.session?.isAuthenticated) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

// Middleware to check subscription access
export const requireSubscription: RequestHandler = async (req: any, res, next) => {
  try {
    // Check for native login session
    if (!req.session?.userId || !req.session?.isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.session.userId;
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
    // Check for native login session
    if (!req.session?.userId || !req.session?.isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.session.userId;

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
    // Check for native login session
    if (!req.session?.userId || !req.session?.isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.session.userId;

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
    // Check for native login session
    if (!req.session?.userId || !req.session?.isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.session.userId;

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
