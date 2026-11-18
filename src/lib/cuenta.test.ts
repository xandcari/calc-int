import { describe, expect, it } from "vitest";

import { mensajeDeErrorDeCuenta, nombreDesdeEmail, validarCuenta } from "./cuenta";

describe("validarCuenta", () => {
  it("acepta datos válidos al iniciar sesión", () => {
    expect(validarCuenta({ modo: "entrar", email: "ana@correo.com", password: "x" })).toEqual({});
  });

  it("pide email y contraseña vacíos", () => {
    const e = validarCuenta({ modo: "entrar", email: "  ", password: "" });
    expect(e.email).toMatch(/Escribí tu email/);
    expect(e.password).toMatch(/Escribí tu contraseña/);
  });

  it("rechaza emails sin @ o sin dominio", () => {
    expect(validarCuenta({ modo: "entrar", email: "ana", password: "x" }).email).toBeDefined();
    expect(validarCuenta({ modo: "entrar", email: "ana@correo", password: "x" }).email).toBeDefined();
    expect(validarCuenta({ modo: "entrar", email: "a b@correo.com", password: "x" }).email).toBeDefined();
  });

  it("exige 8 caracteres solo al crear la cuenta", () => {
    expect(validarCuenta({ modo: "crear", email: "ana@correo.com", password: "1234567" }).password).toMatch(/al menos 8/);
    expect(validarCuenta({ modo: "crear", email: "ana@correo.com", password: "12345678" })).toEqual({});
    // Al entrar no se vuelve a exigir el largo: una cuenta vieja podría tener otra regla.
    expect(validarCuenta({ modo: "entrar", email: "ana@correo.com", password: "123" })).toEqual({});
  });
});

describe("nombreDesdeEmail", () => {
  it("usa lo que está antes de la @", () => {
    expect(nombreDesdeEmail(" ana.perez@correo.com ")).toBe("ana.perez");
  });
  it("tiene un valor por defecto", () => {
    expect(nombreDesdeEmail("@correo.com")).toBe("Usuario");
  });
});

describe("mensajeDeErrorDeCuenta", () => {
  it("no distingue si falló el email o la contraseña", () => {
    const a = mensajeDeErrorDeCuenta({ code: "INVALID_EMAIL_OR_PASSWORD" });
    expect(a).toMatch(/email o la contraseña/);
    expect(mensajeDeErrorDeCuenta({ code: "USER_NOT_FOUND" })).toBe(a);
  });
  it("avisa que ya existe la cuenta", () => {
    expect(mensajeDeErrorDeCuenta({ code: "USER_ALREADY_EXISTS" })).toMatch(/Ya hay una cuenta/);
  });
  it("avisa del límite de intentos", () => {
    expect(mensajeDeErrorDeCuenta({ status: 429 })).toMatch(/demasiados intentos/);
  });
  it("usa un mensaje genérico en español para errores desconocidos", () => {
    expect(mensajeDeErrorDeCuenta({ code: "OTRA_COSA" })).toMatch(/No pudimos/);
    expect(mensajeDeErrorDeCuenta(null)).toMatch(/No pudimos/);
  });
});
