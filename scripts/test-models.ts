import { GoogleGenerativeAI } from '@google/generative-ai';

const MODELS = {
  LITE: 'gemini-3.1-flash-lite-preview',
  FULL: 'gemini-3-flash-preview',
};

const TEST_PROMPT = `Generate 3 simple tasks for learning JavaScript. Format as JSON array with task_name and description fields.`;

async function testModel(apiKey: string, modelName: string, label: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const startTime = Date.now();
  try {
    const result = await model.generateContent(TEST_PROMPT);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const response = result.response;
    const text = response.text();

    // Try to parse to verify valid JSON
    JSON.parse(text);

    return {
      model: label,
      name: modelName,
      duration,
      success: true,
      responseLength: text.length,
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      model: label,
      name: modelName,
      duration: endTime - startTime,
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function runModelComparison(apiKey: string) {
  console.log('🧪 Starting model comparison test...\n');

  const results = [];

  // Test 1: Lite model (now primary)
  console.log(`Testing ${MODELS.LITE}...`);
  const liteResult = await testModel(apiKey, MODELS.LITE, 'LITE (Primary)');
  results.push(liteResult);
  console.log(`  ✅ ${liteResult.duration}ms - ${liteResult.success ? 'SUCCESS' : 'FAILED'}`);

  // Wait 2 seconds between tests
  await new Promise(r => setTimeout(r, 2000));

  // Test 2: Full model (now fallback)
  console.log(`Testing ${MODELS.FULL}...`);
  const fullResult = await testModel(apiKey, MODELS.FULL, 'FULL (Fallback)');
  results.push(fullResult);
  console.log(`  ✅ ${fullResult.duration}ms - ${fullResult.success ? 'SUCCESS' : 'FAILED'}`);

  console.log('\n📊 RESULTS:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    console.log(`${r.model} (${r.name}):`);
    console.log(`  Duration: ${r.duration}ms`);
    console.log(`  Status: ${r.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (r.error) console.log(`  Error: ${r.error}`);
    console.log('');
  });

  const winner = results
    .filter(r => r.success)
    .sort((a, b) => a.duration - b.duration)[0];

  if (winner) {
    console.log(`🏆 FASTEST: ${winner.model} - ${winner.duration}ms`);
  }

  return results;
}

// CLI usage
if (require.main === module) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY not set');
    process.exit(1);
  }
  runModelComparison(apiKey);
}
