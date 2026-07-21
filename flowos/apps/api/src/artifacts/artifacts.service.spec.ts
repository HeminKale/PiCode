import { BadRequestException } from "@nestjs/common";
import { assertSafeDisplaySource } from "./artifacts.service";

describe("DISPLAY artifact source validation", () => {
  it("allows ordinary content and CSS that uses top or location", () => {
    expect(() => assertSafeDisplaySource('<div style="top:10px;left:0">Top performers at this Location</div>')).not.toThrow();
    expect(() => assertSafeDisplaySource("<style>.badge{top:4px;position:relative}</style><label>Location</label>")).not.toThrow();
  });

  it.each(["window.top.postMessage({}, '*')", "top.location = '/other'", "location.href = '/other'", "window.location.assign('/other')", "fetch('/api')", "localStorage.getItem('token')", '<link rel="stylesheet" href="https://example.com/x.css">'])("rejects forbidden browser capability: %s", (source) => {
    expect(() => assertSafeDisplaySource(source)).toThrow(BadRequestException);
  });
});
