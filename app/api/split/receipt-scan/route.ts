import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const EXTRACTION_SYSTEM_PROMPT = `You are a professional receipt OCR and parsing assistant.
Given one or more ordered images of the same receipt, extract:
1. "merchant": The store, restaurant, or business name (e.g. "Safeway", "Trader Joe's", "Target", "Starbucks").
2. "date": Date of purchase in YYYY-MM-DD format if visible, or null.
3. "items": All purchased line items. For each item:
   - "label": Clean, human-readable item name (remove barcode numbers/SKUs).
   - "price": The final amount paid for this item (as a number). If both regular price and discounted/member price appear, use the final discounted price paid.
4. "tax": Sales tax amount as a number if itemized, otherwise 0.
5. "tip": Tip or gratuity amount as a number if itemized, otherwise 0.
6. "detected_total": The final total / balance charged to the customer.

Return ONLY a valid JSON object matching this structure:
{
  "merchant": "Safeway",
  "date": "2026-09-21",
  "items": [
    { "label": "Item name", "price": 4.99 }
  ],
  "tax": 0.03,
  "tip": 0.00,
  "detected_total": 42.50
}

Rules:
- The images are ordered from the top of the receipt to the bottom.
- Adjacent images may overlap. Do not double-count a line item merely because the same printed line appears in overlapping photos.
- Preserve legitimate repeated purchases when they are separate printed occurrences on the receipt.
- Prefer merchant/date metadata from the clearest page and tax/tip/final total from the bottom-most page where those fields appear.
- Include every distinct purchased line item.
- Do not include subtotal, total, tax, tip, or payment lines as items.
- Prices must be positive decimal numbers.
- Return ONLY the JSON object.`;

const TEXT_EXTRACTION_SYSTEM_PROMPT = `You are a professional receipt parser.
Given raw OCR text lines from a receipt, extract:
1. "merchant": The store, restaurant, or business name (e.g. "Safeway", "Trader Joe's", "Target", "Starbucks").
2. "date": Date of purchase in YYYY-MM-DD format if visible, or null.
3. "items": All purchased line items. For each item:
   - "label": Clean, human-readable item name without barcodes or trailing item codes.
   - "price": The final amount paid for this item (as a number). If both regular price and discounted/member price appear, use the final discounted price paid.
4. "tax": Sales tax amount as a number if itemized, otherwise 0.
5. "tip": Tip or gratuity amount as a number if itemized, otherwise 0.
6. "detected_total": The final total / balance charged to the customer.

Return ONLY a valid JSON object matching this structure:
{
  "merchant": "Safeway",
  "date": "2026-09-21",
  "items": [
    { "label": "Item name", "price": 4.99 }
  ],
  "tax": 0.03,
  "tip": 0.00,
  "detected_total": 42.50
}

Rules:
- The OCR text may contain multiple page sections for one long receipt, in top-to-bottom order.
- Adjacent sections may repeat overlapping lines. Do not double-count overlap.
- Preserve legitimate repeated purchases when they are separate printed occurrences.
- Prefer tax, tip, and final total from the last page where those values appear.
- Include every distinct purchased line item.
- Do not include subtotal, tax, tip, total, or payment lines as items.
- If a line has a discount or savings listed directly under it, apply the discount so the item price is the actual net paid amount.
- Prices must be positive decimal numbers.
- Return ONLY the JSON object.`;

