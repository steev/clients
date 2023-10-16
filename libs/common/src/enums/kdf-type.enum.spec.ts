import { exportedForTesting } from "./kdf-type.enum";

const { RangeConstant } = exportedForTesting;

describe("RangeConstant", () => {
  describe("constructor", () => {
    it("should throw an error when min is greater than max", () => {
      expect(() => new RangeConstant(10, 5, 0)).toThrowError("10 is greater than 5.");
    });

    it("should throw an error when default value is not in range", () => {
      expect(() => new RangeConstant(0, 10, 20)).toThrowError("Default value is not in range.");
    });
  });

  describe("inRange", () => {
    it("should return true when in range", () => {
      const range = new RangeConstant(0, 10, 5);
      expect(range.inRange(5)).toBe(true);
    });

    it("should return false when not in range", () => {
      const range = new RangeConstant(5, 10, 7);
      expect(range.inRange(1)).toBe(false);
      expect(range.inRange(20)).toBe(false);
    });
  });
});
