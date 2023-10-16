import { KdfConfig } from "../auth/models/domain/kdf-config";

export enum KdfType {
  PBKDF2_SHA256 = 0,
  Argon2id = 1,
}

class RangeConstant {
  constructor(readonly min: number, readonly max: number, readonly defaultValue: number) {
    if (this.inRange(defaultValue) === false) {
      throw new Error("Default value is not in range.");
    }
  }

  inRange(value: number): boolean {
    return value >= this.min && value <= this.max;
  }
}

export const ARGON2_MEMORY = new RangeConstant(16, 1024, 64);
export const ARGON2_PARALLELISM = new RangeConstant(1, 16, 4);
export const ARGON2_ITERATIONS = new RangeConstant(2, 10, 3);

export const DEFAULT_KDF_TYPE = KdfType.PBKDF2_SHA256;
export const PBKDF2_ITERATIONS = new RangeConstant(600_000, 2_000_000, 600_000);
export const DEFAULT_KDF_CONFIG = new KdfConfig(PBKDF2_ITERATIONS.defaultValue);
export const SEND_KDF_ITERATIONS = 100000;
