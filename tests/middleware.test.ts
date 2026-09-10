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
});

describe("middleware", () => {
  it("deja pasar si no hay contraseña configurada", () => {
    expect(middleware(request()).status).toBe(200);
  });

  it("pide credenciales si faltan", () => {
    process.env.APP_PASSWORD = "panconpalta";
    const response = middleware(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("rechaza usuario o contraseña incorrectos", () => {
    process.env.APP_PASSWORD = "panconpalta";
    expect(middleware(request("admin:otra")).status).toBe(401);
    expect(middleware(request("otro:panconpalta")).status).toBe(401);
    expect(middleware(request("admin:")).status).toBe(401);
    expect(middleware(request("admin:panconpalta_")).status).toBe(401);
  });

  it("deja pasar con las credenciales correctas", () => {
    process.env.APP_PASSWORD = "panconpalta";
    expect(middleware(request("admin:panconpalta")).status).toBe(200);
  });

  it("admite dos puntos dentro de la contraseña", () => {
    process.env.APP_PASSWORD = "pan:con:palta";
    expect(middleware(request("admin:pan:con:palta")).status).toBe(200);
  });
});
