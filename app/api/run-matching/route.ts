import { NextResponse } from 'next/server'
import { runMatching } from '@/actions/matching'

export async function POST(): Promise<NextResponse> {
  try {
    const result = await runMatching()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
