import { afterEach, describe, expect, it, vi } from "vitest";
import { seasonFor, sourceFor, weatherFor } from "@/lib/weather";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("seasonFor", () => {
  it("da la temporada por meses en el hemisferio norte", () => {
    expect(seasonFor("2026-01-15", 40)).toBe("invierno");
    expect(seasonFor("2026-04-15", 40)).toBe("primavera");
    expect(seasonFor("2026-07-15", 40)).toBe("verano");
    expect(seasonFor("2026-12-01", 40)).toBe("invierno");
  });

  it("le da la vuelta en el hemisferio sur", () => {
    expect(seasonFor("2026-01-15", -33)).toBe("verano");
    expect(seasonFor("2026-07-15", -33)).toBe("invierno");
    expect(seasonFor("2026-10-28", -33)).toBe("primavera");
  });
});

describe("sourceFor", () => {
  it("usa la previsión hasta quince días vista", () => {
    expect(sourceFor("2026-11-12", "2026-10-28")).toEqual({ kind: "forecast", day: "2026-11-12" });
  });

  it("más lejos usa el mismo día de un año con datos", () => {
    expect(sourceFor("2026-12-24", "2026-10-28")).toEqual({ kind: "archive", day: "2025-12-24" });
    expect(sourceFor("2027-11-01", "2026-10-28")).toEqual({ kind: "archive", day: "2025-11-01" });
  });
});

describe("weatherFor", () => {
  function mockOpenMeteo(daily: Record<string, Array<number | null>>) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ daily }),
    } as Response);
  }

  it("convierte la previsión en temperatura y temporada para el motor", async () => {
    const fetchSpy = mockOpenMeteo({
      apparent_temperature_max: [24.4],
      apparent_temperature_min: [11.2],
      precipitation_probability_max: [70],
    });

    const weather = await weatherFor("2026-11-02", { lat: -33.45, lon: -70.66, name: "Santiago" }, "2026-10-28");

    expect(weather).toEqual({
      day: "2026-11-02",
      tempC: 18,
      minC: 11,
      maxC: 24,
      rainProbability: 70,
      season: "primavera",
      place: "Santiago",
      estimated: false,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("api.open-meteo.com/v1/forecast");
  });

  it("marca como estimado lo que sale del archivo", async () => {
    const fetchSpy = mockOpenMeteo({ apparent_temperature_max: [30], apparent_temperature_min: [16] });

    const weather = await weatherFor("2027-01-10", { lat: -33.45, lon: -70.66, name: null }, "2026-10-28");

    expect(weather.estimated).toBe(true);
    expect(weather.rainProbability).toBeNull();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("start_date=2026-01-10");
  });

  it("falla con un error legible si no hay datos", async () => {
    mockOpenMeteo({ apparent_temperature_max: [null], apparent_temperature_min: [null] });
    await expect(
      weatherFor("2026-11-02", { lat: 40, lon: -3, name: null }, "2026-10-28"),
    ).rejects.toThrow("No hay datos del tiempo");
  });
});
