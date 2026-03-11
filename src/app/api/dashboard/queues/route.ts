import { NextResponse } from 'next/server'
import { getWorkflowQueues } from '@/app/actions/dashboard'

export async function GET() {
  try {
    const queues = await getWorkflowQueues()
    return NextResponse.json(queues)
  } catch (error) {
    console.error('Failed to fetch queues:', error)
    return NextResponse.json({ error: 'Failed to fetch queues' }, { status: 500 })
  }
}
