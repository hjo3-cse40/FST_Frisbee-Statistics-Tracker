import { supabase } from '@/lib/supabase'
import { resolveJerseyColor } from '@/lib/jerseyColor'

export interface Game {
  id: string
  team_home_id: string
  team_away_id: string
  team_home_jersey_color?: string | null
  team_away_jersey_color?: string | null
  home_score: number
  away_score: number
  points_to_win: number
  location?: string
  name?: string
  date: string
}

export interface Team {
  id: string
  name: string
  color_primary: string
}

export interface Player {
  id: string
  name: string
  number: number
  team_id: string
}

export interface StatEvent {
  point_id: string
  event_type: string
  player_id: string
  assist_player_id: string | null
  is_turnover: boolean
}

export interface PointLineup {
  point_id: string
  player_id: string
  team_id: string
}

export interface PlayerGameStats {
  playerId: string
  name: string
  number: number
  teamId: string
  pointsPlayed: number
  assists: number
  goals: number
  blocks: number
  turnovers: number
}

export interface TeamGameStats {
  teamId: string
  teamName: string
  jerseyColor: string
  goalsScored: number
  goalsGiven: number
  totalPoints: number
  blocks: number
  turnovers: number
  blocksPerPoint: number
  turnoversPerPoint: number
  players: PlayerGameStats[]
}

export interface GameStatsResult {
  game: Game
  homeTeam: Team
  awayTeam: Team
  gameIsOver: boolean
  homeStats: TeamGameStats
  awayStats: TeamGameStats
}

export function isGameOver(game: Pick<Game, 'home_score' | 'away_score' | 'points_to_win'>): boolean {
  return game.home_score >= game.points_to_win || game.away_score >= game.points_to_win
}

function isBlockEvent(eventType: string): boolean {
  return eventType === 'block' || eventType === 'd' || eventType === 'interception' || eventType === 'callahan'
}

function perPointRate(total: number, points: number): number {
  if (points === 0) return 0
  return total / points
}

function computePlayerStats(
  player: Player,
  lineups: PointLineup[],
  events: StatEvent[]
): PlayerGameStats {
  const playerId = player.id
  const pointsPlayed = lineups.filter((l) => l.player_id === playerId).length
  const goals = events.filter((e) => e.event_type === 'goal' && e.player_id === playerId).length
  const assists = events.filter((e) => e.event_type === 'goal' && e.assist_player_id === playerId).length
  const blocks = events.filter((e) => isBlockEvent(e.event_type) && e.player_id === playerId).length
  const turnovers = events.filter((e) => e.is_turnover && e.player_id === playerId).length

  return {
    playerId,
    name: player.name,
    number: player.number,
    teamId: player.team_id,
    pointsPlayed,
    assists,
    goals,
    blocks,
    turnovers,
  }
}

function buildTeamStats(
  team: Team,
  teamId: string,
  goalsScored: number,
  goalsGiven: number,
  totalPoints: number,
  jerseyColor: string,
  players: PlayerGameStats[]
): TeamGameStats {
  const blocks = players.reduce((sum, p) => sum + p.blocks, 0)
  const turnovers = players.reduce((sum, p) => sum + p.turnovers, 0)

  return {
    teamId,
    teamName: team.name,
    jerseyColor,
    goalsScored,
    goalsGiven,
    totalPoints,
    blocks,
    turnovers,
    blocksPerPoint: perPointRate(blocks, totalPoints),
    turnoversPerPoint: perPointRate(turnovers, totalPoints),
    players: players.sort((a, b) => a.number - b.number),
  }
}

export function buildGameStats(input: {
  game: Game
  homeTeam: Team
  awayTeam: Team
  lineups: PointLineup[]
  events: StatEvent[]
  players: Player[]
  totalPoints: number
}): GameStatsResult {
  const { game, homeTeam, awayTeam, lineups, events, players, totalPoints } = input

  const playerIdsInGame = new Set(lineups.map((l) => l.player_id))
  const activePlayers = players.filter((p) => playerIdsInGame.has(p.id))

  const allPlayerStats = activePlayers.map((player) => computePlayerStats(player, lineups, events))

  const homePlayers = allPlayerStats.filter((p) => p.teamId === game.team_home_id)
  const awayPlayers = allPlayerStats.filter((p) => p.teamId === game.team_away_id)

  const homeJersey = resolveJerseyColor(
    game.team_home_jersey_color,
    homeTeam.color_primary,
    '#3B82F6'
  )
  const awayJersey = resolveJerseyColor(
    game.team_away_jersey_color,
    awayTeam.color_primary,
    '#EF4444'
  )

  return {
    game,
    homeTeam,
    awayTeam,
    gameIsOver: isGameOver(game),
    homeStats: buildTeamStats(
      homeTeam,
      game.team_home_id,
      game.home_score,
      game.away_score,
      totalPoints,
      homeJersey,
      homePlayers
    ),
    awayStats: buildTeamStats(
      awayTeam,
      game.team_away_id,
      game.away_score,
      game.home_score,
      totalPoints,
      awayJersey,
      awayPlayers
    ),
  }
}

export async function fetchGameStats(gameId: string): Promise<GameStatsResult> {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (gameError) throw gameError

  const [{ data: homeTeam, error: homeError }, { data: awayTeam, error: awayError }] =
    await Promise.all([
      supabase.from('teams').select('*').eq('id', game.team_home_id).single(),
      supabase.from('teams').select('*').eq('id', game.team_away_id).single(),
    ])

  if (homeError) throw homeError
  if (awayError) throw awayError

  const { data: points, error: pointsError } = await supabase
    .from('points')
    .select('id')
    .eq('game_id', gameId)

  if (pointsError) throw pointsError

  const pointIds = (points ?? []).map((p) => p.id)
  const totalPoints = pointIds.length

  let lineups: PointLineup[] = []
  let events: StatEvent[] = []

  if (pointIds.length > 0) {
    const [{ data: lineupData, error: lineupError }, { data: eventsData, error: eventsError }] =
      await Promise.all([
        supabase.from('point_lineups').select('point_id, player_id, team_id').in('point_id', pointIds),
        supabase
          .from('events')
          .select('point_id, event_type, player_id, assist_player_id, is_turnover')
          .in('point_id', pointIds),
      ])

    if (lineupError) throw lineupError
    if (eventsError) throw eventsError

    lineups = lineupData ?? []
    events = eventsData ?? []
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, number, team_id')
    .in('team_id', [game.team_home_id, game.team_away_id])

  if (playersError) throw playersError

  return buildGameStats({
    game,
    homeTeam,
    awayTeam,
    lineups,
    events,
    players: players ?? [],
    totalPoints,
  })
}

export function formatRate(value: number): string {
  if (value === 0) return '0'
  return value.toFixed(4).replace(/\.?0+$/, '') || '0'
}
