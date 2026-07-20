import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, MinLength } from "class-validator";

export class GenerateFlowDto {
  @ApiProperty({ example: "Process today's loan applications, check credit score, approve above 700" })
  @IsString()
  @MinLength(5)
  prompt: string;

  @ApiPropertyOptional({ example: "Table: loan_applications(id, applicant_name, credit_score, date)" })
  @IsOptional()
  @IsString()
  context?: string;
}
