import type { ChatState } from '../../types/chat'

export const PET_ATLAS_V2 = {
  spriteVersionNumber: 2,
  columns: 8,
  rows: 11,
  cellWidth: 192,
  cellHeight: 208,
  width: 1536,
  height: 2288,
} as const

export const PET_ANIMATION_STATES = [
  'idle',
  'running-right',
  'running-left',
  'waving',
  'jumping',
  'failed',
  'waiting',
  'running',
  'review',
] as const

export type PetAnimationState = typeof PET_ANIMATION_STATES[number]

export type PetAnimationDefinition = Readonly<{
  rowIndex: number
  frameDurationsMs: readonly number[]
}>

export const PET_ANIMATION_DEFINITIONS = {
  idle: { rowIndex: 0, frameDurationsMs: [280, 110, 110, 140, 140, 320] },
  'running-right': { rowIndex: 1, frameDurationsMs: [120, 120, 120, 120, 120, 120, 120, 220] },
  'running-left': { rowIndex: 2, frameDurationsMs: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { rowIndex: 3, frameDurationsMs: [140, 140, 140, 280] },
  jumping: { rowIndex: 4, frameDurationsMs: [140, 140, 140, 140, 280] },
  failed: { rowIndex: 5, frameDurationsMs: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { rowIndex: 6, frameDurationsMs: [150, 150, 150, 150, 150, 260] },
  running: { rowIndex: 7, frameDurationsMs: [120, 120, 120, 120, 120, 220] },
  review: { rowIndex: 8, frameDurationsMs: [150, 150, 150, 150, 150, 280] },
} as const satisfies Record<PetAnimationState, PetAnimationDefinition>

export type PetAtlasFrame = Readonly<{
  rowIndex: number
  columnIndex: number
  x: number
  y: number
  width: number
  height: number
}>

export type PetAnimationFrame = PetAtlasFrame & Readonly<{
  frameIndex: number
  durationMs: number
}>

export const PET_ACTIVE_BURST_LOOPS = 3
export const PET_IDLE_DURATION_MULTIPLIER = 6

export type PetAnimationPlaybackPhase = 'action' | 'idle'

export type PetAnimationPlaybackStep = Readonly<{
  frame: PetAnimationFrame
  phase: PetAnimationPlaybackPhase
  cycleBoundaryAfter: boolean
}>

export type PetAnimationPlaybackTick = PetAnimationPlaybackStep & Readonly<{
  playbackIndex: number
  remainingDurationMs: number
}>

export function getPetAtlasFrame(rowIndex: number, columnIndex: number): PetAtlasFrame {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= PET_ATLAS_V2.rows) {
    throw new RangeError(`rowIndex must be between 0 and ${PET_ATLAS_V2.rows - 1}`)
  }
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= PET_ATLAS_V2.columns) {
    throw new RangeError(`columnIndex must be between 0 and ${PET_ATLAS_V2.columns - 1}`)
  }

  return {
    rowIndex,
    columnIndex,
    x: columnIndex * PET_ATLAS_V2.cellWidth,
    y: rowIndex * PET_ATLAS_V2.cellHeight,
    width: PET_ATLAS_V2.cellWidth,
    height: PET_ATLAS_V2.cellHeight,
  }
}

export function getPetAnimationFrames(state: PetAnimationState): readonly PetAnimationFrame[] {
  const definition = PET_ANIMATION_DEFINITIONS[state]

  return definition.frameDurationsMs.map((durationMs, frameIndex) => ({
    frameIndex,
    ...getPetAtlasFrame(definition.rowIndex, frameIndex),
    durationMs,
  }))
}

export function getPetAnimationPlaybackFrames(state: PetAnimationState): readonly PetAnimationFrame[] {
  const frames = getPetAnimationFrames(state)
  const idleSequence = getPetAnimationFrames('idle').map((frame) => ({
    ...frame,
    durationMs: frame.durationMs * PET_IDLE_DURATION_MULTIPLIER,
  }))
  if (state === 'idle') return idleSequence

  return [
    ...Array.from({ length: PET_ACTIVE_BURST_LOOPS }, () => frames).flat(),
    ...idleSequence,
  ]
}

