import { assertEquals, assertRejects } from "jsr:@std/assert";
import { validateMediaFile } from "../functions/_shared/mediaSecurity.ts";

function file(name: string, type: string, bytes: number[]) {
  return new File([new Uint8Array(bytes)], name, { type });
}

Deno.test("accepts a real JPEG", async () => {
  const result = await validateMediaFile(file("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0]));
  assertEquals(result.mimeType, "image/jpeg");
});

Deno.test("rejects PHP even when browser MIME claims JPEG", async () => {
  await assertRejects(
    () => validateMediaFile(file("photo.php", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0])),
    Error,
    "MEDIA_TYPE_NOT_ALLOWED",
  );
});

Deno.test("rejects JSP even when browser MIME claims JPEG", async () => {
  await assertRejects(
    () => validateMediaFile(file("photo.jsp", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0])),
    Error,
    "MEDIA_TYPE_NOT_ALLOWED",
  );
});

Deno.test("rejects renamed executable content", async () => {
  await assertRejects(
    () => validateMediaFile(file("photo.jpg", "image/jpeg", [0x4d, 0x5a, 0x90, 0x00])),
    Error,
    "MEDIA_SIGNATURE_MISMATCH",
  );
});

Deno.test("rejects oversized media", async () => {
  const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" });
  await assertRejects(() => validateMediaFile(oversized), Error, "MEDIA_SIZE_NOT_ALLOWED");
});
