import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Add it to Vercel environment variables.' },
        { status: 500 }
      )
    }

    const { prompt, responseSchema } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const schemaInstruction = responseSchema
      ? `\n\nRespond ONLY with valid JSON. No markdown, no code blocks, no extra text. Use this exact structure:\n${JSON.stringify(responseSchema, null, 2)}`
      : ''

    const result = await model.generateContent(prompt + schemaInstruction)
    const text = result.response.text()

    // Try to parse as JSON if schema was provided
    if (responseSchema) {
      try {
        // Strip markdown code blocks if present
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleaned)
        return NextResponse.json({ data: parsed })
      } catch {
        // Return raw text so client can attempt parsing
        return NextResponse.json({ data: text })
      }
    }

    return NextResponse.json({ data: text })
  } catch (error) {
    console.error('AI API error:', error)
    const message = error instanceof Error ? error.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
