function formatOvers(value) {
  const raw = String(value).trim();
  if (!raw) {
    return NaN;
  }

  const parts = raw.split('.');
  const wholeOvers = parseInt(parts[0], 10);
  if (!Number.isFinite(wholeOvers) || wholeOvers < 0) {
    return NaN;
  }

  if (parts.length === 1) {
    return wholeOvers;
  }

  const ballsString = parts[1];
  if (!/^[0-9]+$/.test(ballsString) || ballsString.length > 1) {
    return NaN;
  }

  const balls = parseInt(ballsString, 10);
  if (!Number.isFinite(balls) || balls < 0 || balls > 5) {
    return NaN;
  }

  return wholeOvers + balls / 6;
}

function calculateNRR(runsScored, oversFaced, runsConceded, oversBowled) {
  if (
    !Number.isFinite(runsScored) ||
    !Number.isFinite(oversFaced) ||
    !Number.isFinite(runsConceded) ||
    !Number.isFinite(oversBowled) ||
    oversFaced <= 0 ||
    oversBowled <= 0
  ) {
    return null;
  }
  return runsScored / oversFaced - runsConceded / oversBowled;
}

function buildTable(headers, rows) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function setResult(container, content) {
  container.innerHTML = '';
  if (typeof content === 'string') {
    container.textContent = content;
  } else {
    container.appendChild(content);
  }
}

