import { NextRequest, NextResponse } from 'next/server'
import { parseUsauEventRosterHtml } from '@/lib/usau/parseEventRoster'
import { validateUsauEventTeamUrl } from '@/lib/usau/validateEventTeamUrl'

export const runtime = 'nodejs'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawUrl = typeof body?.url === 'string' ? body.url : ''
    if (!rawUrl.trim()) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    let eventUrl: URL
    try {
      eventUrl = validateUsauEventTeamUrl(rawUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid URL'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const response = await fetch(eventUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // USAU pages are public event rosters; avoid Next fetch cache during import.
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `USAU returned HTTP ${response.status}` },
        { status: 502 }
      )
    }

    const html = await response.text()
    const roster = parseUsauEventRosterHtml(html, eventUrl.toString())

    return NextResponse.json(roster)
  } catch (error) {
    console.error('USAU roster import failed:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to import USAU roster'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
