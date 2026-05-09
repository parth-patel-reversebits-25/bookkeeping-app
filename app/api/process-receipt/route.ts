import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { ExtractedReceipt } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { receiptId: string; filePath: string }
  const { receiptId, filePath } = body

  if (!receiptId || !filePath) {
    return NextResponse.json({ error: 'receiptId and filePath are required' }, { status: 400 })
  }

  // Update status to processing
  await supabase
    .from('receipts')
    .update({ status: 'processing' })
    .eq('id', receiptId)
    .eq('user_id', user.id)

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(filePath)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message ?? 'No data'}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'pdf'
    const isPdf = ext === 'pdf'

    const extractionPrompt = `You are a receipt parser. Extract key information from this receipt PDF or image.
Return a JSON object with:
- merchant_name: string
- amount: number (total amount paid)
- date: string (YYYY-MM-DD format)
- utr: string or null (UPI reference/UTR number if present)

Return ONLY valid JSON object, no markdown, no explanation.`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contentBlocks: any[]

    if (isPdf) {
      contentBlocks = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        },
        { type: 'text', text: extractionPrompt },
      ]
    } else {
      const imageMediaType =
        ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      contentBlocks = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMediaType,
            data: base64,
          },
        },
        { type: 'text', text: extractionPrompt },
      ]
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let extracted: ExtractedReceipt
    try {
      extracted = JSON.parse(cleaned) as ExtractedReceipt
    } catch {
      throw new Error(`Failed to parse Anthropic response as JSON. Raw: ${rawText.slice(0, 200)}`)
    }

    // Update receipt with extracted data
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        status: 'done',
        merchant_name: extracted.merchant_name ?? null,
        amount: extracted.amount ?? null,
        date: extracted.date ?? null,
        utr: extracted.utr ?? null,
      })
      .eq('id', receiptId)
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(`Failed to update receipt: ${updateError.message}`)
    }

    return NextResponse.json({ success: true, data: extracted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('receipts')
      .update({ status: 'error', error_message: message })
      .eq('id', receiptId)
      .eq('user_id', user.id)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
