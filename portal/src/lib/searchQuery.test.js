import { describe, expect, it } from "vitest";
import { isIdentificationQuery, isNameSearch, normalizeSearchName, parseSearchText } from "./searchQuery.js";

describe("parseSearchText", () => {
  it("trata un RUN con puntos y guion como identificación", () => {
    expect(parseSearchText("12.345.678-5")).toBe("123456785");
    expect(parseSearchText("1234k")).toBe("1234K");
  });

  it("normaliza un nombre sin tildes ni mayúsculas", () => {
    expect(parseSearchText("  María Núñez ")).toBe("maria nunez");
  });

  it("devuelve vacío si el texto es muy corto", () => {
    expect(parseSearchText("12")).toBe("");
    expect(parseSearchText("ab")).toBe("");
    expect(parseSearchText("")).toBe("");
  });

  it("no deja pasar comodines ni signos del filtro", () => {
    expect(parseSearchText("p%rez,(x)")).toBe("p rez x");
  });
});

describe("clasificación de la búsqueda", () => {
  it("distingue nombre de identificación", () => {
    expect(isNameSearch("maria perez")).toBe(true);
    expect(isNameSearch("123456785")).toBe(false);
    expect(isNameSearch("1234K")).toBe(false);
    expect(isIdentificationQuery("12.345.678-K")).toBe(true);
    expect(isIdentificationQuery("Karla")).toBe(false);
  });

  it("normaliza igual que la base de datos", () => {
    expect(normalizeSearchName("ÁÉÍÓÚ Ü Ñ")).toBe("aeiou u n");
  });
});
