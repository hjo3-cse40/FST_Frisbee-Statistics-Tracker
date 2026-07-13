export interface UsauEventPlayer {
  name: string
  number: number
  numberUnset: boolean
  position: string
}

export interface UsauEventRoster {
  teamName: string | null
  sourceUrl: string
  players: UsauEventPlayer[]
  jerseyZeroCount: number
  duplicateNumbers: Record<string, string[]>
}

const ROSTER_TABLE_ID = 'CT_Main_0_ucTeamDetails_gvList'

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractTeamName(html: string): string | null {
  const profileMatch = html.match(
    /class=["'][^"']*profile_info[^"']*["'][\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i
  )
  if (profileMatch?.[1]) {
    const name = stripTags(profileMatch[1])
    if (name) return name
  }

  const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)
  if (h4Match?.[1]) {
    const name = stripTags(h4Match[1])
    if (name) return name
  }

  return null
}

function extractRosterTableHtml(html: string): string | null {
  const idIndex = html.indexOf(`id="${ROSTER_TABLE_ID}"`)
  const idIndexAlt = idIndex === -1 ? html.indexOf(`id='${ROSTER_TABLE_ID}'`) : idIndex
  if (idIndexAlt === -1) return null

  const tableStart = html.lastIndexOf('<table', idIndexAlt)
  if (tableStart === -1) return null

  let depth = 0
  const lower = html.toLowerCase()
  let i = tableStart
  while (i < html.length) {
    const nextOpen = lower.indexOf('<table', i)
    const nextClose = lower.indexOf('</table>', i)
    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 6
      continue
    }

    depth -= 1
    i = nextClose + 8
    if (depth === 0) {
      return html.slice(tableStart, i)
    }
  }

  return null
}

function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = []
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1]
    if (/<th\b/i.test(rowHtml)) continue

    const cells: string[] = []
    const cellRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]))
    }

    if (cells.length >= 2) {
      rows.push(cells)
    }
  }

  return rows
}

function findDuplicateNumbers(players: UsauEventPlayer[]): Record<string, string[]> {
  const byNumber = new Map<number, string[]>()
  for (const player of players) {
    if (player.numberUnset) continue
    const list = byNumber.get(player.number) ?? []
    list.push(player.name)
    byNumber.set(player.number, list)
  }

  const duplicates: Record<string, string[]> = {}
  for (const [number, names] of byNumber) {
    if (names.length > 1) {
      duplicates[String(number)] = names
    }
  }
  return duplicates
}

export function parseUsauEventRosterHtml(html: string, sourceUrl: string): UsauEventRoster {
  const tableHtml = extractRosterTableHtml(html)
  if (!tableHtml) {
    throw new Error('Could not find a USAU event roster table on that page.')
  }

  const rows = parseTableRows(tableHtml)
  const players: UsauEventPlayer[] = []

  for (const row of rows) {
    const rawNumber = row[0]?.trim() ?? ''
    const name = row[1]?.trim() ?? ''
    if (!name) continue

    const number = /^\d+$/.test(rawNumber) ? Number(rawNumber) : 0
    players.push({
      name,
      number,
      numberUnset: number === 0,
      position: row[3]?.trim() ?? '',
    })
  }

  if (players.length === 0) {
    throw new Error('Roster table was found, but no players could be parsed.')
  }

  return {
    teamName: extractTeamName(html),
    sourceUrl,
    players,
    jerseyZeroCount: players.filter((p) => p.numberUnset).length,
    duplicateNumbers: findDuplicateNumbers(players),
  }
}
