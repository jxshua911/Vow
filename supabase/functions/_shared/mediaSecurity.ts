export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "m4v",
]);

const FORBIDDEN_EXTENSIONS = new Set([
  "php", "phtml", "php3", "php4", "php5", "php7", "php8",
  "jsp", "jspx", "asp", "aspx", "cgi", "exe", "dll",
  "sh", "bash", "bat", "cmd", "jar", "html", "htm", "svg",
]);

function extension(name: string) {
  const clean = name.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return clean.includes(".") ? clean.split(".").pop() ?? "" : "";
}

function bytesStartWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasMagicBytes(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/gif") return bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
    || bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  if (mime === "image/webp") {
    return bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  }
  if (mime === "video/webm") {
    return bytesStartWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  }
  if (mime === "video/mp4" || mime === "video/quicktime") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  }
  return false;
}

export async function validateMediaFile(file: File) {
  const ext = extension(file.name);
  if (!ext || FORBIDDEN_EXTENSIONS.has(ext) || !EXTENSIONS.has(ext)) {
    throw new Error("MEDIA_TYPE_NOT_ALLOWED");
  }
  if (!ALLOWED_MEDIA_TYPES.has(file.type.toLowerCase())) {
    throw new Error("MEDIA_MIME_NOT_ALLOWED");
  }
  if (file.size <= 0 || file.size > MAX_MEDIA_BYTES) {
    throw new Error("MEDIA_SIZE_NOT_ALLOWED");
  }

  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (!hasMagicBytes(header, file.type.toLowerCase())) {
    throw new Error("MEDIA_SIGNATURE_MISMATCH");
  }

  if ((ext === "mov" || ext === "m4v") && file.type !== "video/quicktime" && file.type !== "video/mp4") {
    throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");
  }
  if (ext === "mp4" && file.type !== "video/mp4") throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");
  if (ext === "webm" && file.type !== "video/webm") throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");
  if (["jpg", "jpeg"].includes(ext) && file.type !== "image/jpeg") throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");
  if (ext === "png" && file.type !== "image/png") throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");
  if (ext === "webp" && file.type !== "image/webp") throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");
  if (ext === "gif" && file.type !== "image/gif") throw new Error("MEDIA_EXTENSION_MIME_MISMATCH");

  return {
    mimeType: file.type.toLowerCase(),
    extension: ext,
    size: file.size,
  };
}