function parseTeamNames(text) {
  return text
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function createMatchPairs(teams) {
  const pairs = [];
  for (let i = 0; i < teams.length - 1; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
}

function pairKey(a, b) {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

function buildTeamPanel(team, matches) {
  const panel = document.createElement('section');
  panel.className = 'team-panel panel';
  panel.dataset.team = team;

  const header = document.createElement('h3');
  header.textContent = `${team} — ${matches.length} match${matches.length === 1 ? '' : 'es'}`;
  panel.appendChild(header);

  if (matches.length === 0) {
    const note = document.createElement('p');
    note.textContent = `No scheduled matches for ${team}.`;
    panel.appendChild(note);
    return panel;
  }

  const rows = matches.map(match => [match.index, match.opponent, match.role]);
  const table = buildTable(['Match #', 'Opponent', 'Role'], rows);
  panel.appendChild(table);
  return panel;
}

function buildTeamFilter(teams, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'team-filter';

  const label = document.createElement('label');
  label.textContent = 'View team:';

  const select = document.createElement('select');
  select.id = 'teamScheduleFilter';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Teams';
  select.appendChild(allOption);

  teams.forEach(team => {
    const option = document.createElement('option');
    option.value = team;
    option.textContent = team;
    select.appendChild(option);
  });

  select.addEventListener('change', () => onChange(select.value));
  label.appendChild(select);
  wrapper.appendChild(label);
  return wrapper;
}

function filterTeamPanels(container, selectedTeam) {
  const panels = container.querySelectorAll('.team-panel');
  panels.forEach(panel => {
    panel.style.display = selectedTeam === 'all' || panel.dataset.team === selectedTeam ? '' : 'none';
  });
}

function addExtraMatches(schedule, teams, targetMatches) {
  const basePairs = createMatchPairs(teams);
  const teamMatchCounts = Object.fromEntries(teams.map(team => [team, 0]));
  const pairCounts = Object.fromEntries(basePairs.map(pair => [pairKey(pair[0], pair[1]), 0]));

  schedule.forEach(pair => {
    teamMatchCounts[pair[0]] += 1;
    teamMatchCounts[pair[1]] += 1;
    pairCounts[pairKey(pair[0], pair[1])] += 1;
  });

  while (schedule.length < targetMatches) {
    const sorted = basePairs.slice().sort((a, b) => {
      const countA = pairCounts[pairKey(a[0], a[1])];
      const countB = pairCounts[pairKey(b[0], b[1])];
      if (countA !== countB) return countA - countB;
      const teamCountA = teamMatchCounts[a[0]] + teamMatchCounts[a[1]];
      const teamCountB = teamMatchCounts[b[0]] + teamMatchCounts[b[1]];
      if (teamCountA !== teamCountB) return teamCountA - teamCountB;
      return 0;
    });
    const bestCount = pairCounts[pairKey(sorted[0][0], sorted[0][1])];
    const bestCandidates = sorted.filter(pair => pairCounts[pairKey(pair[0], pair[1])] === bestCount);
    const candidate = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];

    schedule.push([candidate[0], candidate[1]]);
    teamMatchCounts[candidate[0]] += 1;
    teamMatchCounts[candidate[1]] += 1;
    pairCounts[pairKey(candidate[0], candidate[1])] += 1;
  }

  return schedule;
}

function handleTeamsForm(event) {
  event.preventDefault();
  const names = parseTeamNames(document.getElementById('teamNames').value);
  const leagueMatchesInput = document.getElementById('leagueMatches').value.trim();
  const matchesPerTeamInput = document.getElementById('matchesPerTeam').value.trim();
  const resultBox = document.getElementById('teamsResult');

  if (names.length < 2) {
    setResult(resultBox, 'Please enter at least two team names.');
    return;
  }

  const maxRoundRobin = (names.length * (names.length - 1)) / 2;
  let leagueMatches = null;
  let matchesPerTeam = null;

  if (leagueMatchesInput) {
    leagueMatches = parseInt(leagueMatchesInput, 10);
    if (!Number.isFinite(leagueMatches) || leagueMatches < 1) {
      setResult(resultBox, 'Enter a valid total league matches value.');
      return;
    }
  }

  if (matchesPerTeamInput) {
    matchesPerTeam = parseInt(matchesPerTeamInput, 10);
    if (!Number.isFinite(matchesPerTeam) || matchesPerTeam < 1) {
      setResult(resultBox, 'Enter a valid matches-per-team value.');
      return;
    }
    if ((matchesPerTeam * names.length) % 2 !== 0) {
      setResult(resultBox, 'Matches per team must result in an even total number of match assignments.');
      return;
    }
    const impliedMatches = (matchesPerTeam * names.length) / 2;
    if (leagueMatches === null) {
      leagueMatches = impliedMatches;
    }
  }

  if (leagueMatches === null) {
    leagueMatches = maxRoundRobin;
  }

  const basePairs = createMatchPairs(names);
  const schedule = leagueMatches <= basePairs.length ? basePairs.slice(0, leagueMatches) : addExtraMatches([...basePairs], names, leagueMatches);

  const actualMatchesPerTeam = Math.round((schedule.length * 2) / names.length);
  const builder = document.createElement('div');
  const summary = document.createElement('p');
  summary.textContent = `Teams: ${names.length}. League matches: ${schedule.length}. Approximate matches per team: ${actualMatchesPerTeam}.`;
  builder.appendChild(summary);

  const teamMatches = Object.fromEntries(names.map(name => [name, []]));
  schedule.forEach((pair, index) => {
    const [teamA, teamB] = pair;
    teamMatches[teamA].push({ index: index + 1, opponent: teamB, role: 'Home' });
    teamMatches[teamB].push({ index: index + 1, opponent: teamA, role: 'Away' });
  });

  const filter = buildTeamFilter(names, selectedTeam => filterTeamPanels(teamGrid, selectedTeam));
  builder.appendChild(filter);

  const teamGrid = document.createElement('div');
  teamGrid.className = 'team-grid';
  names.forEach(team => {
    const panel = buildTeamPanel(team, teamMatches[team]);
    teamGrid.appendChild(panel);
  });
  builder.appendChild(teamGrid);

  setResult(resultBox, builder);
}

function getCurrentGTStats() {
  return {
    runs: parseInt(document.getElementById('teamA_runsScored').value, 10),
    oversFaced: formatOvers(document.getElementById('teamA_oversFaced').value),
    conceded: parseInt(document.getElementById('teamA_runsConceded').value, 10),
    oversBowled: formatOvers(document.getElementById('teamA_oversBowled').value),
    targetNRR: parseFloat(document.getElementById('target_nrr').value),
  };
}

function validateCurrentGTStats(current) {
  return (
    Number.isFinite(current.runs) &&
    Number.isFinite(current.oversFaced) &&
    current.oversFaced >= 0 &&
    Number.isFinite(current.conceded) &&
    Number.isFinite(current.oversBowled) &&
    current.oversBowled >= 0 &&
    Number.isFinite(current.targetNRR)
  );
}

function handleNRRTargetBattingForm(event) {
  event.preventDefault();
  const current = getCurrentGTStats();
  const matchRuns = parseInt(document.getElementById('batting_matchRuns').value, 10);
  const matchOvers = formatOvers(document.getElementById('batting_matchOvers').value);
  const oppOvers = formatOvers(document.getElementById('batting_oppOvers').value);
  const resultBox = document.getElementById('battingTargetResult');

  if (
    !validateCurrentGTStats(current) ||
    !Number.isFinite(matchRuns) ||
    !Number.isFinite(matchOvers) ||
    !Number.isFinite(oppOvers) ||
    matchOvers <= 0 ||
    oppOvers <= 0
  ) {
    setResult(resultBox, 'Enter valid current totals and batting-first match details in cricket format.');
    return;
  }

  const totalRuns = current.runs + matchRuns;
  const totalOversFaced = current.oversFaced + matchOvers;
  const totalOversBowled = current.oversBowled + oppOvers;
  const allowedOpponentRuns = totalOversBowled * (totalRuns / totalOversFaced - current.targetNRR) - current.conceded;

  if (!Number.isFinite(allowedOpponentRuns)) {
    setResult(resultBox, 'Unable to calculate the batting-first target with the provided numbers.');
    return;
  }

  if (allowedOpponentRuns < 0) {
    setResult(resultBox, 'Even if GT defends 0 runs, the selected match profile cannot reach the target NRR.');
    return;
  }

  const maxAllowedRuns = Math.floor(allowedOpponentRuns);
  setResult(resultBox, `Batting first: with ${matchRuns} runs in ${matchOvers.toFixed(1)} overs, GT can concede at most ${maxAllowedRuns} runs in ${oppOvers.toFixed(1)} overs to reach target NRR ${current.targetNRR.toFixed(3)}.`);
}

function handleNRRTargetBowlingForm(event) {
  event.preventDefault();
  const current = getCurrentGTStats();
  const oppRuns = parseInt(document.getElementById('bowling_oppRuns').value, 10);
  const oppOvers = formatOvers(document.getElementById('bowling_oppOvers').value);
  const chaseOvers = formatOvers(document.getElementById('bowling_chaseOvers').value);
  const resultBox = document.getElementById('bowlingTargetResult');

  if (
    !validateCurrentGTStats(current) ||
    !Number.isFinite(oppRuns) ||
    !Number.isFinite(oppOvers) ||
    !Number.isFinite(chaseOvers) ||
    oppOvers <= 0 ||
    chaseOvers <= 0
  ) {
    setResult(resultBox, 'Enter valid current totals and bowling-first match details in cricket format.');
    return;
  }

  const totalConceded = current.conceded + oppRuns;
  const totalOversBowled = current.oversBowled + oppOvers;
  const totalOversFaced = current.oversFaced + chaseOvers;
  const requiredTotalRuns = totalOversFaced * (current.targetNRR + totalConceded / totalOversBowled);
  const chaseRuns = requiredTotalRuns - current.runs;

  if (!Number.isFinite(chaseRuns)) {
    setResult(resultBox, 'Unable to calculate the bowling-first chase target with the provided numbers.');
    return;
  }

  const minimalChase = Math.max(oppRuns + 1, Math.ceil(chaseRuns));
  setResult(resultBox, `Bowling first: if GT allows ${oppRuns} runs in ${oppOvers.toFixed(1)} overs, GT must chase at least ${minimalChase} runs in ${chaseOvers.toFixed(1)} overs to reach target NRR ${current.targetNRR.toFixed(3)}.`);
}

function handleStrikeForm(event) {
  event.preventDefault();
  const runs = parseInt(document.getElementById('strikeRuns').value, 10);
  const balls = parseInt(document.getElementById('strikeBalls').value, 10);
  const resultBox = document.getElementById('strikeResult');
  if (balls <= 0) {
    setResult(resultBox, 'Balls faced must be greater than zero.');
    return;
  }
  const strikeRate = (runs / balls) * 100;
  setResult(resultBox, `Strike Rate: ${strikeRate.toFixed(2)}%`);
}

function handleEconomyForm(event) {
  event.preventDefault();
  const runs = parseInt(document.getElementById('economyRuns').value, 10);
  const overs = formatOvers(document.getElementById('economyOvers').value);
  const resultBox = document.getElementById('economyResult');
  if (!Number.isFinite(runs) || !Number.isFinite(overs) || overs <= 0) {
    setResult(resultBox, 'Please enter valid runs and overs in cricket format (e.g. 4.2 for 4 overs and 2 balls).');
    return;
  }
  const economy = runs / overs;
  setResult(resultBox, `Economy Rate: ${economy.toFixed(2)} runs per over`);
}

function addSubmitHandler(formId, handler) {
  const form = document.getElementById(formId);
  if (form) {
    form.addEventListener('submit', handler);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  addSubmitHandler('teamsForm', handleTeamsForm);
  addSubmitHandler('nrrTargetBattingForm', handleNRRTargetBattingForm);
  addSubmitHandler('nrrTargetBowlingForm', handleNRRTargetBowlingForm);
  addSubmitHandler('strikeForm', handleStrikeForm);
  addSubmitHandler('economyForm', handleEconomyForm);
});
