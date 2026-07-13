const ALLOWED_HOSTS = new Set(['play.usaultimate.org', 'www.play.usaultimate.org'])

type EventTeamUrlKind = 'teamId' | 'eventTeamId'

function getEventTeamUrlKind(parsed: URL): EventTeamUrlKind | null {
  const path = parsed.pathname.replace(/\/+$/, '').toLowerCase()

  // Older / alternate share links:
  // https://play.usaultimate.org/teams/events/Eventteam/?TeamId=...
  if (path.endsWith('/teams/events/eventteam') && parsed.searchParams.get('TeamId')) {
    return 'teamId'
  }

  // Common event schedule / opponent links:
  // https://play.usaultimate.org/events/teams/?EventTeamId=...
  if (path.endsWith('/events/teams') && parsed.searchParams.get('EventTeamId')) {
    return 'eventTeamId'
  }

  return null
}

export function validateUsauEventTeamUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new Error('Enter a valid USAU Event Team URL.')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('USAU URL must start with https://')
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('URL must be on play.usaultimate.org')
  }

  if (!getEventTeamUrlKind(parsed)) {
    throw new Error(
      'URL must be an Event Team page with TeamId or EventTeamId (for example /teams/events/Eventteam/?TeamId=... or /events/teams/?EventTeamId=...)'
    )
  }

  parsed.protocol = 'https:'
  return parsed
}
