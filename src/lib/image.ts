/**
 * Reduz a foto antes do upload (lado maior até `maxSize` px, JPEG).
 * Fotos de celular têm 3–10 MB; comprimidas ficam ~300–600 KB, o que deixa o
 * envio rápido no 4G e converte HEIC (iPhone) para um formato que todo
 * navegador exibe. Se o navegador não conseguir ler a imagem, envia o original.
 */
export async function compressImage(file: File, maxSize = 1920, quality = 0.82): Promise<Blob> {
  try {
    // from-image: respeita a rotação gravada pela câmera (EXIF)
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Extensão segura a partir do tipo do arquivo (não confia no nome enviado). */
export function imageExtension(blob: Blob): string {
  switch (blob.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}
