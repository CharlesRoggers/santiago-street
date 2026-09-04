/**
 * Gameplay tuning. Everything here is DATA, not code (§78): designers change
 * numbers, not systems. Values are metres, seconds, metres/second.
 *
 * Tuning philosophy (§17): arcade-responsive, not simulation-realistic.
 */
export interface SimConfig {
  /** Fixed simulation step in seconds. 60 Hz keeps input latency ≤ 16 ms. */
  fixedDt: number;

  movement: {
    /** Walk/run max speed at attribute 0 and 1. */
    runSpeedMin: number;
    runSpeedMax: number;
    /** Sprint multiplier on top of run speed. */
    sprintMultiplier: number;
    /** Ground acceleration (m/s²) at attribute 0 and 1. */
    accelMin: number;
    accelMax: number;
    /** Deceleration when input released — high value = snappy stops. */
    decel: number;
    /** Max turn rate in rad/s. */
    turnRate: number;
    /** Speed penalty while dribbling (0.85 = 15% slower). */
    dribbleSpeedFactor: number;
    /** Player collision radius. */
    radius: number;
  };

  stamina: {
    max: number;
    sprintDrainPerSec: number;
    regenPerSec: number;
    /** Regen only after this many seconds without sprinting. */
    regenDelay: number;
    /** Below this fraction sprint speed is reduced linearly. */
    tiredThreshold: number;
    /** Sprint multiplier when fully exhausted. */
    exhaustedSprintMultiplier: number;
    tackleCost: number;
  };

  ball: {
    radius: number;
    gravity: number;
    /** Rolling friction (m/s²) applied when on the ground. */
    rollingFriction: number;
    /** Velocity multiplier per second while airborne (air drag). */
    airDrag: number;
    /** Energy kept after bouncing on the ground / walls. */
    groundBounce: number;
    wallBounce: number;
    /** Below this vertical speed the ball stops bouncing. */
    bounceStopSpeed: number;
    /** Max speed the ball can have (anti-explosion). */
    maxSpeed: number;
  };

  possession: {
    /** Distance from player centre within which a loose ball can be controlled. */
    controlRadius: number;
    /** Max relative ball speed a player can control, at attribute 0 and 1. */
    controlSpeedMin: number;
    controlSpeedMax: number;
    /** Ball can't be controlled above this height. */
    controlMaxHeight: number;
    /** Offset of the ball in front of the player while dribbling. */
    dribbleOffset: number;
    /** How quickly the ball follows the feet while dribbling (per second). */
    dribbleFollow: number;
    /** Seconds after kicking during which the kicker cannot regain control. */
    kickCooldown: number;
    /** Seconds after being tackled/losing ball during which the loser cannot regain. */
    loseCooldown: number;
  };

  pass: {
    speedMin: number;
    speedMax: number;
    /** Ball speed per metre of distance to target. */
    speedPerMetre: number;
    lobSpeedMultiplier: number;
    lobVerticalSpeed: number;
    /** Max angle (rad) between input direction and teammate for auto-targeting. */
    targetCone: number;
    /** Inaccuracy angle (rad) at attribute 0 and 1. */
    errorMin: number;
    errorMax: number;
  };

  shot: {
    speedMin: number;
    speedMax: number;
    /** Vertical velocity share at low and high power. */
    liftMin: number;
    liftMax: number;
    /** Placement: how far from goal centre the aim can move (fraction of half goal width). */
    placementRange: number;
    errorMin: number;
    errorMax: number;
    /** Seconds needed to charge from 0 to full power. */
    chargeTime: number;
  };

  tackle: {
    radius: number;
    /** Base success chance; modulated by defense vs dribble attributes. */
    baseChance: number;
    attributeInfluence: number;
    /** Stun durations in seconds. */
    failStun: number;
    victimStun: number;
    /** Knock impulse applied to a loose ball on success. */
    ballImpulse: number;
    cooldown: number;
  };

  match: {
    kickoffDelay: number;
    goalCelebrationTime: number;
    /** Ball is reset if it leaves play (open courts) after this long. */
    outOfPlayReset: number;
  };
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  fixedDt: 1 / 60,

  movement: {
    runSpeedMin: 5.0,
    runSpeedMax: 7.0,
    sprintMultiplier: 1.35,
    accelMin: 18,
    accelMax: 30,
    decel: 40,
    turnRate: 12,
    dribbleSpeedFactor: 0.85,
    radius: 0.35
  },

  stamina: {
    max: 100,
    sprintDrainPerSec: 22,
    regenPerSec: 14,
    regenDelay: 0.6,
    tiredThreshold: 0.3,
    exhaustedSprintMultiplier: 1.05,
    tackleCost: 8
  },

  ball: {
    radius: 0.11,
    gravity: 9.81,
    rollingFriction: 3.2,
    airDrag: 0.25,
    groundBounce: 0.55,
    wallBounce: 0.65,
    bounceStopSpeed: 0.8,
    maxSpeed: 32
  },

  possession: {
    controlRadius: 0.75,
    controlSpeedMin: 9,
    controlSpeedMax: 16,
    controlMaxHeight: 1.3,
    dribbleOffset: 0.5,
    dribbleFollow: 18,
    kickCooldown: 0.25,
    loseCooldown: 0.4
  },

  pass: {
    speedMin: 7,
    speedMax: 17,
    speedPerMetre: 1.1,
    lobSpeedMultiplier: 0.8,
    lobVerticalSpeed: 6.5,
    targetCone: Math.PI * 0.45,
    errorMin: 0.14,
    errorMax: 0.02
  },

  shot: {
    speedMin: 12,
    speedMax: 26,
    liftMin: 0.05,
    liftMax: 0.22,
    placementRange: 0.9,
    errorMin: 0.22,
    errorMax: 0.06,
    chargeTime: 0.7
  },

  tackle: {
    radius: 1.1,
    baseChance: 0.55,
    attributeInfluence: 0.35,
    failStun: 0.7,
    victimStun: 0.45,
    ballImpulse: 5,
    cooldown: 0.9
  },

  match: {
    kickoffDelay: 1.2,
    goalCelebrationTime: 2.5,
    outOfPlayReset: 1.5
  }
};
