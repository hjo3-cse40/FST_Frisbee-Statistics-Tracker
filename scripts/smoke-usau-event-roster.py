#!/usr/bin/env python3
"""Smoke-test: parse a USAU Event Team roster page into FST-shaped players.

Usage:
  python3 scripts/smoke-usau-event-roster.py
  python3 scripts/smoke-usau-event-roster.py 'https://play.usaultimate.org/teams/events/Eventteam/?TeamId=...'

Notes (2026-07 smoke results):
- usau-scraper (PyPI 0.4.0) is NOT viable for FST:
  - Needs a browser User-Agent or USAU resets the connection
  - School/team search returns NOTFOUND for Wavestorms and Columbia Curbside
  - Eventteam pages break fillInBasicInfo (expects "School (Team)" h4)
  - Event roster tables have 9 cols (No/Player/Pronouns/Position/Height/Points/...)
    while the package assumes a Year column at index 4
- Direct Eventteam URL scrape works: same table id CT_Main_0_ucTeamDetails_gvList
"""

from __future__ import annotations

import json
import sys
import urllib.request

from html.parser import HTMLParser

DEFAULT_URL = (
    "https://play.usaultimate.org/teams/events/Eventteam/"
    "?TeamId=vSR1ASOmvU2cor4yf6z0XXtolCAnrFlaAc3xGHZqbSs%3d"
)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


class RosterTableParser(HTMLParser):
    """Minimal HTML parser for the USAU event roster table."""

    def __init__(self) -> None:
        super().__init__()
        self.in_roster_table = False
        self.in_row = False
        self.in_cell = False
        self.skip_row = False
        self.current_row: list[str] = []
        self.cell_buf: list[str] = []
        self.rows: list[list[str]] = []
        self.team_name: str | None = None
        self._in_h4 = False
        self._h4_buf: list[str] = []
        self._table_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "table" and attr.get("id") == "CT_Main_0_ucTeamDetails_gvList":
            self.in_roster_table = True
            self._table_depth = 1
            return
        if self.in_roster_table and tag == "table":
            self._table_depth += 1
        if tag == "h4" and self.team_name is None:
            self._in_h4 = True
            self._h4_buf = []
        if not self.in_roster_table:
            return
        if tag == "tr":
            self.in_row = True
            self.current_row = []
            self.skip_row = False
        elif tag in ("td", "th") and self.in_row:
            self.in_cell = True
            self.cell_buf = []
            if tag == "th":
                self.skip_row = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "h4" and self._in_h4:
            self._in_h4 = False
            text = "".join(self._h4_buf).strip()
            if text and self.team_name is None:
                self.team_name = text
        if not self.in_roster_table:
            return
        if tag in ("td", "th") and self.in_cell:
            self.in_cell = False
            self.current_row.append("".join(self.cell_buf).strip())
        elif tag == "tr" and self.in_row:
            self.in_row = False
            if not self.skip_row and len(self.current_row) >= 2:
                self.rows.append(self.current_row)
        elif tag == "table":
            self._table_depth -= 1
            if self._table_depth <= 0:
                self.in_roster_table = False

    def handle_data(self, data: str) -> None:
        if self._in_h4:
            self._h4_buf.append(data)
        if self.in_cell:
            self.cell_buf.append(data)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_roster(html: str) -> dict:
    parser = RosterTableParser()
    parser.feed(html)

    players = []
    for row in parser.rows:
        raw_no = row[0].strip()
        name = row[1].strip()
        if not name:
            continue
        number = int(raw_no) if raw_no.isdigit() else 0
        players.append(
            {
                "name": name,
                "number": number,
                "number_unset": number == 0,
                "position": row[3].strip() if len(row) > 3 else "",
            }
        )

    numbered = [p for p in players if not p["number_unset"]]
    dup_map: dict[int, list[str]] = {}
    for p in numbered:
        dup_map.setdefault(p["number"], []).append(p["name"])
    duplicate_numbers = {str(k): v for k, v in dup_map.items() if len(v) > 1}

    return {
        "team_name": parser.team_name,
        "player_count": len(players),
        "jersey_zero_count": sum(1 for p in players if p["number_unset"]),
        "duplicate_numbers": duplicate_numbers,
        "players": players,
    }


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    print(f"Fetching: {url}", file=sys.stderr)
    html = fetch(url)
    result = parse_roster(html)
    print(json.dumps(result, indent=2))
    if result["player_count"] == 0:
        print("FAIL: no players parsed", file=sys.stderr)
        return 1
    print(
        f"OK: {result['team_name']} — {result['player_count']} players "
        f"({result['jersey_zero_count']} with #0)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
