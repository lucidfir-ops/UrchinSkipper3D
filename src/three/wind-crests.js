// A wind-relative field keeps crests travelling with the actual wind, including
// when simulation time pauses. Warped placement removes straight rows without
// adding particles or per-frame CPU work. Uses the water shader's noise helpers.
export const windCrestFragment = /* glsl */ `
  float windCrests(vec2 p, vec2 velocity, float time) {
    float speed = length(velocity);
    if (speed <= .2) return 0.0;
    vec2 along = velocity / speed;
    vec2 across = vec2(-along.y, along.x);
    float strength = clamp(speed / 15.0, 0.0, 1.0);
    vec2 travel = vec2(dot(p, across), dot(p, along) - time * (.35 + speed * .10));
    vec2 warp = vec2(valueNoise(travel * .031), valueNoise(travel * .027 + 71.0));
    vec2 field = travel + (warp - .5) * 11.0;
    vec2 cellSize = vec2(12.0, 14.0);
    vec2 cell = floor(field / cellSize);
    float seed = hash(cell);
    float shape = hash(cell + 19.0);
    float placement = hash(cell + 43.0);
    vec2 local = mod(field, cellSize) - cellSize * .5;
    local -= vec2(shape - .5, placement - .5) * vec2(4.4, 8.0);
    float halfWidth = mix(.45, 2.65, strength) * (.5 + placement * .82);
    float ends = 1.0 - smoothstep(halfWidth * .35, halfWidth, abs(local.x));
    // Asymmetric, broken strokes replace the identical little crescent glyphs.
    float front = local.y + local.x * (shape - .5) * .5
      + local.x * local.x * (seed - .45) * .14;
    float grain = valueNoise(travel * 2.4 + cell * 3.7);
    front += (grain - .5) * (.10 + strength * .13);
    float thickness = (.075 + strength * .12) * (.65 + shape * .7);
    float crest = exp(-pow(front / thickness, 2.0));
    float broken = smoothstep(.18, .64, grain) * (.65 + placement * .35);
    float lifetime = smoothstep(.12, .8, .5 + .5 * sin(time * (.43 + shape * .30) + seed * 24.0));
    float coverage = smoothstep(1.02 - strength * .76, 1.08 - strength * .76,
      seed + (warp.x - .5) * .30);
    return crest * ends * broken * lifetime * coverage
      * smoothstep(.2, 7.0, speed) * (.16 + strength * .28);
  }
`;
