import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

export function parseAllowedOrigins(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean))];
}

export function analyticsCorsOptions(environment = process.env.NODE_ENV, configuredOrigins = process.env.CORS_ALLOWED_ORIGINS): CorsOptions {
  const allowedOrigins = parseAllowedOrigins(configuredOrigins);
  if (environment === "production" && allowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must list the permitted web origins in production.");
  }
  const permitted = allowedOrigins.length > 0 ? allowedOrigins : ["http://localhost:3000"];
  return {
    credentials: true,
    origin(origin, callback) {
      // Requests without an Origin header are non-browser calls such as Railway health checks.
      if (!origin || permitted.includes(origin.replace(/\/$/, ""))) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."), false);
    },
  };
}
