import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const isWindows = process.platform === 'win32';
const gradle = isWindows ? 'gradlew.bat' : './gradlew';
const gradlePath = resolve(root, 'android', gradle);

if (!existsSync(gradlePath)) {
  console.error(`Capacitor Android Gradle wrapper not found: ${gradlePath}`);
  process.exit(1);
}

function run(command, args, cwd = root) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android']);
run(gradlePath, ['assembleDebug', '--no-daemon', '--stacktrace'], resolve(root, 'android'));

const apk = resolve(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(apk)) {
  console.error(`Android build completed without producing the expected APK: ${apk}`);
  process.exit(1);
}

console.log(`VOW Android APK built successfully: ${apk}`);
