#!/usr/bin/env node
const base = "http://127.0.0.1:11434";
const model = "gemma3:1b";

async function main() {
  let tagsResponse;
  try {
    tagsResponse = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2500) });
  } catch {
    console.error("Ollama is not reachable at 127.0.0.1:11434. Start Ollama, then retry.");
    process.exitCode = 1;
    return;
  }
  if (!tagsResponse.ok) {
    console.error(`Ollama tags endpoint returned HTTP ${tagsResponse.status}.`);
    process.exitCode = 1;
    return;
  }
  const tags = await tagsResponse.json();
  const models = Array.isArray(tags.models) ? tags.models.map((item) => item.name) : [];
  if (!models.some((name) => name === model || name.startsWith(`${model}:`))) {
    console.error(`Model ${model} is not installed. Run: ollama pull ${model}`);
    console.error(`Available models: ${models.join(", ") || "(none)"}`);
    process.exitCode = 1;
    return;
  }
  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model,
      stream: false,
      prompt: "In one sentence, explain why a developer should rotate a credential accidentally committed to a public repository. Do not provide any example credential.",
      options: { num_predict: 100, temperature: 0.2 },
    }),
  });
  if (!response.ok) {
    console.error(`Ollama generation failed with HTTP ${response.status}.`);
    process.exitCode = 1;
    return;
  }
  const result = await response.json();
  if (result.done !== true || typeof result.response !== "string" || !result.response.trim()) {
    console.error("Ollama did not return a completed model response.");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: ${model} is installed and local inference completed.`);
  console.log("Sample response:", result.response.trim().slice(0, 1000));
}
main().catch((error) => {
  console.error("Local model smoke test failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
