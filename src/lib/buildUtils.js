export const STATS = [
  { key: 'hp',  label: 'HP',  desc: 'Max health',                base: 120, perPt: 25 },
  { key: 'atk', label: 'ATK', desc: 'Bonus damage on every hit', base: 0,   perPt: 4  },
  { key: 'def', label: 'DEF', desc: 'Flat damage reduction',     base: 0,   perPt: 3  },
  { key: 'spd', label: 'SPD', desc: 'Determines turn order',     base: 1,   perPt: 1  },
  { key: 'mp',  label: 'MP',  desc: 'Max mana',                  base: 20,  perPt: 3  },
];

export function computeBuildFromPoints(pts) {
  return Object.fromEntries(
    STATS.map(s => [s.key, s.base + (pts?.[s.key] ?? 0) * s.perPt])
  );
}
