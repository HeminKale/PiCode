import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConnectorsService } from "./connectors.service";
import { CreateConnectorDto } from "./dto/create-connector.dto";

@ApiTags("connectors")
@Controller("connectors")
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Post()
  @ApiOperation({ summary: "Register a connector — credentials are encrypted at rest and never returned" })
  create(@Body() dto: CreateConnectorDto) {
    return this.connectors.saveConnector(dto);
  }

  @Get()
  @ApiOperation({ summary: "List registered connectors (credentials omitted)" })
  list() {
    return this.connectors.listConnectors();
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove a registered connector" })
  remove(@Param("id") id: string) {
    return this.connectors.deleteConnector(id);
  }
}
