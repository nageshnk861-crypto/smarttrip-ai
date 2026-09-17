import { NextResponse } from 'next/server';
import { OpenAI } from 'lib/ai'; // Assuming you have an AI library to interact with OpenAI

export async function POST(request) {
    const { prompt } = await request.json();

    if (!prompt) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    try {
        const response = await OpenAI.generateResponse(prompt); // Function to call OpenAI API
        return NextResponse.json(response);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
    }
}