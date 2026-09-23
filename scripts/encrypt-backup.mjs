import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";

const [, , input, output] = process.argv;

if (!input || !output) {
  console.error("Usage: node scripts/encrypt-backup.mjs <input-file> <output-file>");
  process.exit(2);
}

const passphrase = process.env.VOW_BACKUP_PASSPHRASE;
if (!passphrase || passphrase.length < 16) {
  console.error("VOW_BACKUP_PASSPHRASE must be set and contain at least 16 characters.");
  process.exit(2);
}

const info = await stat(input);
if (!info.isFile()) {
  console.error(`Input is not a regular file: ${input}`);
  process.exit(2);
}

const salt = randomBytes(16);
const iv = randomBytes(12);
const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1 });
const cipher = createCipheriv("aes-256-gcm", key, iv);

const out = createWriteStream(output, { flags: "wx" });

// VOWBKP1 | salt(16) | iv(12) | ciphertext | authTag(16)
out.write(Buffer.from("VOWBKP1", "ascii"));
out.write(salt);
out.write(iv);

await new Promise((resolve, reject) => {
  const inputStream = createReadStream(input);
  inputStream.on("error", reject);
  out.on("error", reject);
  out.on("finish", resolve);
  inputStream.pipe(cipher).pipe(out, { end: false });
  cipher.on("end", () => {
    try {
      out.write(cipher.getAuthTag());
      out.end();
    } catch (error) {
      reject(error);
    }
  });
});

console.log(`Encrypted backup written: ${output}`);
console.log(`Plaintext size: ${info.size} bytes`);
