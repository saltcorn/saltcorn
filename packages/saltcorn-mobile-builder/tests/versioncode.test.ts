import { generateAndroidVersionCode } from "../utils/common-build-utils";

describe("versioncode tests", () => {
  it("should generate version code", () => {
    expect(generateAndroidVersionCode("0.0.1")).toBe(1);

    expect(generateAndroidVersionCode("1.0.0")).toBe(1000000);
    expect(generateAndroidVersionCode("1.1.0")).toBe(1001000);
    expect(generateAndroidVersionCode("1.1.1")).toBe(1001001);

    expect(generateAndroidVersionCode("1.1.999")).toBe(1001999);
    expect(generateAndroidVersionCode("1.999.1")).toBe(1999001);
    expect(generateAndroidVersionCode("0.999.1")).toBe(999001);
  });

  it("should throw error for invalid version", () => {
    expect(() => generateAndroidVersionCode("")).toThrow();
    expect(() => generateAndroidVersionCode("1.1")).toThrow();
    expect(() => generateAndroidVersionCode("1.1.")).toThrow();

    expect(() => generateAndroidVersionCode("1000.1.1")).toThrow();
    expect(() => generateAndroidVersionCode("1.1000.1")).toThrow();
    expect(() => generateAndroidVersionCode("1.1.1000")).toThrow();
  });
});
