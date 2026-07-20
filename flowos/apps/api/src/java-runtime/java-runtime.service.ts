import { BadGatewayException, Injectable } from "@nestjs/common";

/** Thrown when the Java Runtime reports the class isn't loaded (HTTP 404) — the caller's cue to generate + compile it. */
export class JavaClassNotLoadedError extends Error {}

@Injectable()
export class JavaRuntimeService {
  private readonly baseUrl = process.env.JAVA_RUNTIME_URL ?? "http://localhost:8081";

  async loadClass(className: string, sourceCode: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className, sourceCode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new BadGatewayException(`Java class ${className} failed to compile: ${JSON.stringify(body)}`);
    }
  }

  async executeClass(className: string, method: string, input: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/classes/${encodeURIComponent(className)}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, input }),
    });
    if (res.status === 404) throw new JavaClassNotLoadedError(`Class ${className} is not loaded in the Java Runtime`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new BadGatewayException(`Java execution of ${className}.${method} failed: ${JSON.stringify(body)}`);
    }
    const body = await res.json();
    return body.result;
  }
}
