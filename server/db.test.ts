import { describe, expect, it } from "vitest";
import { getInsertedId } from "./db";

describe("getInsertedId", () => {
  it("lê o insertId do primeiro elemento da resposta mysql2", () => {
    expect(getInsertedId([{ insertId: 42 }, []])).toBe(42);
  });

  it("rejeita uma resposta sem identificador válido", () => {
    expect(() => getInsertedId([{ insertId: 0 }, []])).toThrow("identificador válido");
  });
});
