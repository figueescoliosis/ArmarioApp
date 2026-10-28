import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function request(credentials?: string) {
  return new NextRequest("https://armario.test/armario", {
    headers: credentials ? { authorization: `Basic ${btoa(credentials)}` } : undefined,
  });
}

afterEach(() => {
  delete process.env.APP_PASSWORD;
  delete process.env.APP_USER;
});

describe("middleware", () => {
  it("deja pasar si no hay contraseña configurada", () => {
    expect(middleware(request()).status).toBe(200);
  });

  it("pide credenciales si faltan", () => {
    process.env.APP_PASSWORD = "clave-de-prueba";
    const response = middleware(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("rechaza usuario o contraseña incorrectos", () => {
    process.env.APP_PASSWORD = "clave-de-prueba";
    expect(middleware(request("admin:otra")).status).toBe(401);
    expect(middleware(request("otro:clave-de-prueba")).status).toBe(401);
    expect(middleware(request("admin:")).status).toBe(401);
    expect(middleware(request("admin:clave-de-prueba_")).status).toBe(401);
  });

  it("deja pasar con las credenciales correctas", () => {
    process.env.APP_PASSWORD = "clave-de-prueba";
    expect(middleware(request("admin:clave-de-prueba")).status).toBe(200);
  });

  it("usa el usuario de APP_USER cuando está configurado", () => {
    process.env.APP_PASSWORD = "clave-de-prueba";
    process.env.APP_USER = "otro-usuario";
    expect(middleware(request("otro-usuario:clave-de-prueba")).status).toBe(200);
    expect(middleware(request("admin:clave-de-prueba")).status).toBe(401);
  });

  it("admite dos puntos dentro de la contraseña", () => {
    process.env.APP_PASSWORD = "pan:con:palta";
    expect(middleware(request("admin:pan:con:palta")).status).toBe(200);
  });
});

describe("middleware con dos armarios", () => {
  function owner(response: Response) {
    return response.headers.get("x-middleware-request-x-owner-id");
  }

  afterEach(() => {
    delete process.env.APP_USER_2;
    delete process.env.APP_PASSWORD_2;
  });

  it("cada usuario entra en su armario", () => {
    process.env.APP_PASSWORD = "clave-uno";
    process.env.APP_USER_2 = "Benja";
    process.env.APP_PASSWORD_2 = "clave-dos";

    expect(owner(middleware(request("admin:clave-uno")))).toBe("default");
    expect(owner(middleware(request("Benja:clave-dos")))).toBe("benja");
  });

  it("no cruza usuarios y contraseñas", () => {
    process.env.APP_PASSWORD = "clave-uno";
    process.env.APP_USER_2 = "Benja";
    process.env.APP_PASSWORD_2 = "clave-dos";

    expect(middleware(request("admin:clave-dos")).status).toBe(401);
    expect(middleware(request("Benja:clave-uno")).status).toBe(401);
  });

  it("ignora un x-owner-id mandado por el cliente", () => {
    process.env.APP_PASSWORD = "clave-uno";
    process.env.APP_USER_2 = "Benja";
    process.env.APP_PASSWORD_2 = "clave-dos";

    const forged = new NextRequest("https://armario.test/api/garments", {
      headers: { authorization: `Basic ${btoa("admin:clave-uno")}`, "x-owner-id": "benja" },
    });
    expect(owner(middleware(forged))).toBe("default");

    // Y en local, sin contraseña, tampoco.
    delete process.env.APP_PASSWORD;
    const local = new NextRequest("https://armario.test/api/garments", {
      headers: { "x-owner-id": "benja" },
    });
    expect(owner(middleware(local))).toBe("default");
  });
});
