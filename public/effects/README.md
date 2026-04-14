# Effect Assets

Drop MP4 files here. Each ability has a `caster.mp4` (played on the caster's camera) and `target.mp4` (played on the target's camera). Domain abilities use `bg.mp4` for background replacement.

## Expected files

### Overlay effects (play in front of camera)
| Path | Description |
|------|-------------|
| `strike/caster.mp4` | Fist strike launching |
| `strike/target.mp4` | Getting punched |
| `death_ball/caster.mp4` | Dark energy sphere forming + launching |
| `death_ball/target.mp4` | Purple flash / impact |
| `kamehameha/caster.mp4` | Blue beam firing |
| `kamehameha/target.mp4` | Blue energy impact |
| `spirit_bomb/caster.mp4` | Golden sphere descending |
| `spirit_bomb/target.mp4` | Golden explosion impact |
| `instant_transmission/caster.mp4` | Golden teleport flash |
| `instant_transmission/target.mp4` | *(no target effect)* |
| `heal/caster.mp4` | Pink healing glow |
| `heal/target.mp4` | *(no target effect)* |
| `iron_wall/caster.mp4` | Blue shield forming |
| `iron_wall/target.mp4` | *(no target effect)* |
| `power_up/caster.mp4` | Orange energy burst |
| `power_up/target.mp4` | *(no target effect)* |
| `expose/caster.mp4` | Pink targeting reticle |
| `expose/target.mp4` | Pink targeting reticle on the target |
| `sharingan/caster.mp4` | Red eye activation |
| `sharingan/target.mp4` | Red eye stare effect |
| `web_shot/caster.mp4` | Web launching |
| `web_shot/target.mp4` | Getting webbed |
| `mahoraga/caster.mp4` | Blue wheel summoning |
| `mahoraga/target.mp4` | Wheel impact |

### Background replacement (domain expansions — loop while domain is active)
| Path | Description |
|------|-------------|
| `unlimited_void/bg.mp4` | Dark void / space background loop |
| `malevolent_shrine/bg.mp4` | Red shrine / cursed temple loop |
| `sacred_ground/bg.mp4` | Golden heavenly ground loop |

## Notes
- All files should be encoded as H.264 MP4 for maximum browser compatibility
- Overlay files: 1–3 seconds, no audio required
- Background files: seamlessly loopable, no audio required
- Missing files are silently ignored — the CSS fallback effect plays instead
