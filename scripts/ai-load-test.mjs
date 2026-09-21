const url = process.env.VOW_AI_URL;
const token = process.env.VOW_AI_TOKEN;
const concurrency = Math.max(1, Number(process.env.VOW_LOAD_CONCURRENCY || 5));
const total = Math.max(concurrency, Number(process.env.VOW_LOAD_REQUESTS || 25));

if (!url || !token) {
  console.error("Set VOW_AI_URL and VOW_AI_TOKEN before running the AI load test.");
  process.exit(1);
}

const payload = JSON.stringify({
  mode: "chat",
  message: "Load-test request: respond with a short health check.",
  context: {},
});

let cursor = 0;
let failures = 0;
let successes = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= total) return;
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });
      const elapsed = Date.now() - started;
      if (response.ok) {
        successes++;
        console.log(`#${index + 1} ${response.status} ${elapsed}ms`);
      } else {
        failures++;
        console.log(`#${index + 1} ${response.status} ${elapsed}ms`);
      }
    } catch (error) {
      failures++;
      console.log(`#${index + 1} network-error ${String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
console.log(JSON.stringify({ total, concurrency, successes, failures }));
if (failures > 0) process.exit(2);
