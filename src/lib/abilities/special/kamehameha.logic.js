import { dist } from '@/lib/gestures';

function isOpenPalm(lm) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  const tips = [8, 12, 16, 20];
  return tips.filter(i => dist(lm[i], lm[0]) > handSize * 1.5).length >= 3;
}

export default {
  name: 'Kamehameha', category: 'special', color: '#44aaff',
  manaCost: 5, ultCost: 0, ultGain: 2,
  gesture: 'Both open palms, wrists pressed together',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isOpenPalm(lm0) && isOpenPalm(lm1) && dist(lm0[0], lm1[0]) < 0.35;
  },
  resolve() { return { damage: 30 }; },
};
