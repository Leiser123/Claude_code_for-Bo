import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getContextWindowForModel, modelSupports1M } from '../context.js'
import { getAgentModel, getAgentModelOptions } from './agent.js'
import { isModelAlias, isModelFamilyAlias } from './aliases.js'
import { CLAUDE_FABLE_5_CONFIG } from './configs.js'
import {
  firstPartyNameToCanonical,
  getDefaultFableModel,
  getMarketingNameForModel,
  getPublicModelDisplayName,
  parseUserSpecifiedModel,
} from './model.js'
import { getModelStrings } from './modelStrings.js'
import { get3PModelCapabilityOverride } from './modelSupportOverrides.js'

const ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL_SUPPORTED_CAPABILITIES',
  'CLAUDE_CODE_DISABLE_1M_CONTEXT',
  'CLAUDE_CODE_SUBAGENT_MODEL',
] as const

let originalEnv: Record<(typeof ENV_KEYS)[number], string | undefined>

beforeEach(() => {
  originalEnv = Object.fromEntries(
    ENV_KEYS.map(key => [key, process.env[key]]),
  ) as typeof originalEnv
  for (const key of ENV_KEYS) delete process.env[key]
  clearCapabilityCache()
})

afterEach(() => {
  for (const key of ENV_KEYS) restoreEnv(key, originalEnv[key])
  clearCapabilityCache()
})

describe('Fable model configuration', () => {
  test('uses the official provider IDs', () => {
    expect(CLAUDE_FABLE_5_CONFIG).toEqual({
      firstParty: 'claude-fable-5',
      bedrock: 'us.anthropic.claude-fable-5',
      vertex: 'claude-fable-5',
      foundry: 'claude-fable-5',
      azureOpenAI: 'claude-fable-5',
    })
  })

  test('recognizes fable as an alias and model family', () => {
    expect(isModelAlias('fable')).toBe(true)
    expect(isModelAlias('fable[1m]')).toBe(true)
    expect(isModelFamilyAlias('fable')).toBe(true)
  })

  test('resolves the alias without changing unrelated model defaults', () => {
    expect(getDefaultFableModel()).toBe(getModelStrings().fable5)
    expect(parseUserSpecifiedModel('fable')).toBe(getModelStrings().fable5)

    process.env.ANTHROPIC_DEFAULT_FABLE_MODEL = 'provider-owned-fable'

    expect(getDefaultFableModel()).toBe('provider-owned-fable')
    expect(parseUserSpecifiedModel('fable')).toBe('provider-owned-fable')
    expect(parseUserSpecifiedModel('fable[1m]')).toBe(
      'provider-owned-fable[1m]',
    )
  })

  test('normalizes and renders the public model name', () => {
    expect(
      firstPartyNameToCanonical('us.anthropic.claude-fable-5-v1:0'),
    ).toBe('claude-fable-5')
    expect(getPublicModelDisplayName(getModelStrings().fable5)).toBe('Fable 5')
    expect(getMarketingNameForModel('claude-fable-5[1m]')).toBe(
      'Fable 5 (with 1M context)',
    )
  })

  test('exposes the native 1M context window', () => {
    expect(modelSupports1M('claude-fable-5')).toBe(true)
    expect(getContextWindowForModel('claude-fable-5')).toBe(1_000_000)
    expect(getContextWindowForModel('anthropic/claude-fable-5')).toBe(1_000_000)
  })
})

describe('Fable agent resolution', () => {
  test('offers and resolves fable for agents', () => {
    process.env.ANTHROPIC_DEFAULT_FABLE_MODEL = 'provider-owned-fable'

    expect(getAgentModelOptions()).toContainEqual({
      value: 'fable',
      label: 'Fable',
      description: 'Most capable for complex agent tasks',
    })
    expect(
      getAgentModel('fable', 'claude-sonnet-4-6', undefined, 'default'),
    ).toBe('provider-owned-fable')
    expect(
      getAgentModel(
        'inherit',
        'claude-fable-5-custom-deployment',
        'fable',
        'default',
      ),
    ).toBe('claude-fable-5-custom-deployment')
  })

  test('reads capability overrides from the fable environment tier', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://provider.example.test'
    process.env.ANTHROPIC_DEFAULT_FABLE_MODEL = 'provider-owned-fable'
    process.env.ANTHROPIC_DEFAULT_FABLE_MODEL_SUPPORTED_CAPABILITIES =
      'effort, xhigh_effort'
    clearCapabilityCache()

    expect(
      get3PModelCapabilityOverride('provider-owned-fable', 'effort'),
    ).toBe(true)
    expect(
      get3PModelCapabilityOverride('provider-owned-fable', 'xhigh_effort'),
    ).toBe(true)
    expect(
      get3PModelCapabilityOverride('provider-owned-fable', 'max_effort'),
    ).toBe(false)
  })
})

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

function clearCapabilityCache(): void {
  ;(get3PModelCapabilityOverride as typeof get3PModelCapabilityOverride & {
    cache?: { clear?: () => void }
  }).cache?.clear?.()
}
