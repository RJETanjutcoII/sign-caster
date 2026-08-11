import fist                 from './basic/fist.logic.js';
import finger_gun           from './basic/finger_gun.logic.js';

import death_ball           from './special/death_ball.logic.js';
import kamehameha           from './special/kamehameha.logic.js';

import spirit_bomb          from './ultimate/spirit_bomb.logic.js';
import unlimited_void       from './ultimate/unlimited_void.logic.js';
import malevolent_shrine    from './ultimate/malevolent_shrine.logic.js';
import mahoraga             from './ultimate/mahoraga.logic.js';
import sacred_ground        from './ultimate/sacred_ground.logic.js';

import instant_transmission from './support/instant_transmission.logic.js';
import thumbs_up            from './support/thumbs_up.logic.js';
import web_shot             from './support/web_shot.logic.js';
import double_v             from './support/double_v.logic.js';
import iron_wall            from './support/iron_wall.logic.js';
import power_up             from './support/power_up.logic.js';
import expose               from './support/expose.logic.js';

import sharingan             from './augmentation/sharingan.logic.js';

// Logic-only mirror of ./index.js — same keys, no JSX/Effect/videoEffects.
// Safe to import from a plain Node process (the WS relay) since nothing
// here touches React or the DOM. Kept as a separate file (rather than
// having gameState.js import the client index and ignore the JSX fields)
// because Node can't even parse a .jsx file, whether or not it calls into it.
export const ABILITIES = {
  fist,
  finger_gun,
  death_ball,
  kamehameha,
  spirit_bomb,
  unlimited_void,
  malevolent_shrine,
  mahoraga,
  sacred_ground,
  instant_transmission,
  thumbs_up,
  web_shot,
  double_v,
  iron_wall,
  power_up,
  expose,
  sharingan,
};
