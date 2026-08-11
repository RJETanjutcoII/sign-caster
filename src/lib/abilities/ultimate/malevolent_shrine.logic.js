import { dist, isFingerExtended, isFingerCurled } from '@/lib/gestures';

function isPressedShape(lm) {
  return (
    isFingerExtended(lm, 12) &&
    isFingerExtended(lm, 16) &&
    isFingerCurled(lm,   8)  &&
    isFingerCurled(lm,   20)
  );
}

export default {
  name: 'Malevolent Shrine', category: 'ultimate', color: '#ff3333',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Middle + ring fingers up, index + pinky down — both hands',
  gestureType: 'two-hand',
  turnType: 'domain',
  turnAmount: 3,
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isPressedShape(lm0) && isPressedShape(lm1) && dist(lm0[0], lm1[0]) < 0.7;
  },
  domainTick() { return { damageOpponent: 15 }; },
  resolve() { return {}; },
};
