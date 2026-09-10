/**
 * Lectura manual de la orientación EXIF de un JPEG.
 *
 * Los navegadores modernos ya aplican la orientación automáticamente al
 * decodificar con `createImageBitmap(file, { imageOrientation: "from-image" })`,
 * así que en el camino feliz (`prepare.ts`) no hace falta nada de esto. Este
 * módulo existe como respaldo para navegadores/casos donde esa opción no está
 * disponible: ahí hay que leer la etiqueta a mano y aplicar la transformación
 * nosotros mismos antes de dibujar en el canvas. No es código duplicado, es
 * el camino de repuesto para cuando el atajo del navegador no existe.
 */

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const VALID_ORIENTATIONS: readonly ExifOrientation[] = [1, 2, 3, 4, 5, 6, 7, 8];

function isValidOrientation(n: number): n is ExifOrientation {
  return (VALID_ORIENTATIONS as readonly number[]).includes(n);
}

/**
 * Busca el marcador APP1 con firma "Exif", localiza la cabecera TIFF y
 * extrae el valor de la etiqueta 0x0112 (Orientation). Devuelve 1 (normal)
 * ante cualquier estructura inesperada: un JPEG sin EXIF, un PNG, o un
 * buffer corrupto nunca deben hacer fallar la preparación de la imagen.
 */
export function readExifOrientation(buffer: ArrayBuffer): ExifOrientation {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4) return 1;
    // Todo JPEG empieza por el marcador SOI 0xFFD8.
    if (view.getUint16(0) !== 0xffd8) return 1;

    let offset = 2;
    // Recorremos los segmentos del JPEG buscando el APP1 (0xFFE1) que
    // contiene los metadatos EXIF. Un JPEG tiene muchos segmentos (APP0
    // con el JFIF, DQT, DHT...) antes de llegar a los datos de imagen.
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      // Los marcadores válidos empiezan por 0xFF; si no, la estructura no
      // es la esperada y abandonamos sin lanzar.
      if ((marker & 0xff00) !== 0xff00) return 1;
      // SOS (Start of Scan) marca el final de los metadatos: a partir de
      // aquí solo hay datos de píxeles, no hay más segmentos que mirar.
      if (marker === 0xffda) return 1;

      const segmentLength = view.getUint16(offset + 2);
      const segmentStart = offset + 4;

      if (marker === 0xffe1) {
        const orientation = readOrientationFromApp1(view, segmentStart, segmentLength - 2);
        if (orientation !== null) return orientation;
      }

      offset = segmentStart + (segmentLength - 2);
    }
    return 1;
  } catch {
    // Cualquier lectura fuera de rango se traduce en "sin orientación".
    return 1;
  }
}

/** Lee el bloque APP1 ya localizado y devuelve la orientación, o null si no la hay. */
function readOrientationFromApp1(
  view: DataView,
  start: number,
  length: number,
): ExifOrientation | null {
  if (start + 6 > view.byteLength || length < 6) return null;
  // La firma debe ser exactamente "Exif\0\0".
  const signature = [
    view.getUint8(start),
    view.getUint8(start + 1),
    view.getUint8(start + 2),
    view.getUint8(start + 3),
    view.getUint8(start + 4),
    view.getUint8(start + 5),
  ];
  const expected = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  for (let i = 0; i < expected.length; i++) {
    if (signature[i] !== expected[i]) return null;
  }

  const tiffStart = start + 6;
  if (tiffStart + 8 > view.byteLength) return null;

  const byteOrderMark = view.getUint16(tiffStart);
  let littleEndian: boolean;
  if (byteOrderMark === 0x4949) {
    littleEndian = true; // "II"
  } else if (byteOrderMark === 0x4d4d) {
    littleEndian = false; // "MM"
  } else {
    return null;
  }

  // Los siguientes dos bytes son el número mágico 42, y después viene el
  // offset (relativo al inicio de la cabecera TIFF) al primer IFD.
  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + firstIfdOffset;
  if (ifdStart + 2 > view.byteLength) return null;

  const entryCount = view.getUint16(ifdStart, littleEndian);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x0112) {
      // El valor de Orientation es un SHORT (2 bytes) almacenado en los
      // primeros 2 bytes del campo de valor de 4 bytes de la entrada.
      const value = view.getUint16(entryOffset + 8, littleEndian);
      return isValidOrientation(value) ? value : null;
    }
  }
  return null;
}

/**
 * Matriz de transformación (para `ctx.setTransform`) y dimensiones
 * resultantes para cada una de las 8 orientaciones EXIF. Es pura: no toca
 * el DOM ni el canvas, solo hace aritmética, así que es la pieza que se
 * testea a fondo.
 *
 * La matriz se aplica ANTES de dibujar la imagen con sus dimensiones
 * originales (w, h) en el canvas ya redimensionado a (width, height).
 */
export function orientationTransform(
  o: ExifOrientation,
  w: number,
  h: number,
): { width: number; height: number; transform: [number, number, number, number, number, number] } {
  switch (o) {
    case 1:
      return { width: w, height: h, transform: [1, 0, 0, 1, 0, 0] };
    case 2:
      // Espejo horizontal.
      return { width: w, height: h, transform: [-1, 0, 0, 1, w, 0] };
    case 3:
      // 180°.
      return { width: w, height: h, transform: [-1, 0, 0, -1, w, h] };
    case 4:
      // Espejo vertical.
      return { width: w, height: h, transform: [1, 0, 0, -1, 0, h] };
    case 5:
      // Espejo horizontal + 90° horario (dimensiones intercambiadas).
      return { width: h, height: w, transform: [0, 1, 1, 0, 0, 0] };
    case 6:
      // 90° horario.
      return { width: h, height: w, transform: [0, 1, -1, 0, h, 0] };
    case 7:
      // Espejo horizontal + 90° antihorario.
      return { width: h, height: w, transform: [0, -1, -1, 0, h, w] };
    case 8:
      // 90° antihorario.
      return { width: h, height: w, transform: [0, -1, 1, 0, 0, w] };
  }
}
