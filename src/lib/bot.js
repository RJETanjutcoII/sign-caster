import { ABILITIES } from './abilities';

export const BOT_LOADOUT = new Set(['fist', 'finger_gun', 'kamehameha', 'thumbs_up', 'sacred_ground']);

// 3 pts HP, 2 pts ATK, 2 pts DEF, 1 pt SPD, 2 pts MP — well-rounded
export const BOT_BUILD = { hp: 195, atk: 8, def: 6, spd: 2, mp: 26 };

export function chooseBotGesture(state, loadout) {
  const canAfford = key => {
    const ab = ABILITIES[key];
    if (!ab) return false;
    return (ab.manaCost || 0) <= state.mana && (ab.ultCost || 0) <= state.ultBar;
  };
  const available = [...loadout].filter(canAfford);

  // Heal if HP below 40%
  const heal = available.find(k => ABILITIES[k]?.resolve?.()?.healSelf > 0);
  if (heal && state.hp < state.maxHp * 0.4) return heal;

  // Use ult if available
  const ult = available.find(k => ABILITIES[k]?.category === 'ultimate');
  if (ult) return ult;

  // Use special if affordable
  const special = available.find(k => ABILITIES[k]?.category === 'special');
  if (special) return special;

  // Random basic attack
  const basics = available.filter(k => ABILITIES[k]?.category === 'basic');
  if (basics.length) return basics[Math.floor(Math.random() * basics.length)];

  return null; // rest
}
