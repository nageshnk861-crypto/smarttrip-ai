import { OPENAI_API_URL, OPENAI_MODEL } from './config';

export class OpenAI {
  static async generateResponse(prompt: string) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('AI assistant is not configured.');
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
      }),
    });

    if (!response.ok) {
      throw new Error('AI assistant is currently unavailable.');
    }

    const data = (await response.json()) as { output_text?: string };
    return { text: data.output_text ?? '', prompt };
  }
}

export default OpenAI;
