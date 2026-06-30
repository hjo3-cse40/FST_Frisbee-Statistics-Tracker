import { supabase } from '@/lib/supabase'

export async function recalculateGameScore(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string
): Promise<{ homeScore: number; awayScore: number }> {
  const { data: points, error } = await supabase
    .from('points')
    .select('scoring_team_id')
    .eq('game_id', gameId)
    .not('scoring_team_id', 'is', null)

  if (error) throw error

  let homeScore = 0
  let awayScore = 0

  for (const point of points ?? []) {
    if (point.scoring_team_id === homeTeamId) {
      homeScore++
    } else if (point.scoring_team_id === awayTeamId) {
      awayScore++
    }
  }

  const { error: updateError } = await supabase
    .from('games')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', gameId)

  if (updateError) throw updateError

  return { homeScore, awayScore }
}
