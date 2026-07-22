import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { analyticsBucketFor, type AnalyticsArtifactKind, type StorageObjectRef } from "@flowos/analytics-contracts";

@Injectable()
export class AnalyticsStorageService {
  private readonly url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  private readonly serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  ensureConfigured(): void {
    if (!this.url || !this.serviceRoleKey) {
      throw new ServiceUnavailableException("Analytics storage is unavailable: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
  }

  async uploadImmutable(kind: AnalyticsArtifactKind, path: string, data: Buffer, contentType: string, sha256: string): Promise<StorageObjectRef> {
    this.ensureConfigured();
    const bucket = analyticsBucketFor(kind);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${this.url}/storage/v1/object/${bucket}/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey!,
        Authorization: `Bearer ${this.serviceRoleKey!}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: data as unknown as BodyInit,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Supabase Storage immutable upload failed (${response.status}): ${detail}`);
    }
    return { bucket, path, artifactKind: kind, sha256 };
  }
}
