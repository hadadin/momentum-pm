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

    const schemaInstruction = responseSchema
      ? `\n\nYou MUST respond with ONLY valid JSON — no markdown, no code blocks, no explanation. Use exactly this structure:\n${JSON.stringify(responseSchema, null, 2)}`
      : ''

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt + schemaInstruction }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    )

    const geminiData = await response.json()

    if (!response.ok) {
      const errMsg =
        geminiData?.error?.message || `Gemini API error: ${response.status}`
      return NextResponse.json({ error: errMsg }, { status: response.status })
    }

    const text: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (responseSchema) {
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleaned)
        return NextResponse.json({ data: parsed })
      } catch {
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
