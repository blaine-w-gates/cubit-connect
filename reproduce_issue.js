const MIN_DELAY_MS = 200; // Use smaller delay for faster test, but enough to measure
let lastCallTime = 0;

const GeminiService = {
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    // console.log(`Call starting. Now: ${now}, Last: ${lastCallTime}, Diff: ${timeSinceLastCall}`);
    if (timeSinceLastCall < MIN_DELAY_MS) {
      const wait = MIN_DELAY_MS - timeSinceLastCall;
      // console.log(`Waiting ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastCallTime = Date.now();
    // console.log(`Call allowed. Updated Last: ${lastCallTime}`);
  },
};

(async () => {
  const start = Date.now();
  const calls = [];

  console.log(`Starting 3 concurrent calls with ${MIN_DELAY_MS}ms delay...`);

  // Fire 3 calls "concurrently"
  for (let i = 0; i < 3; i++) {
    calls.push(
      GeminiService.enforceRateLimit().then(() => {
        const finished = Date.now();
        console.log(`Call ${i} finished at ${finished - start}ms`);
        return finished;
      }),
    );
    // Small yield to ensure they start in order but rapidly
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
      // Allow some margin
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
