import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/ping/route";
import { config } from "@/middleware";

function request(authorization?: string) {
  return new Request("https://armario.test/api/cron/ping", {
    headers: authorization ? { authorization } : undefined,
  });
}

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("cron de latido", () => {
  it("exige CRON_SECRET configurado", async () => {
    const response = await GET(request("Bearer x"));
    expect(response.status).toBe(503);
  });

  it("rechaza un secreto incorrecto o ausente", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer otro"))).status).toBe(401);
  });

  it("solo la ruta de cron se salta el Basic Auth", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/api/cron/ping")).toBe(false);
    expect(matcher.test("/api/garments")).toBe(true);
    expect(matcher.test("/armario")).toBe(true);
  });
});
