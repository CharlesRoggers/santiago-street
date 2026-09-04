/**
 * @ss/shared — code that runs identically on client and server:
 * schemas (zod), the deterministic match simulation, AI, and progression rules.
 *
 * Rule: nothing in this package may import from DOM, Node, three.js or colyseus.
 */
export * from "./math/vec2";
export * from "./math/random";
export * from "./schemas";
export * from "./sim";
export * from "./progression/rewards";
export * from "./net/protocol";
