// Playtest round 9, tester C: log Site 13 per endless day (POLICY=pt9c-rival). Read-only: buys nothing, moves nobody.
export default function make(ctx) {
  const { crew } = ctx;
  const rows = [];
  return {
    shiftEnd(rep) {
      if (crew.endless && rep?.rival) rows.push(`d${rep.day} ${rep.rival.win ? 'W' : 'L'}${rep.rival.poached ? 'p' : ''} ${(rep.rival.cash / rep.rival.target).toFixed(2)} acq ${crew.records?.rival?.acquired ?? 0} wk ${crew.records?.rival?.week}:${crew.records?.rival?.wins}/${crew.records?.rival?.days} cash ${(crew.cash / 1e6).toFixed(0)}M statue ${crew.up.owner ?? 0}`);
      return {};
    },
    summary() { return ['RIVAL ' + rows.join(' | ')]; },
  };
}
