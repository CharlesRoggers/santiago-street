import { MapSchema, Schema, defineTypes } from "@colyseus/schema";

/**
 * Replicated match state (§93: replicate only what clients need to render).
 * Cosmetics, attributes and internal cooldowns are NOT replicated.
 *
 * IMPORTANT (ADR-006): fields are declared with `declare` and assigned in the
 * constructor. With `target: ES2022`, class-field initializers would create own
 * properties that shadow the accessors @colyseus/schema installs on the
 * prototype, and nothing would ever be encoded. `defineTypes` (not decorators)
 * keeps this working identically under tsx, vitest and tsup.
 */
export class NetPlayer extends Schema {
  declare id: string;
  declare team: "A" | "B";
  declare isBot: boolean;
  declare sessionId: string;
  declare x: number;
  declare z: number;
  declare facing: number;
  declare stamina: number;
  declare hasBall: boolean;
  declare stunned: boolean;

  constructor() {
    super();
    this.id = "";
    this.team = "A";
    this.isBot = false;
    this.sessionId = "";
    this.x = 0;
    this.z = 0;
    this.facing = 0;
    this.stamina = 100;
    this.hasBall = false;
    this.stunned = false;
  }
}
defineTypes(NetPlayer, {
  id: "string",
  team: "string",
  isBot: "boolean",
  sessionId: "string",
  x: "float32",
  z: "float32",
  facing: "float32",
  stamina: "uint8",
  hasBall: "boolean",
  stunned: "boolean"
});

export class NetBall extends Schema {
  declare x: number;
  declare y: number;
  declare z: number;
  declare vx: number;
  declare vz: number;
  declare ownerId: string;

  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.ownerId = "";
  }
}
defineTypes(NetBall, { x: "float32", y: "float32", z: "float32", vx: "float32", vz: "float32", ownerId: "string" });

export class NetMatch extends Schema {
  declare phase: string;
  declare clock: number;
  declare scoreA: number;
  declare scoreB: number;
  declare winner: string;
  declare tick: number;

  constructor() {
    super();
    this.phase = "WARMUP";
    this.clock = 0;
    this.scoreA = 0;
    this.scoreB = 0;
    this.winner = "";
    this.tick = 0;
  }
}
defineTypes(NetMatch, {
  phase: "string",
  clock: "float32",
  scoreA: "uint8",
  scoreB: "uint8",
  winner: "string",
  tick: "uint32"
});

export class MatchRoomState extends Schema {
  declare players: MapSchema<NetPlayer>;
  declare ball: NetBall;
  declare match: NetMatch;
  declare seed: number;
  declare courtWidth: number;
  declare courtLength: number;

  constructor() {
    super();
    this.players = new MapSchema<NetPlayer>();
    this.ball = new NetBall();
    this.match = new NetMatch();
    this.seed = 0;
    this.courtWidth = 20;
    this.courtLength = 32;
  }
}
defineTypes(MatchRoomState, {
  players: { map: NetPlayer },
  ball: NetBall,
  match: NetMatch,
  seed: "uint32",
  courtWidth: "float32",
  courtLength: "float32"
});