export function getPetAnimationPlaybackLoopStartIndex(state: PetAnimationState): number {
  return state === 'idle'
    ? 0
    : getPetAnimationFrames(state).length * PET_ACTIVE_BURST_LOOPS
}

export function getNextPetAnimationPlaybackIndex(
  state: PetAnimationState,
  playbackIndex: number,
): number {
  if (!Number.isInteger(playbackIndex) || playbackIndex < 0) {
    throw new RangeError('playbackIndex must be a non-negative integer')
  }

  const playbackLength = getPetAnimationPlaybackFrames(state).length
  const normalizedIndex = playbackIndex % playbackLength
  return normalizedIndex + 1 < playbackLength
    ? normalizedIndex + 1
    : getPetAnimationPlaybackLoopStartIndex(state)
}

export function getPetAnimationPlaybackStep(
  state: PetAnimationState,
  playbackIndex: number,
): PetAnimationPlaybackStep {
  if (!Number.isInteger(playbackIndex) || playbackIndex < 0) {
    throw new RangeError('playbackIndex must be a non-negative integer')
  }

  const playback = getPetAnimationPlaybackFrames(state)
  const normalizedIndex = playbackIndex % playback.length
  const actionFrameCount = getPetAnimationPlaybackLoopStartIndex(state)

  if (normalizedIndex < actionFrameCount) {
    const actionCycleLength = getPetAnimationFrames(state).length
    return {
      frame: playback[normalizedIndex]!,
      phase: 'action',
      cycleBoundaryAfter: (normalizedIndex + 1) % actionCycleLength === 0,
    }
  }

  const idleIndex = normalizedIndex - actionFrameCount
  return {
    frame: playback[normalizedIndex]!,
    phase: 'idle',
    cycleBoundaryAfter: idleIndex === getPetAnimationFrames('idle').length - 1,
  }
}

export function getPetAnimationPlaybackTickAtElapsedMs(
  state: PetAnimationState,
  elapsedMs: number,
): PetAnimationPlaybackTick {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('elapsedMs must be a finite non-negative number')
  }

  const playback = getPetAnimationPlaybackFrames(state)
  const loopStartIndex = getPetAnimationPlaybackLoopStartIndex(state)
  const prefixDurationMs = playback
    .slice(0, loopStartIndex)
    .reduce((total, frame) => total + frame.durationMs, 0)
  const loopDurationMs = playback
    .slice(loopStartIndex)
    .reduce((total, frame) => total + frame.durationMs, 0)
  const totalDurationMs = prefixDurationMs + loopDurationMs
  const effectiveElapsedMs = elapsedMs >= totalDurationMs && loopDurationMs > 0
    ? prefixDurationMs + (elapsedMs - prefixDurationMs) % loopDurationMs
    : elapsedMs

  let remainingElapsedMs = effectiveElapsedMs
  for (let playbackIndex = 0; playbackIndex < playback.length; playbackIndex += 1) {
    const frame = playback[playbackIndex]!
    if (remainingElapsedMs < frame.durationMs) {
      return {
        ...getPetAnimationPlaybackStep(state, playbackIndex),
        playbackIndex,
        remainingDurationMs: frame.durationMs - remainingElapsedMs,
      }
    }
    remainingElapsedMs -= frame.durationMs
  }

  const playbackIndex = playback.length - 1
  return {
    ...getPetAnimationPlaybackStep(state, playbackIndex),
    playbackIndex,
    remainingDurationMs: playback[playbackIndex]!.durationMs,
  }
}

export function getPetAnimationDurationMs(state: PetAnimationState): number {
  return PET_ANIMATION_DEFINITIONS[state].frameDurationsMs.reduce(
    (total, durationMs) => total + durationMs,
    0,
  )
}