/**
 * POST /api/split/receipt-scan
 * Accepts either:
 * - { raw_text: string } (Extracted locally via Apple Vision OCR, formatted by Gemini 3.5 Flash Lite in <500ms)
 * - { image: string } (single base64 image)
 * - { images: string[] } (2-10 ordered base64 images for one long receipt)
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

  let user = null;
  if (bearerToken) {
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (!error && data?.user) {
      user = data.user;
    }
  }

  if (!user) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openRouterKey && !geminiKey) {
    return NextResponse.json(
      { error: 'Receipt scanning is not configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.' },
      { status: 503 },
    );
  }

  const body = await request.json();
  const { image, images, raw_text } = body as {
    image?: string;
    images?: string[];
    raw_text?: string;
  };

  const receiptImages = Array.isArray(images)
    ? images.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : image
      ? [image]
      : [];

  if (receiptImages.length > 10) {
    return NextResponse.json({ error: 'A receipt scan can include at most 10 images.' }, { status: 400 });
  }

  if (receiptImages.length === 0 && !raw_text) {
    return NextResponse.json({ error: 'No image, images, or raw_text provided' }, { status: 400 });
  }

  let content: string | undefined;

  // ─────────────────────────────────────────────────────────────
  // PATH A: Fast Raw OCR Text Formatting (from Apple Vision OCR)
  // ─────────────────────────────────────────────────────────────
  if (raw_text && raw_text.trim().length > 0) {
    // 1. Direct AI Studio Gemini text completion
    if (geminiKey) {
      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
      for (const model of candidateModels) {
        try {
          const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(aiStudioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: `${TEXT_EXTRACTION_SYSTEM_PROMPT}\n\n--- RAW RECEIPT OCR TEXT ---\n${raw_text}` },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: 'application/json',
                max_output_tokens: 3000,
              },
            }),
            signal: AbortSignal.timeout(15_000),
          });

          if (res.ok) {
            const json = await res.json() as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (content) break;
          }
        } catch (err) {
          console.warn(`AI Studio text formatting ${model} failed:`, err);
        }
      }
    }

    // 2. OpenRouter text completion fallback
    if (!content && openRouterKey) {
      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL ?? 'https://split.joinclick.co',
            'X-Title': 'Click Split',
          },
          body: JSON.stringify({
            model: 'google/gemini-3.5-flash-lite',
            max_tokens: 1500,
            messages: [
              { role: 'system', content: TEXT_EXTRACTION_SYSTEM_PROMPT },
              { role: 'user', content: `--- RAW RECEIPT OCR TEXT ---\n${raw_text}` },
            ],
          }),
          signal: AbortSignal.timeout(20_000),
        });

        if (response.ok) {
          const json = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          content = json.choices?.[0]?.message?.content?.trim();
        }
      } catch (openRouterErr) {
        console.warn('OpenRouter raw_text formatting error:', openRouterErr);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PATH B: Multimodal Image Extraction (Direct Image or Fallback)
  // ─────────────────────────────────────────────────────────────
  if (!content && receiptImages.length > 0) {
    const normalizedImages = receiptImages.map((value) => {
      const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
      return {
        mimeType: match?.[1] ?? 'image/jpeg',
        rawBase64: match?.[2] ?? value,
        dataUrl: value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`,
      };
    });

    // 1. First attempt: Direct Google AI Studio Gemini API if configured.
    // Send every page in one multimodal request so overlap can be reconciled globally.
    if (geminiKey) {
      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
      for (const model of candidateModels) {
        try {
          const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(aiStudioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    ...normalizedImages.map(({ mimeType, rawBase64 }) => ({
                      inline_data: { mime_type: mimeType, data: rawBase64 },
                    })),
                    {
                      text: `${EXTRACTION_SYSTEM_PROMPT}\n\nThere are ${normalizedImages.length} ordered receipt image(s). Treat them as pages/sections of one receipt.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: 'application/json',
                max_output_tokens: 4000,
              },
            }),
            signal: AbortSignal.timeout(35_000),
          });

          if (res.ok) {
            const json = await res.json() as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (content) break;
          }
        } catch (aiStudioErr) {
          console.warn(`AI Studio ${model} attempt failed:`, aiStudioErr);
        }
      }
    }

    // 2. OpenRouter multimodal fallback.
    if (!content && openRouterKey) {
      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL ?? 'https://split.joinclick.co',
            'X-Title': 'Click Split',
          },
          body: JSON.stringify({
            model: 'google/gemini-3.5-flash-lite',
            max_tokens: 2500,
            messages: [
              { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  ...normalizedImages.map(({ dataUrl }, index) => ({
                    type: 'image_url',
                    image_url: { url: dataUrl },
                    ...(normalizedImages.length > 1 ? { image_index: index + 1 } : {}),
                  })),
                  {
                    type: 'text',
                    text: `These ${normalizedImages.length} image(s) are ordered sections of one receipt. Extract the receipt once, remove only overlap caused by adjacent photos, and return ONLY the JSON object.`,
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (response.ok) {
          const json = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          content = json.choices?.[0]?.message?.content?.trim();
        } else {
          const errBody = await response.json().catch(() => ({}));
          console.error('OpenRouter Gemini error:', response.status, errBody);
        }
      } catch (openRouterErr) {
        console.error('OpenRouter request error:', openRouterErr);
      }
    }
  }

  if (!content) {
    return NextResponse.json({ error: 'Failed to extract receipt with Gemini vision engine.' }, { status: 502 });
  }

  try {
    // Extract JSON from response (handling markdown code blocks if any)
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    const parsed = JSON.parse(jsonStr) as {
      merchant?: string;
      date?: string;
      tax?: number;
      tip?: number;
      items: Array<{ label: string; price: number }>;
      detected_total: number;
    };

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: 'Invalid extraction format' }, { status: 502 });
    }

    return NextResponse.json({
      merchant: parsed.merchant ? String(parsed.merchant).trim() : undefined,
      date: parsed.date ? String(parsed.date).trim() : undefined,
      tax: typeof parsed.tax === 'number' ? parsed.tax : 0,
      tip: typeof parsed.tip === 'number' ? parsed.tip : 0,
      items: parsed.items.map((item) => ({
        label: String(item.label).trim(),
        price: Number(item.price),
      })),
      detected_total: Number(parsed.detected_total ?? parsed.items.reduce((sum, i) => sum + Number(i.price), 0)),
    });
  } catch (err) {
    console.error('Receipt parse error:', err);
    return NextResponse.json({ error: 'Failed to parse receipt data' }, { status: 500 });
  }
}
