import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateConnectorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "e.g. 'postgres' or 'rest'" })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ type: Object, description: "Non-secret connector settings (host, base URL, etc.)" })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiProperty({ description: "Plaintext secret (connection string, API key, ...) — encrypted at rest, never returned by the API" })
  @IsString()
  @IsNotEmpty()
  credentials!: string;
}
