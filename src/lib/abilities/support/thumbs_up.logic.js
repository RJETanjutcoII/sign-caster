import { dist } from '@/lib/gestures';

export default {
  name: 'Heal', category: 'support', color: '#ff6699',
  manaCost: 5, ultCost: 0, ultGain: 0,
  gesture: 'Fist with thumb raised up',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const closedCount = tips.filter(i => dist(lm[i], lm[0]) < handSize * 1.6).length;
    if (closedCount < 3) return false;
    return lm[4].y < lm[0].y - handSize * 0.9;
  },
  resolve() { return { healSelf: 15 }; },
};
