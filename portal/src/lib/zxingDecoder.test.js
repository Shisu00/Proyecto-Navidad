import { describe, expect, it } from "vitest";
import { fitSize, toLuminance } from "./zxingDecoder.js";

describe("fitSize", () => {
  it("no reduce una imagen que ya cabe", () => {
    expect(fitSize(1280, 720, 1920)).toEqual({ width: 1280, height: 720 });
  });

  it("reduce manteniendo la proporción", () => {
    expect(fitSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitSize(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
});

describe("toLuminance", () => {
  it("convierte a escala de grises: negro, blanco y verde", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 255, 0, 255]);
    const luminance = toLuminance(rgba, 3);
    expect(luminance[0]).toBe(0);
    expect(luminance[1]).toBeGreaterThanOrEqual(254);
    expect(luminance[2]).toBe((601 * 255) >> 10);
  });
});
