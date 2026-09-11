import { afterEach, describe, expect, it } from "vitest";
import { guardarTema, leerTema } from "@/lib/tema";

function localStorageFalso() {
  const datos = new Map<string, string>();
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      datos.set(clave, valor);
    },
  };
}

const original = globalThis.localStorage;

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
});

describe("leerTema", () => {
  it("devuelve 'sistema' si no hay localStorage", () => {
    // @ts-expect-error -- se simula un entorno de servidor sin localStorage
    delete globalThis.localStorage;
    expect(leerTema()).toBe("sistema");
  });

  it("devuelve 'sistema' si el valor guardado no es válido", () => {
    const fake = localStorageFalso();
    fake.setItem("armario:tema", "fucsia");
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    expect(leerTema()).toBe("sistema");
  });

  it("devuelve 'oscuro' si está guardado", () => {
    const fake = localStorageFalso();
    fake.setItem("armario:tema", "oscuro");
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    expect(leerTema()).toBe("oscuro");
  });
});

describe("guardarTema", () => {
  it("deja el valor y leerTema lo lee de vuelta", () => {
    const fake = localStorageFalso();
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    guardarTema("claro");
    expect(leerTema()).toBe("claro");
  });

  it("no propaga si localStorage.setItem lanza", () => {
    const fake = {
      getItem: () => null,
      setItem: () => {
        throw new Error("cuota excedida");
      },
    };
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    expect(() => guardarTema("oscuro")).not.toThrow();
  });
});
