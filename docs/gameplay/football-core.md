# Football core — how it works today

- **Movement** (`sim/movement.ts`): target-velocity model with strong acceleration (18–30 m/s²
  by attribute) and stronger deceleration (40) for snappy stops; turn-rate-limited facing;
  sprint ×1.35 with stamina fall-off below 30 %; dribbling slows to 85 %.
- **Ball** (`sim/ball.ts`): gravity, rolling friction, air drag, ground/wall restitution, fenced
  court with goal openings; walk-in goals count.
- **Possession** (`sim/possession.ts`): control radius 0.75 m, max controllable relative speed by
  `control` attribute, kick/lose cooldowns; controlled ball chases a point 0.5 m ahead with finite
  follow speed (visible carry on turns). Loose ball that cannot be controlled **deflects off bodies**.
- **Pass** (`sim/actions.ts`): auto-target teammate inside a cone around stick direction, lead the
  runner, speed ∝ distance; lob adds vertical velocity. Error shrinks with `pass` attribute.
- **Shot**: hold-to-charge (0.7 s), power → speed 12–26 m/s and lift; stick x places the shot
  within the goal; error grows with power, shrinks with `shot` attribute.
- **Tackle**: radius 1.1 m, success = 0.55 + 0.35·(defense − dribble), failure stuns the tackler
  0.7 s (makes tackling a decision, not spam), success knocks the ball loose.
- **Rules**: FIRST_TO 5 or 6 minutes, whichever first. Others are data-ready, not tuned.

Tuning lives in `sim/config.ts`. Balance snapshot (bots vs bots, 16 seeds, 5 min):
~11 goals/match, ~250 passes, ~60 tackles (≈55 % success). Known issues: team B wins more
often than A (10/16) — investigate asymmetry; kickoff defence is weak against a straight sprint.
