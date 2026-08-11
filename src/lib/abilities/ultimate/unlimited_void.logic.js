import { isFingerExtended, isFingerHalfBent, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Unlimited Void', category: 'ultimate', color: '#c8a8ff',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Index finger up, middle finger slightly curled',
  gestureType: 'single',
  undodgeable: true,
  turnType: 'domain',
  turnAmount: 4,
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    return (
      isFingerExtended(lm, 8)  &&
      isFingerHalfBent(lm, 12) &&
      isFingerCurled(lm,   16) &&
      isFingerCurled(lm,   20)
    );
  },
  domainTick() { return { stunOpponent: 1 }; },
  resolve() { return { stunTurns: 1 }; },
};
