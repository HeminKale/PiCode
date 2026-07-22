import { BadRequestException } from "@nestjs/common";

jest.mock("puppeteer", () => ({ __esModule: true, default: { launch: jest.fn() } }));

import { FlowsService } from "./flows.service";

describe("Flow Analytics result references", () => {
  const service = new FlowsService({ flow: { upsert: jest.fn() } } as never, {} as never);

  it("rejects raw Analytics artifacts in DISPLAY or COMPONENT flowJson", async () => {
    await expect(service.createFlow({ name: "Unsafe", nodes: [{ id: "display", type: "DISPLAY", config: { predictionArtifact: { bucket: "analytics-prediction" } } }], edges: [] } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
