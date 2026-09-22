import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const EXTRACTION_SYSTEM_PROMPT = `You are a receipt parsing assistant. Given raw OCR text from a receipt, extract all line items and the total.

Return ONLY a valid JSON object with this exact structure:
{
  "items": [
    { "label": "Item name", "price": 4.99 }
  ],
  "detected_total": 42.50
}

Rules:
- Include every line item with a price
- Prices must be numbers, not strings
- If you cannot determine the total, sum the items and use that
- Do not include tax as a line item unless it appears as a separate charge
- Clean up garbled OCR text into readable item names
- Do not include any text outside the JSON object`;

/**
 * POST /api/split/receipt-scan
 * Accepts a base64 image, sends it to OpenRouter for structured extraction.
 * Falls back to text-only extraction if vision is not available.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Receipt scanning is not configured. Set OPENROUTER_API_KEY.' },
      { status: 503 },
    );
  }

  const body = await request.json();
  const { image } = body as { image: string };

  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Determine if image is a data URL or raw base64
  const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001',
        'X-Title': 'Click Split',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: 'Extract all line items and prices from this receipt. Return only the JSON object.',
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('OpenRouter error:', response.status, errBody);
      return NextResponse.json(
        { error: `LLM request failed: ${response.status}` },
        { status: 502 },
      );
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: 'Empty response from LLM' }, { status: 502 });
    }

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    const parsed = JSON.parse(jsonStr) as {
      items: Array<{ label: string; price: number }>;
      detected_total: number;
    };

    // Validate structure
    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: 'Invalid extraction result' }, { status: 502 });
    }

    return NextResponse.json({
      items: parsed.items.map((item) => ({
        label: String(item.label),
        price: Number(item.price),
      })),
      detected_total: Number(parsed.detected_total ?? parsed.items.reduce((sum, i) => sum + Number(i.price), 0)),
    });
  } catch (err) {
    console.error('Receipt scan error:', err);
    const message = err instanceof SyntaxError ? 'Failed to parse LLM response' : 'Receipt scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
