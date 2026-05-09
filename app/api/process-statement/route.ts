import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { ExtractedTransaction } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    statementId: string;
    filePath: string;
  };
  const { statementId, filePath } = body;

  if (!statementId || !filePath) {
    return NextResponse.json(
      { error: "statementId and filePath are required" },
      { status: 400 },
    );
  }

  // Update status to processing
  await supabase
    .from("bank_statements")
    .update({ status: "processing" })
    .eq("id", statementId)
    .eq("user_id", user.id);

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("statements")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(
        `Failed to download file: ${downloadError?.message ?? "No data"}`,
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Call Anthropic API with PDF as base64
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlocks: any[] = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      },
      {
        type: "text",
        text: `You are a bank statement parser. Extract all transactions from this bank statement PDF.
Return a JSON array of transactions with these exact fields:
- date: string (YYYY-MM-DD format)
- particulars: string (description/narration)
- payment_type: string (NEFT/IMPS/UPI/RTGS/ATM/etc)
- utr: string (UTR number or reference number, extract from particulars if present)
- counterparty: string (name of other party)
- debit: number or null
- credit: number or null
- balance: number or null

Return ONLY valid JSON array, no markdown, no explanation.`,
      },
    ];

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let transactions: ExtractedTransaction[];
    try {
      transactions = JSON.parse(cleaned) as ExtractedTransaction[];
    } catch {
      throw new Error(
        `Failed to parse Anthropic response as JSON. Raw: ${rawText.slice(0, 200)}`,
      );
    }

    if (!Array.isArray(transactions)) {
      throw new Error("Anthropic response is not an array");
    }

    // Insert transactions
    if (transactions.length > 0) {
      const rows = transactions.map((tx) => ({
        statement_id: statementId,
        user_id: user.id,
        date: tx.date,
        particulars: tx.particulars ?? null,
        payment_type: tx.payment_type ?? null,
        utr: tx.utr ?? null,
        counterparty: tx.counterparty ?? null,
        debit: tx.debit ?? null,
        credit: tx.credit ?? null,
        balance: tx.balance ?? null,
      }));

      const { error: insertError } = await supabase
        .from("transactions")
        .insert(rows);
      if (insertError) {
        throw new Error(
          `Failed to insert transactions: ${insertError.message}`,
        );
      }
    }

    // Update status to done
    await supabase
      .from("bank_statements")
      .update({ status: "done" })
      .eq("id", statementId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, count: transactions.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("bank_statements")
      .update({ status: "error", error_message: message })
      .eq("id", statementId)
      .eq("user_id", user.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
