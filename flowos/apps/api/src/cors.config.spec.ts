import { analyticsCorsOptions, parseAllowedOrigins } from "./cors.config";

describe("analyticsCorsOptions", () => {
  it("parses and de-duplicates configured origins", () => {
    expect(parseAllowedOrigins(" https://app.example.com/,https://preview.example.com,https://app.example.com ")).toEqual([
      "https://app.example.com", "https://preview.example.com",
    ]);
  });

  it("rejects production startup without an explicit allowlist", () => {
    expect(() => analyticsCorsOptions("production", undefined)).toThrow("CORS_ALLOWED_ORIGINS");
  });

  it("allows only configured browser origins and non-browser requests", () => {
    const options = analyticsCorsOptions("production", "https://app.example.com");
    const origin = options.origin as (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => void;
    const resolve = (value: string | undefined) => new Promise<{ error?: Error | null; allowed?: boolean }>((done) => origin(value, (error, allowed) => done({ error, allowed })));
    return Promise.all([resolve("https://app.example.com"), resolve("https://other.example.com"), resolve(undefined)]).then(([allowed, rejected, noOrigin]) => {
      expect(allowed).toEqual({ error: null, allowed: true });
      expect(rejected.error?.message).toBe("Origin is not allowed by CORS.");
      expect(noOrigin).toEqual({ error: null, allowed: true });
    });
  });
});
