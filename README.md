# Sign Caster

A turn-based gesture combat game. Show hand signs to your webcam to cast abilities. No keyboard input during combat.

Built with Next.js 16, React 19, and MediaPipe Tasks Vision.

---

## How it works

Each turn you have **5 seconds** to hold a gesture. Hold it for 300ms and it locks in. When the timer hits zero, the move fires and you see the effect for **4 seconds** before the next turn begins.

Gesture detection runs at ~30fps using two MediaPipe models loaded in the browser:
- **HandLandmarker** (GPU) — tracks up to 2 hands, 21 landmarks each
- **FaceLandmarker** (CPU) — tracks 478 face landmarks, only loaded when a face-gesture ability is in your loadout

---

## Abilities

### Basic
| Name | Gesture | Effect |
|---|---|---|
| Strike | Fist | 10 damage |
| Finger Gun | Index pointed, others curled | 15 damage |

### Special
| Name | Gesture | Cost | Effect |
|---|---|---|---|
| Point | Index + middle extended toward face | 5 MP | 20 damage |
| Kamehameha | Both hands open, wrists together | 5 MP | 20 damage |

### Ultimate
| Name | Gesture | Cost | Effect |
|---|---|---|---|
| Spirit Bomb | Both open palms spread wide | 5 ult | 50 damage (2-turn charge) |
| Unlimited Void | Index extended, middle half-bent | 5 ult | Domain — 3 turns |
| Malevolent Shrine | Thumbs down | 5 ult | Domain — 3 turns |
| Sacred Ground | — | 5 ult | Domain — 3 turns, +3 MP/turn |

### Support
| Name | Gesture | Cost | Effect |
|---|---|---|---|
| Instant Transmission | Two fingers to forehead | 10 MP | Nullify all incoming damage this turn |
| Thumbs Up | Thumbs up | — | +20 HP |

### Innate
| Name | Trigger | Effect |
|---|---|---|
| Sharingan | Wink (close one eye) | Activates Sharingan visual |

---

## Turn types

**Single-turn** — fires immediately when the timer hits zero.

**Multi-turn** — costs are verified on cast but not paid until the final turn. The move locks itself in and forces the next turn regardless of what you show. Spirit Bomb takes 2 turns: turn 1 charges, turn 2 fires.

**Domain** — activates once, then persists as a background passive for N turns. Each turn start, `domainTick()` runs (mana regen, heals, etc.). The background visual stays on screen until the domain expires. Only one domain can be active at a time — casting a new one replaces the old.

---

## Loadout

Before combat, pick up to:
- 3 Basic attacks
- 1 Special
- 1 Ultimate
- 1 Support
- 1 Innate

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Grant camera access when prompted. MediaPipe models are downloaded from CDN on first load (~10 seconds).

---

## Adding an ability

Create `src/lib/abilities/<category>/<name>.jsx`. The default export is the ability definition:

```js
export default {
  name: 'My Ability',
  category: 'basic',         // basic | special | ultimate | support | innate
  color: '#ffffff',          // HUD accent color
  manaCost: 0,
  ultCost: 0,
  ultGain: 1,
  gesture: 'Description shown in loadout',
  gestureType: 'single',     // single | two-hand | face
  turnType: 'single',        // single | multi | domain
  turnAmount: 1,             // turns to charge/persist (multi/domain only)

  detect(hands, face) {
    // hands: array of landmark arrays (up to 2)
    // face: array of 478 landmarks, or null
    // return true when the gesture is being held
  },

  resolve({ caster }) {
    // return { damage, healSelf, stunTurns, dot, nullifySelf }
  },

  Effect: () => <div />,        // one-shot visual when it fires
  ChargeEffect: () => <div />,  // visual during charge phase (multi-turn only)
  LoopEffect: () => <div />,    // persistent background (multi-turn / domain)

  domainTick({ caster }) {
    // domain only — called each turn while active
    // return { manaRegen, healSelf }
  },
};
```

Then register it in `src/lib/abilities/index.js`:

```js
import my_ability from './basic/my_ability.jsx';

export const ABILITIES = {
  // ...existing
  my_ability,
};
```

### Gesture helpers (`src/lib/gestures.js`)

```js
dist(a, b)                    // Euclidean distance between two landmarks
isFingerExtended(lm, tipIdx)  // tip far from wrist (ratio > 1.7)
isFingerHalfBent(lm, tipIdx)  // tip moderately close (ratio 1.1–1.6)
isFingerCurled(lm, tipIdx)    // tip close to wrist (ratio < 1.4)
```

Landmark indices: `0` = wrist, `4` = thumb tip, `8` = index tip, `12` = middle tip, `16` = ring tip, `20` = pinky tip.

---

## Roadmap

- **Multiplayer** — real-time PvP where both players' moves resolve simultaneously
- **Damage system** — opponent state, incoming damage application, win/loss conditions
- **Original ability names** — current names are placeholders for development reference
- **2D camera effects** — visual effects composited directly onto the live camera feed (e.g. actual flames, energy, overlays anchored to your hands/face in real space)

---

## Project structure

```
src/
  app/                     Next.js app router entry
  components/
    GameCanvas.js          Main game loop — camera, MediaPipe, turn timer, rendering
    DomainLayer.js         React portal for domain LoopEffects (escapes overflow:hidden)
    LoadoutSelect.js       Pre-game ability picker
    StatsHUD.js            HP / mana / ult bar
    AbilityDisplay.js      Live gesture indicator
    LoadoutHUD.js          In-game loadout reference
  lib/
    gameState.js           Turn logic — applyStartOfTurn, resolveTurn, applyIncoming
    gestures.js            Finger state helpers + detectThumbsDown
    abilities/
      index.js             Ability registry
      basic/               fist, finger_gun
      special/             point, kamehameha
      ultimate/            spirit_bomb, unlimited_void, malevolent_shrine, sacred_ground, mahoraga
      support/             instant_transmission, thumbs_up
      augmentation/        sharingan
    effects/               Shared generic effects (rest, fail, stun)
```
