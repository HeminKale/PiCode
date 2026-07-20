import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsArray, IsObject, IsBoolean } from "class-validator";

export class CreateFlowDto {
  @ApiPropertyOptional({ description: "If provided (e.g. from /flows/generate), reuses this id instead of generating a new one" })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [Object] })
  @IsArray()
  nodes: object[];

  @ApiProperty({ type: [Object] })
  @IsArray()
  edges: object[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