export function getPetAnimationFrameAtElapsedMs(
  state: PetAnimationState,
  elapsedMs: number,
  options: { loop?: boolean } = {},
): PetAnimationFrame {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('elapsedMs must be a finite non-negative number')
  }

  const frames = getPetAnimationFrames(state)
  const totalDurationMs = getPetAnimationDurationMs(state)
  const playbackMs = options.loop === false
    ? Math.min(elapsedMs, totalDurationMs)
    : elapsedMs % totalDurationMs
  let frameEndMs = 0

  for (const frame of frames) {
    frameEndMs += frame.durationMs
    if (playbackMs < frameEndMs) return frame
  }

  return frames[frames.length - 1]!
}

export const PET_LOOK_DIRECTIONS = [
  0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5,
  180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5,
] as const

export type PetLookDirection = typeof PET_LOOK_DIRECTIONS[number]

export const PET_NEUTRAL_LOOK_FRAME = getPetAtlasFrame(0, 6)

export type PetLookFrame = PetAtlasFrame & Readonly<{
  directionDegrees: PetLookDirection | null
}>

export function getPetLookFrame(directionDegrees: PetLookDirection | null): PetLookFrame {
  if (directionDegrees === null) {
    return {
      directionDegrees,
      ...PET_NEUTRAL_LOOK_FRAME,
    }
  }

  const directionIndex = PET_LOOK_DIRECTIONS.indexOf(directionDegrees)
  if (directionIndex < 0) {
    throw new RangeError('directionDegrees must be a supported 22.5-degree step')
  }

  const rowIndex = directionIndex < PET_ATLAS_V2.columns ? 9 : 10
  const columnIndex = directionIndex % PET_ATLAS_V2.columns

  return {
    directionDegrees,
    ...getPetAtlasFrame(rowIndex, columnIndex),
  }
}

export function quantizePetLookDirection(
  deltaX: number,
  deltaY: number,
  deadzone = 0,
): PetLookDirection | null {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new RangeError('look vector must contain finite numbers')
  }
  if (!Number.isFinite(deadzone) || deadzone < 0) {
    throw new RangeError('deadzone must be a finite non-negative number')
  }

  const distance = Math.hypot(deltaX, deltaY)
  if (distance === 0 || distance <= deadzone) return null

  const clockwiseDegrees = Math.atan2(deltaX, -deltaY) * 180 / Math.PI
  const normalizedDegrees = (clockwiseDegrees + 360) % 360
  const directionIndex = Math.round(normalizedDegrees / 22.5) % PET_LOOK_DIRECTIONS.length

  return PET_LOOK_DIRECTIONS[directionIndex]!
}

export function resolvePetLookFrame(
  deltaX: number,
  deltaY: number,
  deadzone = 0,
): PetLookFrame {
  return getPetLookFrame(quantizePetLookDirection(deltaX, deltaY, deadzone))
}

export const PET_CHAT_STATE_ANIMATIONS = {
  idle: 'idle',
  thinking: 'running',
  compacting: 'running',
  tool_executing: 'running',
  streaming: 'running',
  permission_pending: 'waiting',
} as const satisfies Record<ChatState, PetAnimationState>

export const PET_TRANSIENT_ANIMATIONS = {
  completion: 'jumping',
  error: 'failed',
  interaction: 'waving',
  review: 'review',
  'drag-left': 'running-left',
  'drag-right': 'running-right',
} as const satisfies Record<string, PetAnimationState>

export type PetAnimationTransient = keyof typeof PET_TRANSIENT_ANIMATIONS

export function resolvePetAnimationState({
  chatState,
  transient,
}: {
  chatState: ChatState
  transient?: PetAnimationTransient | null
}): PetAnimationState {
  return transient
    ? PET_TRANSIENT_ANIMATIONS[transient]
    : PET_CHAT_STATE_ANIMATIONS[chatState]
}
