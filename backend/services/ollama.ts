/**
 * Ollama AI LLM Service
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_SYSTEM_PROMPT =
  process.env.OLLAMA_SYSTEM_PROMPT ||
  'You are SmartTrip AI, an intelligent travel planning assistant. Give practical, concise, and budget-aware travel advice.';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function askOllama(
  prompt: string,
  systemPrompt: string = OLLAMA_SYSTEM_PROMPT,
): Promise<string> {
  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || '';
  } catch (error) {
    console.warn('Ollama unavailable, falling back to local guidance:', error instanceof Error ? error.message : error);
    return `Travel advice for your trip: Plan local transport early, ensure appropriate weather gear, and visit key cultural sights in the morning to avoid peak afternoon crowds.`;
  }
}
