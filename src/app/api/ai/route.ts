import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function POST(req: NextRequest) {
  try {
    const { prompt, responseSchema } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const schemaInstruction = responseSchema
      ? `\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(responseSchema, null, 2)}\n\nReturn ONLY the JSON, no markdown, no code blocks, no extra text.`
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
        return NextResponse.json({ data: null, raw: text, error: 'Failed to parse AI response as JSON' })
      }
    }

    return NextResponse.json({ data: text })
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    )
  }
}
