import { OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_SYSTEM_PROMPT, OLLAMA_TIMEOUT_MS } from './config';

type OllamaMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type OllamaResponse = {
  message?: { content?: string };
};

export async function askOllama(
  prompt: string,
  systemPrompt: string = OLLAMA_SYSTEM_PROMPT,
): Promise<string> {
  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const data = (await response.json()) as OllamaResponse;
  return data.message?.content?.trim() ?? '';
}
