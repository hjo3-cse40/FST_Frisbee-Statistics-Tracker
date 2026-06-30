import { formatRate, type GameStatsResult, type PlayerGameStats, type TeamGameStats } from '@/lib/gameStats'

export type ExportScope = 'home' | 'away' | 'both'

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value)
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'game'
}

/** Per-game team sheet (mirrors Firefall / JMen tabs in Summer Bash Stats.xlsx) */
function buildTeamPlayerCsv(team: TeamGameStats): string[] {
  return [
    csvRow(['Name', 'Points Played', 'Assists', 'Goals', 'Blocks', 'Turns']),
    ...team.players.map((player) => csvRow(playerRow(player))),
  ]
}

function playerRow(player: PlayerGameStats): (string | number)[] {
  return [
    player.name,
    player.pointsPlayed,
    player.assists,
    player.goals,
    player.blocks,
    player.turnovers,
  ]
}

/** Summary → Game Stats panel (teams as columns) */
function buildGameStatsComparisonCsv(stats: GameStatsResult): string[] {
  const home = stats.homeStats
  const away = stats.awayStats

  return [
    csvRow(['', 'Game Stats', '']),
    csvRow(['', stats.homeTeam.name, stats.awayTeam.name]),
    csvRow(['Goals Scored', home.goalsScored, away.goalsScored]),
    csvRow(['Goals Given', home.goalsGiven, away.goalsGiven]),
    csvRow(['Total Points', home.totalPoints, away.totalPoints]),
    csvRow(['Blocks', home.blocks, away.blocks]),
    csvRow(['Turnovers', home.turnovers, away.turnovers]),
    csvRow(['Blocks/Pt', formatRate(home.blocksPerPoint), formatRate(away.blocksPerPoint)]),
    csvRow(['Turnovers/Pt', formatRate(home.turnoversPerPoint), formatRate(away.turnoversPerPoint)]),
  ]
}

export function buildGameStatsCsv(stats: GameStatsResult, scope: ExportScope): string {
  let lines: string[]

  if (scope === 'home') {
    lines = buildTeamPlayerCsv(stats.homeStats)
  } else if (scope === 'away') {
    lines = buildTeamPlayerCsv(stats.awayStats)
  } else {
    lines = buildGameStatsComparisonCsv(stats)
  }

  return `\uFEFF${lines.join('\n')}\n`
}

export function buildExportFilename(stats: GameStatsResult, scope: ExportScope): string {
  const gameSlug = sanitizeFilename(stats.game.name || stats.game.location || 'game')

  if (scope === 'home') {
    return `${gameSlug}-${sanitizeFilename(stats.homeTeam.name)}-stats.csv`
  }
  if (scope === 'away') {
    return `${gameSlug}-${sanitizeFilename(stats.awayTeam.name)}-stats.csv`
  }
  return `${gameSlug}-game-stats.csv`
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
