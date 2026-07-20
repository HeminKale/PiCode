import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createDecipheriv, createCipheriv, randomBytes } from "crypto";
import { Pool } from "pg";
import { PrismaService } from "../prisma/prisma.service";
import { CreateConnectorDto } from "./dto/create-connector.dto";

const SELECT_ONLY = /^\s*(select|with)\b/i;
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SINGLE_STATEMENT = /;\s*\S/;

@Injectable()
export class ConnectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveConnector(dto: CreateConnectorDto) {
    const encryptedCredentials = this.encrypt(dto.credentials);
    const connector = await this.prisma.connector.create({
      data: { name: dto.name, type: dto.type, config: (dto.config ?? {}) as object, encryptedCredentials },
    });
    return this.toSafeConnector(connector);
  }

  async listConnectors() {
    const connectors = await this.prisma.connector.findMany({ orderBy: { createdAt: "desc" } });
    return connectors.map((c) => this.toSafeConnector(c));
  }

  async deleteConnector(id: string) {
    await this.prisma.connector.delete({ where: { id } });
    return { deleted: true as const, id };
  }

  /** No connectorId means "use the app's default DATABASE_URL" — the Sprint 1/2.2 default before a registry existed. */
  async resolveConnectionString(connectorId?: string): Promise<string | undefined> {
    if (!connectorId) return process.env.DATABASE_URL;
    const connector = await this.prisma.connector.findUnique({ where: { id: connectorId } });
    if (!connector) throw new NotFoundException(`Connector ${connectorId} not found`);
    return this.decrypt(connector.encryptedCredentials);
  }

  private toSafeConnector(connector: { id: string; name: string; type: string; config: unknown; createdAt: Date; updatedAt: Date }) {
    const { id, name, type, config, createdAt, updatedAt } = connector;
    return { id, name, type, config, createdAt, updatedAt };
  }

  private quoteIdent(name: string): string {
    if (!SAFE_IDENT.test(name)) throw new BadRequestException(`Unsafe identifier: ${name}`);
    return `"${name}"`;
  }

  private assertSingleStatement(clause: string, label: string) {
    if (SINGLE_STATEMENT.test(clause)) throw new BadRequestException(`${label} must be a single statement`);
  }

  private async run(sql: string, values: unknown[], connectionString?: string): Promise<unknown[]> {
    if (!connectionString) throw new BadRequestException("No PostgreSQL connector is configured");
    const pool = new Pool({ connectionString, max: 1 });
    try { return (await pool.query(sql, values)).rows; } finally { await pool.end(); }
  }

  async insert(target: string, fields: Record<string, unknown>, connectionString = process.env.DATABASE_URL): Promise<unknown> {
    const columns = Object.keys(fields ?? {});
    if (columns.length === 0) throw new BadRequestException("CREATE requires at least one field");
    const columnList = columns.map((c) => this.quoteIdent(c)).join(", ");
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${this.quoteIdent(target)} (${columnList}) VALUES (${placeholders}) RETURNING *`;
    const rows = await this.run(sql, Object.values(fields), connectionString);
    return rows[0];
  }

  async update(target: string, where: string, fields: Record<string, unknown>, connectionString = process.env.DATABASE_URL): Promise<unknown[]> {
    const columns = Object.keys(fields ?? {});
    if (columns.length === 0) throw new BadRequestException("UPDATE requires at least one field");
    this.assertSingleStatement(where, "UPDATE where clause");
    const setList = columns.map((c, i) => `${this.quoteIdent(c)} = $${i + 1}`).join(", ");
    const sql = `UPDATE ${this.quoteIdent(target)} SET ${setList} WHERE ${where} RETURNING *`;
    return this.run(sql, Object.values(fields), connectionString);
  }

  async remove(target: string, where: string, connectionString = process.env.DATABASE_URL): Promise<unknown[]> {
    this.assertSingleStatement(where, "DELETE where clause");
    const sql = `DELETE FROM ${this.quoteIdent(target)} WHERE ${where} RETURNING *`;
    return this.run(sql, [], connectionString);
  }

  encrypt(plainText: string): string {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"));
    if (!iv || !tag || !encrypted) throw new BadRequestException("Invalid encrypted connector credential");
    const decipher = createDecipheriv("aes-256-gcm", this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  async select(query: string, values: unknown[] = [], connectionString = process.env.DATABASE_URL): Promise<unknown[]> {
    if (!SELECT_ONLY.test(query)) throw new BadRequestException("The generic connector only accepts one SELECT or WITH query");
    this.assertSingleStatement(query, "SELECT query");
    return this.run(query, values, connectionString);
  }

  async request(url: string, init: RequestInit = {}) {
    const response = await fetch(url, init);
    if (!response.ok) throw new BadRequestException(`REST connector returned ${response.status}`);
    return response.headers.get("content-type")?.includes("application/json") ? response.json() : response.text();
  }

  private key(): Buffer {
    const value = process.env.CONNECTOR_ENCRYPTION_KEY;
    if (!value) throw new BadRequestException("CONNECTOR_ENCRYPTION_KEY must be configured");
    const key = Buffer.from(value, "base64");
    if (key.length !== 32) throw new BadRequestException("CONNECTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    return key;
  }
}
