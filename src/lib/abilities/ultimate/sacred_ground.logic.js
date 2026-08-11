import { dist } from '@/lib/gestures';

export default {
  name: 'Sacred Ground', category: 'ultimate', color: '#ffcc44',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Open hand, palm facing camera',
  gestureType: 'single',
  turnType: 'domain',
  turnAmount: 3,
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const extendedCount = tips.filter(i => dist(lm[i], lm[0]) > handSize * 1.5).length;
    return extendedCount >= 3;
  },
  domainTick() { return { manaRegen: 3 }; },
  resolve() { return {}; },
};
