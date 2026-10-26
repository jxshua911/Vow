import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const gradleCommand = isWindows ? 'gradlew.bat' : './gradlew';

const result = spawnSync(gradleCommand, ['assembleDebug'], {
  cwd: resolve(root, 'android'),
  stdio: 'inherit',
  shell: isWindows,
});

if (result.error) {
  console.error(`Could not start the Android Gradle wrapper: ${result.error.message}`);
  process.exit(1);
}

if (result.signal) {
  console.error(`Android Gradle build was terminated by signal ${result.signal}.`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Android debug APK build failed with exit code ${result.status ?? 1}.`);
  process.exit(result.status ?? 1);
}

console.log('Android debug APK created at android/app/build/outputs/apk/debug/app-debug.apk');
