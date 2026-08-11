import { dist } from '@/lib/gestures';

export default {
  name: 'Spirit Bomb', category: 'ultimate', color: '#ffffaa',
  manaCost: 0, ultCost: 5, ultGain: 0,
  turnType: 'multi', turnAmount: 2,
  gesture: 'Both open palms, arms spread wide',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    function isOpenPalm(lm) {
      const handSize = dist(lm[0], lm[9]);
      if (handSize < 0.01) return false;
      return [8, 12, 16, 20].filter(i => dist(lm[i], lm[0]) > handSize * 1.5).length >= 3;
    }
    return isOpenPalm(lm0) && isOpenPalm(lm1) && dist(lm0[0], lm1[0]) > 0.45;
  },
  resolve() { return { damage: 75 }; },
};
