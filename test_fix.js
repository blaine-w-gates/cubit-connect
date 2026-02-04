const MIN_DELAY_MS = 200;
let nextCallTime = 0;

const GemininService = {
  async enforceRateLimit() {
    const now = Date.now();
    const waitTime = Math.max(0, nextCallTime - now);
    nextCallTime = now + waitTime + MIN_DELAY_MS;

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  },
};

(async () => {
  const start = Date.now();
  const calls = [];

  console.log(`Starting 3 concurrent calls with ${MIN_DELAY_MS}ms delay...`);

  // Fire 3 calls "concurrently"
  for (let i = 0; i < 3; i++) {
    calls.push(
      GemininService.enforceRateLimit().then(() => {
        const finished = Date.now();
        console.log(`Call ${i} finished at ${finished - start}ms`);
        return finished;
      }),
    );
    await new Promise((r) => setTimeout(r, 10));
  }

  const times = await Promise.all(calls);
  times.sort((a, b) => a - b);

  console.log(
    'Sorted finish times:',
    times.map((t) => t - start),
  );

  let violated = false;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    console.log(`Gap between call ${i - 1} and ${i}: ${gap}ms`);
    if (gap < MIN_DELAY_MS * 0.8) {
      console.error(`VIOLATION: Gap ${gap}ms is too small (expected >= ${MIN_DELAY_MS}ms)`);
      violated = true;
    }
  }

  if (violated) {
    console.log('FAIL: Rate limit violated.');
    process.exit(1);
  } else {
    console.log('PASS: Rate limit respected.');
  }
})();
