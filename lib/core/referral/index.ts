/**
 * Multi-level referral engine. Barrel export for the provider-agnostic core:
 * policy (config), signals (hashed anti-abuse data), relations (chain lifecycle),
 * risk (scoring), verification (channel-gate bridge) and reward (pending →
 * approved wallet credit). Business logic lives here; routes/handlers/UI only
 * orchestrate these functions.
 */
export * from "./types"
export * from "./policy"
export * from "./signals"
export * from "./relations"
export * from "./risk"
export * from "./verification"
export * from "./reward"
