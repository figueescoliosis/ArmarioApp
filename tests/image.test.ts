import { describe, expect, it } from "vitest";
import { clampRect, type CropRect } from "../src/lib/image/crop";
import { orientationTransform, readExifOrientation, type ExifOrientation } from "../src/lib/image/exif";

describe("clampRect", () => {
  const IMG_W = 1000;
  const IMG_H = 800;

  it("no cambia un rectángulo que ya está dentro de los límites", () => {
    const rect: CropRect = { x: 10, y: 20, width: 100, height: 50 };
    expect(clampRect(rect, IMG_W, IMG_H)).toEqual(rect);
  });

  it("recorta x/y negativos al borde de la imagen", () => {
    const rect: CropRect = { x: -50, y: -30, width: 100, height: 100 };
    // El rectángulo ocupaba de -50 a 50 en x: tras el clamp, de 0 a 50.
    expect(clampRect(rect, IMG_W, IMG_H)).toEqual({ x: 0, y: 0, width: 50, height: 70 });
  });

  it("recorta el desbordamiento por la derecha y por abajo", () => {
    const rect: CropRect = { x: 950, y: 750, width: 100, height: 100 };
    expect(clampRect(rect, IMG_W, IMG_H)).toEqual({ x: 950, y: 750, width: 50, height: 50 });
  });

  it("redondea valores decimales hacia dentro del rectángulo", () => {
    const rect: CropRect = { x: 10.7, y: 10.2, width: 50.6, height: 50.6 };
    // x0=10.7 -> ceil = 11 ; x1 = 10.7+50.6=61.3 -> floor = 61 ; width = 50
    // y0=10.2 -> ceil = 11 ; y1 = 10.2+50.6=60.8 -> floor = 60 ; height = 49
    expect(clampRect(rect, IMG_W, IMG_H)).toEqual({ x: 11, y: 11, width: 50, height: 49 });
  });

  it("recorta un rectángulo mayor que la imagen a la imagen entera", () => {
    const rect: CropRect = { x: -100, y: -100, width: 5000, height: 5000 };
    expect(clampRect(rect, IMG_W, IMG_H)).toEqual({ x: 0, y: 0, width: IMG_W, height: IMG_H });
  });

  it("degenera a área cero cuando el rectángulo cae fuera de la imagen", () => {
    const rect: CropRect = { x: 2000, y: 2000, width: 100, height: 100 };
    const result = clampRect(rect, IMG_W, IMG_H);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe("orientationTransform", () => {
  const W = 300;
  const H = 200;

  it("la orientación 1 es la identidad y conserva las dimensiones", () => {
    const result = orientationTransform(1, W, H);
    expect(result.width).toBe(W);
    expect(result.height).toBe(H);
    expect(result.transform).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("las orientaciones 2, 3 y 4 conservan las dimensiones", () => {
    for (const o of [2, 3, 4] as ExifOrientation[]) {
      const result = orientationTransform(o, W, H);
      expect(result.width).toBe(W);
      expect(result.height).toBe(H);
    }
  });

  it("las orientaciones 5 a 8 intercambian ancho y alto", () => {
    for (const o of [5, 6, 7, 8] as ExifOrientation[]) {
      const result = orientationTransform(o, W, H);
      expect(result.width).toBe(H);
      expect(result.height).toBe(W);
    }
  });

  it("cada orientación produce una matriz de 6 componentes distinta cuando corresponde", () => {
    const seen = new Set<string>();
    for (const o of [1, 2, 3, 4, 5, 6, 7, 8] as ExifOrientation[]) {
      const { transform } = orientationTransform(o, W, H);
      expect(transform).toHaveLength(6);
      seen.add(transform.join(","));
    }
    // Las 8 orientaciones deben producir 8 matrices distintas.
    expect(seen.size).toBe(8);
  });
});

describe("readExifOrientation", () => {
  it("lee la orientación 6 de una cabecera JPEG+APP1+TIFF válida en little-endian", () => {
    const buffer = buildJpegWithOrientation(6, true);
    expect(readExifOrientation(buffer)).toBe(6);
  });

  it("lee la orientación 3 de una cabecera JPEG+APP1+TIFF válida en big-endian", () => {
    const buffer = buildJpegWithOrientation(3, false);
    expect(readExifOrientation(buffer)).toBe(3);
  });

  it("devuelve 1 para un buffer vacío", () => {
    expect(readExifOrientation(new ArrayBuffer(0))).toBe(1);
  });

  it("devuelve 1 para un PNG (sin marcador JPEG)", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(readExifOrientation(png.buffer)).toBe(1);
  });

  it("devuelve 1 para un JPEG sin segmento EXIF", () => {
    // SOI + un APP0 (JFIF) mínimo + SOS, sin ningún APP1.
    const bytes = [
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x10, // APP0, longitud 16
      0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
      0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xff, 0xda, 0x00, 0x00, // SOS (sin más datos, es suficiente para detenerse aquí)
    ];
    expect(readExifOrientation(new Uint8Array(bytes).buffer)).toBe(1);
  });
});

/**
 * Construye un ArrayBuffer mínimo con la estructura:
 * SOI, APP1 (firma Exif + cabecera TIFF con un IFD de una sola entrada:
 * Orientation), y SOS para cerrar. Suficiente para ejercitar el parser.
 */
function buildJpegWithOrientation(orientation: number, littleEndian: boolean): ArrayBuffer {
  const tiffHeaderSize = 8;
  const ifdEntryCount = 1;
  const ifdSize = 2 + ifdEntryCount * 12 + 4; // count + entradas + next-IFD offset
  const tiffSize = tiffHeaderSize + ifdSize;
  const exifSize = 6 + tiffSize; // "Exif\0\0" + TIFF
  const app1Length = 2 + exifSize; // longitud incluye sus propios 2 bytes

  const totalSize = 2 + 2 + 2 + app1Length + 2; // SOI + marker + length + payload + SOS
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint16(offset, 0xffd8); // SOI
  offset += 2;

  view.setUint16(offset, 0xffe1); // APP1 marker
  offset += 2;
  view.setUint16(offset, app1Length); // longitud del segmento (sin contar el marker)
  offset += 2;

  // Firma "Exif\0\0"
  const signature = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  for (const byte of signature) {
    view.setUint8(offset, byte);
    offset += 1;
  }

  const tiffStart = offset;
  view.setUint16(tiffStart, littleEndian ? 0x4949 : 0x4d4d, littleEndian);
  view.setUint16(tiffStart + 2, 42, littleEndian);
  view.setUint32(tiffStart + 4, 8, littleEndian); // el IFD empieza justo tras la cabecera de 8 bytes

  const ifdStart = tiffStart + 8;
  view.setUint16(ifdStart, ifdEntryCount, littleEndian);

  const entryStart = ifdStart + 2;
  view.setUint16(entryStart, 0x0112, littleEndian); // tag Orientation
  view.setUint16(entryStart + 2, 3, littleEndian); // tipo SHORT
  view.setUint32(entryStart + 4, 1, littleEndian); // count
  view.setUint16(entryStart + 8, orientation, littleEndian); // valor

  view.setUint32(entryStart + 12, 0, littleEndian); // offset al siguiente IFD (ninguno)

  offset = ifdStart + ifdSize;
  view.setUint16(offset, 0xffda); // SOS: fin de metadatos para el parser

  return buffer;
}
