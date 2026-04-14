export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-web-strand {
        0%   { opacity: 0; transform: scaleX(0) rotate(var(--r)); }
        15%  { opacity: 0.9; transform: scaleX(1) rotate(var(--r)); }
        70%  { opacity: 0.7; transform: scaleX(1) rotate(var(--r)); }
        100% { opacity: 0; transform: scaleX(1.05) rotate(var(--r)); }
      }
      @keyframes fx-web-splat {
        0%   { opacity: 0; transform: translate(-50%, -50%) scale(0); }
        20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        60%  { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); }
      }
      .fx-web-overlay {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(200, 220, 255, 0.08);
        animation: fx-web-strand 0.9s ease-out forwards;
      }
      .fx-web-strand {
        position: fixed;
        top: 50%; left: 50%;
        width: 55vw; height: 2px;
        background: linear-gradient(90deg, transparent, rgba(180, 210, 255, 0.85), transparent);
        transform-origin: left center;
        filter: blur(0.5px);
        animation: fx-web-strand 0.9s ease-out forwards;
      }
      .fx-web-splat {
        position: fixed; top: 50%; left: 50%;
        width: 90px; height: 90px;
        border-radius: 50%;
        border: 2px solid rgba(180, 210, 255, 0.6);
        animation: fx-web-splat 0.9s ease-out forwards;
      }
    `}</style>
    <div className="fx-web-overlay" />
    <div className="fx-web-strand" style={{ '--r': '-18deg', marginLeft: '-27.5vw', marginTop: '-1px' }} />
    <div className="fx-web-strand" style={{ '--r':  '5deg',  marginLeft: '-27.5vw', marginTop: '-1px' }} />
    <div className="fx-web-strand" style={{ '--r':  '28deg', marginLeft: '-27.5vw', marginTop: '-1px' }} />
    <div className="fx-web-splat" />
  </>
);

import { dist, isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Web Shot', category: 'support', color: '#aaccff',
  manaCost: 5, ultCost: 0, ultGain: 1,
  gesture: 'Spider-Man: thumb, index, and pinky extended; middle and ring curled',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    // Spider-Man pose: index and pinky point outward (not straight up), so use
    // looser 1.5× threshold rather than isFingerExtended's strict 1.7×
    const indexExtended = dist(lm[8],  lm[0]) > handSize * 1.5;
    const pinkyExtended = dist(lm[20], lm[0]) > handSize * 1.4;
    const middleCurled  = isFingerCurled(lm, 12);
    const ringCurled    = isFingerCurled(lm, 16);
    const thumbOut      = dist(lm[4],  lm[0]) > handSize * 1.2;
    return indexExtended && pinkyExtended && middleCurled && ringCurled && thumbOut;
  },
  Effect,
  videoEffects: {
    caster: { type: 'overlay', src: '/effects/web_shot/caster.mp4' },
    target: { type: 'overlay', src: '/effects/web_shot/target.mp4' },
  },
  resolve() { return { speedReduction: 1 }; },
};
