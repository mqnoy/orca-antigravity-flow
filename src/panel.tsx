// Antigravity Flow - Declarative TSX Panel
// Agile Startup Workflows, Sprints, Epics, Workspace Board Integration, Personas & Usage & Token Quota Monitoring.

import {
  atom,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Code,
  EmptyState,
  Heading,
  IconButton,
  Input,
  plugin,
  read,
  Row,
  Select,
  Separator,
  set,
  Stack,
  Tab,
  Table,
  Tabs,
  Text,
  Textarea,
  type PanelContext
} from 'orca'
import type {
  AccountActivityEvent,
  AccountQuotaBucket,
  AccountQuotaGroup,
  AccountQuotaInfo,
  AccountUsageStats,
  AgileEpic,
  AgileSprint,
  AgileTaskStatus,
  AgileWorkItem,
  AntigravityAccount,
  OrcaBotSummary,
  ProjectWorkflow,
  TotalUsageOverview,
  WorkflowExecutionMode,
  WorkflowGoalType,
  WorkflowStep,
  WorkspaceSummary
} from './protocol'

// Navigation Tab Atom: start | board | roadmap | workflows | accounts | usage
const activeTab = atom<'start' | 'board' | 'roadmap' | 'workflows' | 'accounts' | 'usage'>('start')
const showBeginnerTips = atom<boolean>(true)

// Accounts State
const accounts = atom<AntigravityAccount[]>([])
const activeId = atom<string | null>(null)
const workspaces = atom<WorkspaceSummary[]>([])
const selectedWorkspaceId = atom<string | null>('active')
const activeWorkspaceId = atom<string | null>(null)
const focusedContext = atom<{ workspaceId?: string; branch?: string; displayName?: string } | null>(
  null
)
const statusNotice = atom<{ tone: 'success' | 'danger' | 'accent'; message: string } | null>(null)
const showAddForm = atom<boolean>(false)

// Account Form Input Atoms
const formName = atom<string>('')
const formEmail = atom<string>('')
const formDescription = atom<string>('')
const formCustomHome = atom<string>('')
const formCustomGeminiHome = atom<string>('')
const formPersonaPreset = atom<string>('senior-fullstack')
const formPersonaName = atom<string>('Senior Fullstack Developer')
const formPersonaInstructions = atom<string>(
  '# Senior Fullstack Developer Persona\n' +
    '- Write clean, modular, and type-safe code following TDD.\n' +
    '- Consider architecture, performance, and cross-platform implications.\n' +
    '- Verify edge cases and validate changes before committing.'
)
const formSkipPermissions = atom<boolean>(true)
const formCustomFlags = atom<string>('')
const formShareGlobalSkills = atom<boolean>(true)

// Summon Dynamic Options
const summonPrompt = atom<string>('')
const summonSkipPermissions = atom<boolean>(true)
const summonCustomFlags = atom<string>('')
const isBusy = atom<boolean>(false)

// Workflows State
const workflows = atom<ProjectWorkflow[]>([])
const showAddWorkflow = atom<boolean>(false)
const wfName = atom<string>('')
const wfDesc = atom<string>('')
const wfSteps = atom<WorkflowStep[]>([])

// Team Launch Mode, Goal Target & Orca Bots State
const orcaBots = atom<OrcaBotSummary[]>([])
const wfLaunchMode = atom<WorkflowExecutionMode>('auto-agents')
const wfGoalType = atom<WorkflowGoalType>('none')
const wfGoalId = atom<string>('')
const wfCustomGoal = atom<string>('')

// New Step Form Atoms
const newStepName = atom<string>('')
const newStepAccountId = atom<string>('')
const newStepBotName = atom<string>('')
const newStepPrompt = atom<string>('')
const newStepFlags = atom<string>('')
const newStepStatusLane = atom<AgileTaskStatus>('in-progress')

// Agile Board & Sprints State
const sprints = atom<AgileSprint[]>([])
const epics = atom<AgileEpic[]>([])
const workItems = atom<AgileWorkItem[]>([])
const selectedSprintId = atom<string>('sprint-1')
const selectedLaneFilter = atom<string>('all')
const showAddWorkItem = atom<boolean>(false)

// New Work Item Form Atoms
const newItemTitle = atom<string>('')
const newItemDesc = atom<string>('')
const newItemEpicId = atom<string>('epic-101')
const newItemSprintId = atom<string>('sprint-1')
const newItemStatus = atom<AgileTaskStatus>('todo')
const newItemAccountId = atom<string>('')
const newItemPoints = atom<string>('3')

// Sprint Management Atoms
const showAddSprint = atom<boolean>(false)
const newSprintName = atom<string>('')
const newSprintGoal = atom<string>('')
const newSprintStatus = atom<'active' | 'planning' | 'completed'>('planning')
const newSprintStart = atom<string>('')
const newSprintEnd = atom<string>('')
const newSprintPoints = atom<string>('20')

// Complete Sprint Dialog State
const showCompleteSprint = atom<boolean>(false)
const rolloverSprintId = atom<string>('')

// Delete Sprint Dialog State
const deletingSprintId = atom<string | null>(null)
const deleteSprintTargetId = atom<string>('')

// Epic Management Atoms
const showAddEpic = atom<boolean>(false)
const newEpicName = atom<string>('')
const newEpicDesc = atom<string>('')
const newEpicColor = atom<string>('accent')
const newEpicStatus = atom<'planned' | 'in-progress' | 'completed'>('in-progress')

// Feature Usage & Real-time Quota Monitoring State
const usageStats = atom<Record<string, AccountUsageStats>>({})
const usageOverview = atom<TotalUsageOverview | null>(null)
const recentActivities = atom<AccountActivityEvent[]>([])
const selectedUsageAccountFilter = atom<string>('all')
const accountQuotas = atom<Record<string, AccountQuotaInfo>>({})
const isQuotaFetching = atom<boolean>(false)

// Persona Presets Library
const PERSONA_PRESETS: Record<string, { name: string; instructions: string }> = {
  'pm-lead': {
    name: 'Product Manager & Scrum Lead',
    instructions:
      '# Product Manager & Scrum Lead Persona\n' +
      '- Break down requirements into user stories and acceptance criteria.\n' +
      '- Define sprint goals, prioritize backlog items, and track delivery velocity.\n' +
      '- Ensure high business impact and user satisfaction.'
  },
  architect: {
    name: 'Software Architect & Planner',
    instructions:
      '# Software Architect Persona\n' +
      '- Analyze requirements thoroughly and inspect existing codebase before writing code.\n' +
      '- Design scalable interfaces, API contracts, and implementation plans.\n' +
      '- Identify edge cases and structural bottlenecks early.'
  },
  'senior-fullstack': {
    name: 'Senior Fullstack Developer',
    instructions:
      '# Senior Fullstack Developer Persona\n' +
      '- Write clean, modular, and type-safe code following TDD.\n' +
      '- Focus on end-to-end architecture, performance, and pragmatic technical decisions.\n' +
      '- Ensure backward compatibility and cross-platform safety.'
  },
  reviewer: {
    name: 'Code Reviewer & QA Engineer',
    instructions:
      '# Code Reviewer & QA Engineer Persona\n' +
      '- Audit code for potential bugs, regressions, security risks, and over-engineering.\n' +
      '- Verify compliance with acceptance criteria and ensure tests pass.\n' +
      '- Provide actionable, constructive feedback.'
  },
  security: {
    name: 'Security Auditor',
    instructions:
      '# Security Auditor Persona\n' +
      '- Audit dependencies, permission handling, file boundaries, and input validation.\n' +
      '- Detect command injection, privilege escalations, and unsanitized IPC messages.\n' +
      '- Propose defensive hardening measures.'
  },
  custom: {
    name: 'Custom Agent Persona',
    instructions: '# Custom Persona\n- Define custom role instructions and behavior here.'
  }
}

/** Formats a relative or absolute timestamp nicely */
function formatTimestamp(ts: number | null | undefined): string {
  if (!ts) return 'Never'
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** Formats reset ISO timestamp into human readable relative duration or clock time */
function formatResetTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const target = new Date(isoString).getTime()
    const diff = target - Date.now()
    if (diff <= 0) return 'resets now'
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `resets in ${days}d ${hours % 24}h`
    }
    if (hours > 0) {
      return `resets in ${hours}h ${mins}m`
    }
    return `resets in ${mins}m`
  } catch {
    return isoString
  }
}

/** Updates persona form fields based on preset selection */
function handlePersonaPresetChange(presetKey: string): void {
  set(formPersonaPreset, presetKey)
  const preset = PERSONA_PRESETS[presetKey]
  if (preset) {
    set(formPersonaName, preset.name)
    set(formPersonaInstructions, preset.instructions)
  }
}

/** Reset account form */
function clearForm(): void {
  set(formName, '')
  set(formEmail, '')
  set(formDescription, '')
  set(formCustomHome, '')
  set(formCustomGeminiHome, '')
  set(formPersonaPreset, 'senior-fullstack')
  set(formPersonaName, 'Senior Fullstack Developer')
  set(formPersonaInstructions, PERSONA_PRESETS['senior-fullstack']?.instructions ?? '')
  set(formSkipPermissions, true)
  set(formCustomFlags, '')
  set(formShareGlobalSkills, true)
  set(showAddForm, false)
}

/** Reset workflow form */
function clearWorkflowForm(): void {
  set(wfName, '')
  set(wfDesc, '')
  set(wfSteps, [])
  set(newStepName, '')
  set(newStepPrompt, '')
  set(newStepFlags, '')
  set(newStepStatusLane, 'in-progress')
  set(showAddWorkflow, false)
}

/** Reset work item form */
function clearWorkItemForm(): void {
  set(newItemTitle, '')
  set(newItemDesc, '')
  set(newItemPoints, '3')
  set(showAddWorkItem, false)
}

/** Reset sprint form */
function clearSprintForm(): void {
  set(newSprintName, '')
  set(newSprintGoal, '')
  set(newSprintStatus, 'planning')
  set(newSprintStart, '')
  set(newSprintEnd, '')
  set(newSprintPoints, '20')
  set(showAddSprint, false)
}

/** Reset epic form */
function clearEpicForm(): void {
  set(newEpicName, '')
  set(newEpicDesc, '')
  set(newEpicColor, 'accent')
  set(newEpicStatus, 'in-progress')
  set(showAddEpic, false)
}

/** Refresh real-time token quota limits for accounts */
async function refreshQuotas(force = false): Promise<void> {
  try {
    set(isQuotaFetching, true)
    const res = await plugin.request('quota.getAccountQuota', { forceRefresh: force })
    set(accountQuotas, res.quotas)
    if (force) {
      set(statusNotice, {
        tone: 'success',
        message: 'Account token quotas successfully synchronized.'
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[antigravity-flow] Failed to refresh quotas:', err)
    if (force) {
      set(statusNotice, {
        tone: 'danger',
        message: `Failed to refresh quotas: ${msg}`
      })
    }
  } finally {
    set(isQuotaFetching, false)
  }
}

/** Launch interactive terminal to authenticate Google account */
async function loginAccount(accountId: string): Promise<void> {
  try {
    set(isBusy, true)
    set(statusNotice, null)
    const wsId = read(selectedWorkspaceId)
    const payload: { accountId: string; workspaceId?: string } = { accountId }
    if (wsId && wsId !== 'active') payload.workspaceId = wsId
    const res = await plugin.request('accounts.login', payload)
    set(statusNotice, {
      tone: 'accent',
      message: `Terminal opened for "${res.accountName}". Complete the Google sign-in prompt to authenticate.`
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to open login terminal: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Refresh all state from worker including usage statistics and token quotas */
async function refreshAll(showFeedback = false): Promise<void> {
  try {
    set(isBusy, true)
    set(statusNotice, null)

    const [accRes, wsRes, boardRes, usageRes, botsRes] = await Promise.all([
      plugin.request('accounts.list'),
      plugin.request('accounts.getWorkspaces'),
      plugin.request('board.getAgileState'),
      plugin.request('usage.getStats'),
      plugin.request('bots.list').catch(() => ({ bots: [], botsDir: '' }))
    ])

    set(accounts, accRes.accounts)
    set(activeId, accRes.activeId)
    set(workspaces, wsRes.workspaces)
    set(orcaBots, botsRes.bots || [])
    if (wsRes.activeWorkspaceId) {
      set(activeWorkspaceId, wsRes.activeWorkspaceId)
    }
    if (wsRes.focusedContext) {
      set(focusedContext, wsRes.focusedContext)
    }
    if (!read(selectedWorkspaceId)) {
      set(selectedWorkspaceId, 'active')
    }

    set(sprints, boardRes.sprints)
    set(epics, boardRes.epics)
    set(workItems, boardRes.workItems)

    set(usageStats, usageRes.stats)
    set(usageOverview, usageRes.overview)
    set(recentActivities, usageRes.recentActivities)

    // Refresh token quotas in the background so slow agy execution does not block UI refresh
    void refreshQuotas(showFeedback)

    // Ensure selected sprint exists in loaded sprints
    const curSprintId = read(selectedSprintId)
    if (!boardRes.sprints.some((s) => s.id === curSprintId) && boardRes.sprints.length > 0) {
      const active = boardRes.sprints.find((s) => s.status === 'active') || boardRes.sprints[0]
      if (active) set(selectedSprintId, active.id)
    }

    const wsId = read(selectedWorkspaceId)
    const wfPayload: { workspaceId?: string } = {}
    if (wsId && wsId !== 'active') wfPayload.workspaceId = wsId
    const wfRes = await plugin.request('workflows.list', wfPayload)
    set(workflows, wfRes.workflows)

    if (showFeedback) {
      set(statusNotice, {
        tone: 'success',
        message: 'Antigravity Flow synced with Orca board, accounts, usage & token quotas.'
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to refresh: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Open Orca native Workspace Kanban Board */
async function openNativeWorkspaceBoard(): Promise<void> {
  try {
    await plugin.request('board.openNative')
    set(statusNotice, {
      tone: 'accent',
      message: 'Toggled Orca Workspace Kanban Board.'
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Could not open Workspace Board: ${msg}` })
  }
}

/** Sync live agent terminal states onto Agile Board lanes */
async function syncBoardFromAgents(): Promise<void> {
  try {
    set(isBusy, true)
    const wsId = read(selectedWorkspaceId)
    const payload: { workspaceId?: string } = {}
    if (wsId && wsId !== 'active') payload.workspaceId = wsId
    const res = await plugin.request('board.syncFromAgents', payload)
    if (res.workItems) {
      set(workItems, res.workItems)
    }
    set(statusNotice, {
      tone: res.syncedCount > 0 ? 'success' : 'accent',
      message:
        res.syncedCount > 0
          ? `Synced ${res.syncedCount} task(s) from live agent terminals: ${res.changes.map((c) => `${c.title} -> ${c.to}`).join(', ')}`
          : 'All linked agent tasks are already in sync with live terminals.'
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Agent board sync failed: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Switch active account */
async function selectAccount(id: string): Promise<void> {
  try {
    set(isBusy, true)
    set(statusNotice, null)
    await plugin.request('accounts.setActive', { id })
    set(activeId, id)
    set(statusNotice, { tone: 'success', message: 'Active account updated.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to select account: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Remove an account */
async function removeAccount(id: string): Promise<void> {
  try {
    set(isBusy, true)
    set(statusNotice, null)
    const res = await plugin.request('accounts.remove', { id })
    set(accounts, res.accounts)
    set(activeId, res.activeId)
    set(statusNotice, { tone: 'accent', message: 'Account removed.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to remove account: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Save an account with persona, global skills, and dynamic flags */
async function saveAccount(): Promise<void> {
  const name = read(formName).trim()
  if (!name) {
    set(statusNotice, { tone: 'danger', message: 'Account name is required.' })
    return
  }

  try {
    set(isBusy, true)
    set(statusNotice, null)

    const flags: string[] = []
    if (read(formSkipPermissions)) {
      flags.push('--dangerously-skip-permissions')
    }

    const payload: {
      name: string
      email?: string
      description?: string
      customHome?: string
      customGeminiHome?: string
      flags?: string[]
      customFlags?: string
      personaName?: string
      personaInstructions?: string
      shareGlobalSkills?: boolean
    } = { name }

    const email = read(formEmail).trim()
    if (email) payload.email = email

    const desc = read(formDescription).trim()
    if (desc) payload.description = desc

    const customHome = read(formCustomHome).trim()
    if (customHome) payload.customHome = customHome

    const customGeminiHome = read(formCustomGeminiHome).trim()
    if (customGeminiHome) payload.customGeminiHome = customGeminiHome

    if (flags.length > 0) payload.flags = flags

    const customFlags = read(formCustomFlags).trim()
    if (customFlags) payload.customFlags = customFlags

    const personaName = read(formPersonaName).trim()
    if (personaName) payload.personaName = personaName

    const personaInstructions = read(formPersonaInstructions).trim()
    if (personaInstructions) payload.personaInstructions = personaInstructions

    payload.shareGlobalSkills = read(formShareGlobalSkills)

    const cleanPayload = JSON.parse(JSON.stringify(payload))
    const res = await plugin.request('accounts.add', cleanPayload)

    set(accounts, res.accounts)
    set(activeId, res.activeId)
    set(statusNotice, {
      tone: 'success',
      message: `Account "${res.account.name}" saved with isolated persona and options.`
    })
    clearForm()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to save account: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Summon agy with dynamic flags and markdown prompt */
async function summonAgy(accountId?: string): Promise<void> {
  try {
    set(isBusy, true)
    set(statusNotice, null)
    const flags: string[] = []
    if (read(summonSkipPermissions)) {
      flags.push('--dangerously-skip-permissions')
    }

    const payload: {
      accountId?: string
      workspaceId?: string
      prompt?: string
      flags?: string[]
      customFlags?: string
    } = {}

    if (accountId) payload.accountId = accountId
    const wsId = read(selectedWorkspaceId)
    if (wsId && wsId !== 'active') payload.workspaceId = wsId
    const prompt = read(summonPrompt).trim()
    if (prompt) payload.prompt = prompt
    if (flags.length > 0) payload.flags = flags

    const customFlags = read(summonCustomFlags).trim()
    if (customFlags) payload.customFlags = customFlags

    const res = await plugin.request('accounts.summon', payload)
    set(statusNotice, {
      tone: 'success',
      message: `Summoned ${res.accountName} in workspace terminal!`
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Summon failed: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Save Agile Sprint */
async function saveSprint(): Promise<void> {
  const name = read(newSprintName).trim()
  if (!name) {
    set(statusNotice, { tone: 'danger', message: 'Sprint name is required.' })
    return
  }

  try {
    set(isBusy, true)
    const goal = read(newSprintGoal).trim()
    const startDate = read(newSprintStart).trim()
    const endDate = read(newSprintEnd).trim()
    const sprint: AgileSprint = {
      id: `sprint-${Date.now()}`,
      name,
      status: read(newSprintStatus),
      targetPoints: parseInt(read(newSprintPoints), 10) || 20,
      ...(goal ? { goal } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {})
    }

    const res = await plugin.request('board.saveSprint', { sprint })
    set(sprints, res.sprints)
    set(selectedSprintId, res.sprint.id)
    set(statusNotice, { tone: 'success', message: `Sprint "${res.sprint.name}" created.` })
    clearSprintForm()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to save sprint: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Complete an active sprint with rollover */
async function completeActiveSprint(sprintId: string): Promise<void> {
  try {
    set(isBusy, true)
    const rolloverId = read(rolloverSprintId).trim()
    const payload: { sprintId: string; rolloverToSprintId?: string } = { sprintId }
    if (rolloverId && rolloverId !== sprintId) {
      payload.rolloverToSprintId = rolloverId
    }

    const res = await plugin.request('board.completeSprint', payload)
    set(sprints, res.sprints)
    set(workItems, res.workItems)
    set(showCompleteSprint, false)

    const nextSprint =
      res.sprints.find((s) => s.status === 'active') ||
      res.sprints.find((s) => s.status === 'planning')
    if (nextSprint) {
      set(selectedSprintId, nextSprint.id)
    }

    set(statusNotice, {
      tone: 'success',
      message: 'Sprint completed! Incomplete tasks were rolled over to the target sprint.'
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to complete sprint: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Pick the best fallback sprint id from a sprint list */
function resolveFallbackSprintId(sprintList: AgileSprint[]): string {
  return (
    sprintList.find((s) => s.status === 'active')?.id ||
    sprintList.find((s) => s.status === 'planning')?.id ||
    sprintList[0]?.id ||
    ''
  )
}

/** Open inline delete sprint confirmation and default task handling target */
function openDeleteSprintConfirm(sprintId: string): void {
  set(deletingSprintId, sprintId)
  set(showCompleteSprint, false)
  const remaining = read(sprints).filter((s) => s.id !== sprintId)
  const sprintTasks = read(workItems).filter((i) => i.sprintId === sprintId)
  if (sprintTasks.length > 0 && remaining.length > 0) {
    const defaultTarget =
      remaining.find((s) => s.status === 'active') ||
      remaining.find((s) => s.status === 'planning') ||
      remaining[0]
    set(deleteSprintTargetId, defaultTarget.id)
  } else {
    set(deleteSprintTargetId, '__delete__')
  }
}

/** Cancel inline delete sprint confirmation */
function cancelDeleteSprint(): void {
  set(deletingSprintId, null)
  set(deleteSprintTargetId, '')
}

/** Confirm deleting a sprint and optionally moving its work items */
async function confirmDeleteSprint(sprintId: string): Promise<void> {
  const sprintName = read(sprints).find((s) => s.id === sprintId)?.name || sprintId
  const target = read(deleteSprintTargetId).trim()
  const payload: { sprintId: string; moveToSprintId?: string } = { sprintId }
  if (target && target !== '__delete__' && target !== sprintId) {
    payload.moveToSprintId = target
  }

  try {
    set(isBusy, true)
    const res = await plugin.request('board.deleteSprint', payload)
    set(sprints, res.sprints)
    set(workItems, res.workItems)
    set(epics, res.epics)
    set(deletingSprintId, null)
    set(deleteSprintTargetId, '')
    set(showCompleteSprint, false)

    const fallbackId = resolveFallbackSprintId(res.sprints)
    const curSelected = read(selectedSprintId)
    if (curSelected === sprintId || !res.sprints.some((s) => s.id === curSelected)) {
      set(selectedSprintId, fallbackId)
    }
    const curNewItemSprint = read(newItemSprintId)
    if (curNewItemSprint === sprintId || !res.sprints.some((s) => s.id === curNewItemSprint)) {
      set(newItemSprintId, fallbackId)
    }

    if (payload.moveToSprintId) {
      const targetName =
        res.sprints.find((s) => s.id === payload.moveToSprintId)?.name || payload.moveToSprintId
      set(statusNotice, {
        tone: 'success',
        message: `Sprint "${sprintName}" deleted and its work items were moved to "${targetName}".`
      })
    } else {
      set(statusNotice, {
        tone: 'success',
        message: `Sprint "${sprintName}" and its work items were deleted.`
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to delete sprint: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Render shared inline delete sprint confirmation controls */
function renderDeleteSprintConfirmBody(
  sprint: AgileSprint,
  taskCount: number,
  sprintList: AgileSprint[],
  busy: boolean
) {
  const otherSprints = sprintList.filter((s) => s.id !== sprint.id)
  const targetOptions = [
    ...otherSprints.map((s) => ({
      label: `Move ${taskCount} task(s) to ${s.name}`,
      value: s.id
    })),
    {
      label: `Delete all ${taskCount} task(s) with this sprint`,
      value: '__delete__'
    }
  ]

  return (
    <Stack gap="sm">
      <Text size="xs">
        {taskCount === 0
          ? 'This sprint has 0 work items and can be safely removed.'
          : `${taskCount} work item(s) are currently assigned to this sprint.`}
      </Text>
      {taskCount > 0 ? (
        otherSprints.length > 0 ? (
          <Select
            label="Work items in this sprint:"
            options={targetOptions}
            value={read(deleteSprintTargetId) || otherSprints[0]?.id || '__delete__'}
            onChange={(val) => set(deleteSprintTargetId, val ?? '__delete__')}
            disabled={busy}
          />
        ) : (
          <Text size="xs" muted>
            No other sprint exists. All {taskCount} work item(s) in this sprint will be permanently
            deleted with it.
          </Text>
        )
      ) : null}
      <Row justify="end" gap="xs">
        <Button variant="ghost" size="sm" disabled={busy} onPress={cancelDeleteSprint}>
          Cancel
        </Button>
        <Button
          variant="solid"
          tone="danger"
          size="sm"
          disabled={busy}
          onPress={() => void confirmDeleteSprint(sprint.id)}
        >
          Confirm Delete
        </Button>
      </Row>
    </Stack>
  )
}

/** Save Agile Epic */
async function saveEpic(): Promise<void> {
  const name = read(newEpicName).trim()
  if (!name) {
    set(statusNotice, { tone: 'danger', message: 'Epic name is required.' })
    return
  }

  try {
    set(isBusy, true)
    const description = read(newEpicDesc).trim()
    const epic: AgileEpic = {
      id: `epic-${Date.now()}`,
      name,
      color: read(newEpicColor) || 'accent',
      status: read(newEpicStatus),
      ...(description ? { description } : {})
    }

    const res = await plugin.request('board.saveEpic', { epic })
    set(epics, res.epics)
    set(statusNotice, { tone: 'success', message: `Roadmap Epic "${res.epic.name}" created.` })
    clearEpicForm()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to save epic: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Delete Agile Epic */
async function deleteEpic(epicId: string): Promise<void> {
  try {
    set(isBusy, true)
    const res = await plugin.request('board.deleteEpic', { epicId })
    set(epics, res.epics)
    set(statusNotice, { tone: 'accent', message: 'Epic removed from roadmap.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to delete epic: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Save Agile Work Item */
async function saveAgileWorkItem(): Promise<void> {
  const title = read(newItemTitle).trim()
  if (!title) {
    set(statusNotice, { tone: 'danger', message: 'Work item title is required.' })
    return
  }

  try {
    set(isBusy, true)
    const description = read(newItemDesc).trim()
    const assignedAccountId = read(newItemAccountId)
    const item: AgileWorkItem = {
      id: `task-${Date.now()}`,
      title,
      epicId: read(newItemEpicId),
      sprintId: read(newItemSprintId),
      status: read(newItemStatus),
      storyPoints: parseInt(read(newItemPoints), 10) || 3,
      updatedAt: Date.now(),
      ...(description ? { description } : {}),
      ...(assignedAccountId ? { assignedAccountId } : {})
    }

    const res = await plugin.request('board.saveWorkItem', { item })
    set(workItems, res.workItems)
    set(statusNotice, {
      tone: 'success',
      message: `Work item "${res.item.title}" added to Sprint!`
    })
    clearWorkItemForm()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to save work item: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Update Work Item status */
async function updateWorkItemStatus(itemId: string, status: AgileTaskStatus): Promise<void> {
  try {
    const res = await plugin.request('board.updateItemStatus', { itemId, status })
    set(workItems, res.workItems)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to update status: ${msg}` })
  }
}

/** Delete Work Item */
async function deleteAgileWorkItem(itemId: string): Promise<void> {
  try {
    const res = await plugin.request('board.deleteWorkItem', { itemId })
    set(workItems, res.workItems)
    set(statusNotice, { tone: 'accent', message: 'Work item removed.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to delete work item: ${msg}` })
  }
}

/** Summon agent for an Agile Work Item */
async function summonAgentForWorkItem(itemId: string): Promise<void> {
  const wsId = read(selectedWorkspaceId)
  try {
    set(isBusy, true)
    const payload: { itemId: string; workspaceId?: string } = { itemId }
    if (wsId && wsId !== 'active') payload.workspaceId = wsId
    const res = await plugin.request('board.summonWorkItem', payload)
    set(statusNotice, {
      tone: 'success',
      message: `Started agent (${res.accountName}) for "${res.itemTitle}"!`
    })
    const state = await plugin.request('board.getAgileState')
    set(workItems, state.workItems)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to launch agent for work item: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Clear activity and usage metrics */
async function clearUsageData(accountId?: string): Promise<void> {
  try {
    set(isBusy, true)
    const payload = accountId ? { accountId } : undefined
    const res = await plugin.request('usage.clearHistory', payload)
    set(usageStats, res.stats)
    set(usageOverview, res.overview)
    set(recentActivities, res.recentActivities)
    set(statusNotice, {
      tone: 'accent',
      message: accountId
        ? `Cleared usage history for account.`
        : 'Cleared all usage activity history.'
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to clear usage history: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Add step to draft workflow */
function addWorkflowStep(): void {
  const name = read(newStepName).trim()
  const accountId = read(newStepAccountId) || read(accounts)[0]?.id || ''
  const botName = read(newStepBotName).trim()
  const prompt = read(newStepPrompt).trim()
  const flags = read(newStepFlags).trim()
  const lane = read(newStepStatusLane)

  if (!name) {
    set(statusNotice, { tone: 'danger', message: 'Step name is required.' })
    return
  }
  if (!accountId) {
    set(statusNotice, { tone: 'danger', message: 'Select an account for this step.' })
    return
  }

  const step: WorkflowStep = {
    id: `step-${Date.now()}`,
    name,
    accountId,
    prompt,
    statusLane: lane,
    ...(botName ? { botName } : {}),
    ...(flags ? { customFlags: flags } : {})
  }

  const existing = read(wfSteps)
  set(wfSteps, [...existing, step])
  set(newStepName, '')
  set(newStepBotName, '')
  set(newStepPrompt, '')
  set(newStepFlags, '')
}

/** Save workflow */
async function saveWorkflow(): Promise<void> {
  const name = read(wfName).trim()
  if (!name) {
    set(statusNotice, { tone: 'danger', message: 'Workflow name is required.' })
    return
  }
  const steps = read(wfSteps)
  if (steps.length === 0) {
    set(statusNotice, { tone: 'danger', message: 'Please add at least one agent step.' })
    return
  }

  try {
    set(isBusy, true)
    set(statusNotice, null)
    const wsId = read(selectedWorkspaceId)
    const description = read(wfDesc).trim()
    const workflow: ProjectWorkflow = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      steps: JSON.parse(JSON.stringify(steps)) as WorkflowStep[],
      ...(description ? { description } : {}),
      ...(wsId && wsId !== 'active' ? { workspaceId: wsId } : {})
    }

    const res = await plugin.request('workflows.save', { workflow })
    set(workflows, res.workflows)
    set(statusNotice, { tone: 'success', message: `Workflow "${res.workflow.name}" saved!` })
    clearWorkflowForm()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to save workflow: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Refresh local Orca Bots list */
async function refreshOrcaBots(): Promise<void> {
  try {
    const res = await plugin.request('bots.list')
    set(orcaBots, res.bots || [])
    set(statusNotice, {
      tone: 'accent',
      message: `Discovered ${res.bots.length} local Orca Bot(s) in ${res.botsDir}.`
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Failed to scan Orca Bots: ${msg}` })
  }
}

/** One-click beginner launch helper: selects mode + optional active sprint and runs a workflow */
async function quickLaunchPreset(
  preferredWorkflowId: string,
  useActiveSprint: boolean
): Promise<void> {
  const wfList = read(workflows)
  const targetWf = wfList.find((w) => w.id === preferredWorkflowId) || wfList[0]
  if (!targetWf) {
    set(statusNotice, {
      tone: 'danger',
      message: 'No workflows available yet. Create one in the Startup Workflows tab.'
    })
    set(activeTab, 'workflows')
    return
  }

  const sprintList = read(sprints)
  const activeSp =
    sprintList.find((s) => s.id === read(selectedSprintId)) ||
    sprintList.find((s) => s.status === 'active') ||
    sprintList[0]

  if (useActiveSprint && activeSp) {
    set(wfGoalType, 'sprint')
    set(wfGoalId, activeSp.id)
  } else {
    set(wfGoalType, 'none')
    set(wfGoalId, '')
  }

  await executeWorkflow(targetWf.id)
}

/** Execute team workflow */
async function executeWorkflow(wfId: string): Promise<void> {
  const wsId = read(selectedWorkspaceId)
  const mode = read(wfLaunchMode)
  const goalType = read(wfGoalType)
  const goalId = read(wfGoalId)
  const customGoal = read(wfCustomGoal).trim()
  try {
    set(isBusy, true)
    set(statusNotice, null)
    const payload: {
      workflowId: string
      workspaceId?: string
      mode: WorkflowExecutionMode
      goalType?: WorkflowGoalType
      goalId?: string
      customGoal?: string
    } = {
      workflowId: wfId,
      mode,
      ...(goalType !== 'none' ? { goalType } : {}),
      ...(goalType !== 'none' && goalId ? { goalId } : {}),
      ...(customGoal ? { customGoal } : {})
    }
    if (wsId && wsId !== 'active') payload.workspaceId = wsId
    const res = await plugin.request('workflows.execute', payload)
    set(statusNotice, { tone: 'success', message: res.message })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    set(statusNotice, { tone: 'danger', message: `Workflow execution failed: ${msg}` })
  } finally {
    set(isBusy, false)
  }
}

/** Setup subscriptions before initial mount */
export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(
    plugin.on('accounts.changed', ({ accounts: list, activeId: current }) => {
      set(accounts, list)
      set(activeId, current)
    }),
    plugin.on('accounts.summoned', ({ accountName }) => {
      set(statusNotice, {
        tone: 'success',
        message: `Summoned agy (${accountName}) in new terminal.`
      })
    }),
    plugin.on('workflows.changed', ({ workflows: list }) => {
      set(workflows, list)
    }),
    plugin.on('board.changed', ({ sprints: sList, epics: eList, workItems: wList }) => {
      set(sprints, sList)
      set(epics, eList)
      set(workItems, wList)

      const fallbackSprintId = resolveFallbackSprintId(sList)
      if (!sList.some((s) => s.id === read(selectedSprintId))) {
        set(selectedSprintId, fallbackSprintId)
      }
      if (!sList.some((s) => s.id === read(newItemSprintId))) {
        set(newItemSprintId, fallbackSprintId)
      }
      const curDeleting = read(deletingSprintId)
      if (curDeleting && !sList.some((s) => s.id === curDeleting)) {
        set(deletingSprintId, null)
        set(deleteSprintTargetId, '')
      }
    }),
    plugin.on(
      'usage.changed',
      ({ stats: uStats, overview: uOverview, recentActivities: uActivities }) => {
        set(usageStats, uStats)
        set(usageOverview, uOverview)
        set(recentActivities, uActivities)
      }
    ),
    plugin.on('quota.changed', ({ quotas }) => {
      set(accountQuotas, quotas)
    }),
    plugin.on('workspace.changed', ({ context, activeWorkspaceId: wsId, workspaces: wsList }) => {
      if (wsList && Array.isArray(wsList)) {
        set(workspaces, wsList)
      }
      if (wsId) {
        set(activeWorkspaceId, wsId)
      }
      if (context) {
        set(focusedContext, context)
      }
      const curSelected = read(selectedWorkspaceId)
      if (!curSelected || curSelected === 'active') {
        void plugin
          .request('workflows.list', {})
          .then((wfRes) => {
            if (wfRes?.workflows) set(workflows, wfRes.workflows)
          })
          .catch(() => {})
      }
    })
  )

  void refreshAll(false)
}

export default function Panel() {
  const currentTab = read(activeTab)
  const accountList = read(accounts)
  const currentActiveId = read(activeId)
  const activeAccount = accountList.find((a) => a.id === currentActiveId) || accountList[0]
  const notice = read(statusNotice)
  const adding = read(showAddForm)
  const addingWf = read(showAddWorkflow)
  const addingItem = read(showAddWorkItem)
  const addingSprint = read(showAddSprint)
  const addingEpic = read(showAddEpic)
  const completingSprint = read(showCompleteSprint)
  const curDeletingSprintId = read(deletingSprintId)
  const wsList = read(workspaces)
  const wfList = read(workflows)
  const botList = read(orcaBots)
  const launchMode = read(wfLaunchMode)
  const goalType = read(wfGoalType)
  const goalId = read(wfGoalId)
  const sprintList = read(sprints)
  const epicList = read(epics)
  const itemList = read(workItems)
  const statsMap = read(usageStats)
  const overview = read(usageOverview)
  const activities = read(recentActivities)
  const usageFilter = read(selectedUsageAccountFilter)
  const quotasMap = read(accountQuotas)
  const quotaLoading = read(isQuotaFetching)
  const busy = read(isBusy)
  const curSprintId = read(selectedSprintId)
  const laneFilter = read(selectedLaneFilter)

  const activeSprint =
    sprintList.find((s) => s.id === curSprintId) ||
    sprintList.find((s) => s.status === 'active') ||
    sprintList[0]

  const currentActiveWsId = read(activeWorkspaceId)
  const currentContext = read(focusedContext)
  const activeWsObj = wsList.find((w) => w.id === currentActiveWsId)
  const activeWsName = activeWsObj?.name || currentContext?.displayName || 'Focused Workspace'
  const activeWsBranch = activeWsObj?.branch || currentContext?.branch

  const wsOptions = [
    {
      label: `⚡ Auto: Active Workspace (${activeWsName}${activeWsBranch ? ` [${activeWsBranch}]` : ''})`,
      value: 'active'
    },
    ...wsList.map((ws) => ({
      label: `${ws.name}${ws.branch ? ` (${ws.branch})` : ''}${ws.id === currentActiveWsId ? ' (Active)' : ''}`,
      value: ws.id
    }))
  ]

  const accountOptions = accountList.map((a) => ({
    label: `${a.name}${a.personaName ? ` [${a.personaName}]` : ''}`,
    value: a.id
  }))

  const botOptions = [
    { label: 'Auto-match by persona / None', value: '' },
    ...botList.map((b) => ({
      label: `bot:${b.name} (${b.agent})${b.specialty ? ` — ${b.specialty.slice(0, 48)}` : ''}`,
      value: b.name
    }))
  ]

  const goalTargetOptions =
    goalType === 'sprint'
      ? sprintList.map((s) => ({ label: `${s.name} [${s.status}]`, value: s.id }))
      : goalType === 'epic'
        ? epicList.map((e) => ({ label: `${e.name} [${e.status || 'in-progress'}]`, value: e.id }))
        : goalType === 'workitem'
          ? itemList.map((w) => ({ label: `[${w.status}] ${w.title}`, value: w.id }))
          : []

  const epicOptions = epicList.map((e) => ({
    label: e.name,
    value: e.id
  }))

  const sprintOptions = sprintList.map((s) => ({
    label: `${s.name}${s.status === 'active' ? ' (Active)' : s.status === 'completed' ? ' (Completed)' : ''}`,
    value: s.id
  }))

  const rolloverSprintOptions = sprintList
    .filter((s) => s.id !== activeSprint?.id && s.status !== 'completed')
    .map((s) => ({
      label: s.name,
      value: s.id
    }))

  const personaPresetOptions = [
    { label: 'Product Manager & Scrum Lead', value: 'pm-lead' },
    { label: 'Software Architect & Planner', value: 'architect' },
    { label: 'Senior Fullstack Developer', value: 'senior-fullstack' },
    { label: 'Code Reviewer & QA Engineer', value: 'reviewer' },
    { label: 'Security Auditor', value: 'security' },
    { label: 'Custom Persona', value: 'custom' }
  ]

  // Orca Synchronized Board Lanes
  const ORCA_LANES: {
    id: AgileTaskStatus
    label: string
    icon: string
    tone: 'neutral' | 'accent' | 'success'
  }[] = [
    { id: 'todo', label: 'Todo', icon: 'circle', tone: 'neutral' },
    { id: 'in-progress', label: 'In progress', icon: 'conductor-progress', tone: 'accent' },
    { id: 'in-review', label: 'In review', icon: 'conductor-review', tone: 'accent' },
    { id: 'completed', label: 'Done', icon: 'conductor-done', tone: 'success' }
  ]

  // Filter items by sprint
  const sprintItems = activeSprint
    ? itemList.filter((i) => i.sprintId === activeSprint.id)
    : itemList

  // Lane item counts
  const todoCount = sprintItems.filter((i) => i.status === 'todo').length
  const progressCount = sprintItems.filter((i) => i.status === 'in-progress').length
  const reviewCount = sprintItems.filter((i) => i.status === 'in-review').length
  const doneCount = sprintItems.filter((i) => i.status === 'completed').length

  // Filtered items by selected lane filter
  const visibleItems =
    laneFilter === 'all' ? sprintItems : sprintItems.filter((i) => i.status === laneFilter)

  // Filtered activities by selected account filter
  const visibleActivities =
    usageFilter === 'all' ? activities : activities.filter((a) => a.accountId === usageFilter)

  // Master Token Quota Table Rows (scannable across all accounts)
  const masterQuotaRows = accountList.map((acc) => {
    const quota = quotasMap[acc.id]
    const isCurActive = acc.id === currentActiveId
    const isNeedsLogin = quota?.status === 'needs-login'

    let statusText = 'Uncached'
    if (quotaLoading && !quota) {
      statusText = 'Checking...'
    } else if (isNeedsLogin) {
      statusText = 'Not Logged In'
    } else if (quota?.status === 'ok') {
      statusText = 'Ready'
    } else if (quota?.status === 'error') {
      statusText = 'Error'
    }

    const gem5h = isNeedsLogin
      ? 'Not Logged In'
      : typeof quota?.gemini5hRemaining === 'number'
        ? `${quota.gemini5hRemaining}%`
        : '–'
    const gemWk = isNeedsLogin
      ? 'Not Logged In'
      : typeof quota?.geminiWeeklyRemaining === 'number'
        ? `${quota.geminiWeeklyRemaining}%`
        : '–'
    const thirdParty = isNeedsLogin
      ? '–'
      : typeof quota?.thirdPartyWeeklyRemaining === 'number'
        ? `${quota.thirdPartyWeeklyRemaining}%`
        : '–'

    const updatedText = quota?.updatedAt ? formatTimestamp(quota.updatedAt) : 'Never'

    return {
      key: acc.id,
      cells: {
        account: `${acc.name}${isCurActive ? ' ★' : ''}`,
        persona: acc.personaName || 'Default',
        gemini5h: gem5h,
        geminiWeekly: gemWk,
        thirdParty: thirdParty,
        status: statusText,
        lastChecked: updatedText
      }
    }
  })

  // Detailed Model Bucket Rows (Filtered by selected account or showing all)
  const detailedBucketRows: {
    key: string
    cells: Record<string, string | number | null>
  }[] = []

  const targetQuotaAccounts =
    usageFilter === 'all' ? accountList : accountList.filter((a) => a.id === usageFilter)

  for (const acc of targetQuotaAccounts) {
    const quota = quotasMap[acc.id]
    if (quota && quota.groups && quota.groups.length > 0) {
      for (const grp of quota.groups) {
        for (const b of grp.buckets) {
          const resetText = b.resetTime ? formatResetTime(b.resetTime) : 'Weekly cycle'
          detailedBucketRows.push({
            key: `${acc.id}-${grp.name}-${b.id}`,
            cells: {
              account: acc.name,
              group: grp.name,
              window: b.name || b.window,
              remaining: `${b.remainingPercent}%`,
              used: `${b.usedPercent}%`,
              reset: resetText
            }
          })
        }
      }
    }
  }

  const tipsVisible = read(showBeginnerTips)
  const readyAccountCount = accountList.filter((a) => quotasMap[a.id]?.status === 'ok').length
  const hasWorkspaceReady = wsList.length > 0 || Boolean(currentActiveWsId || currentContext?.workspaceId)
  const firstAccountForLogin =
    accountList.find((a) => quotasMap[a.id]?.status === 'needs-login') || activeAccount || accountList[0]

  return (
    <Stack gap="md">
      {/* Header with Title and Global Actions */}
      <Row justify="between" align="center">
        <Stack gap="none">
          <Heading level={3}>Antigravity Flow</Heading>
          <Text size="xs" muted>
            AI Team Workflows, Agile Sprints & Persona Coordination for Orca
          </Text>
        </Stack>
        <Row gap="xs" align="center">
          <Button
            variant={currentTab === 'start' ? 'solid' : 'outline'}
            size="sm"
            onPress={() => set(activeTab, currentTab === 'start' ? 'workflows' : 'start')}
          >
            {currentTab === 'start' ? 'Workflows' : 'Start Here'}
          </Button>
          <IconButton
            icon="blocks"
            label="Open Orca Workspace Board"
            variant="outline"
            disabled={busy}
            onPress={() => void openNativeWorkspaceBoard()}
          />
          <IconButton
            icon="refresh"
            label="Refresh accounts, workspaces, and agile board"
            variant="ghost"
            disabled={busy || quotaLoading}
            onPress={() => void refreshAll(true)}
          />
        </Row>
      </Row>

      {/* Live Active Workspace Status & Target Bar */}
      <Card>
        <Row justify="between" align="center" gap="xs">
          <Row align="center" gap="xs">
            <Badge tone={read(selectedWorkspaceId) === 'active' ? 'accent' : 'neutral'}>
              {read(selectedWorkspaceId) === 'active'
                ? 'Active Workspace'
                : 'Pinned Workspace'}
            </Badge>
            <Text size="xs" weight="medium">
              {read(selectedWorkspaceId) === 'active'
                ? `${activeWsName}${activeWsBranch ? ` (${activeWsBranch})` : ''}`
                : `${wsList.find((w) => w.id === read(selectedWorkspaceId))?.name || 'Selected'}${wsList.find((w) => w.id === read(selectedWorkspaceId))?.branch ? ` (${wsList.find((w) => w.id === read(selectedWorkspaceId))?.branch})` : ''}`}
            </Text>
          </Row>
          {wsList.length > 0 ? (
            <Select
              label="Target Workspace"
              labelHidden
              options={wsOptions}
              value={read(selectedWorkspaceId) ?? 'active'}
              onChange={(val) => set(selectedWorkspaceId, val ?? 'active')}
              disabled={busy}
            />
          ) : null}
        </Row>
      </Card>

      {/* Global Status Notice */}
      {notice ? (
        <Row justify="between" align="center" gap="xs">
          <Callout tone={notice.tone}>
            <Text size="xs">{notice.message}</Text>
          </Callout>
          <IconButton
            icon="close"
            label="Dismiss notification"
            variant="ghost"
            onPress={() => set(statusNotice, null)}
          />
        </Row>
      ) : null}

      {/* Main Tabs Navigation */}
      <Tabs
        label="Antigravity Flow Sections"
        value={currentTab}
        onChange={(val) =>
          set(
            activeTab,
            val as 'start' | 'board' | 'roadmap' | 'workflows' | 'accounts' | 'usage'
          )
        }
      >
        {/* ========================================================================= */}
        {/* TAB 0: QUICK START (Beginner-Friendly Guided Setup & 1-Click Launch)      */}
        {/* ========================================================================= */}
        <Tab value="start" label="Start Here" icon="bot">
          <Stack gap="md">
            <Card
              title="Welcome to Antigravity Flow"
              description="New to Orca? Follow these 3 quick steps to launch an AI team that collaborates automatically."
            >
              <Stack gap="sm">
                {/* Step 1: Workspace */}
                <Row justify="between" align="center">
                  <Stack gap="none">
                    <Row gap="xs" align="center">
                      <Badge tone={hasWorkspaceReady ? 'success' : 'neutral'}>
                        {hasWorkspaceReady ? '1. Ready' : '1. Needed'}
                      </Badge>
                      <Text size="sm" weight="semibold">
                        Choose an Orca Workspace
                      </Text>
                    </Row>
                    <Text size="xs" muted>
                      {hasWorkspaceReady
                        ? `Targeting "${activeWsName}". Your AI team will edit code and run commands here.`
                        : 'Open any project or Git worktree from Orca’s left sidebar first.'}
                    </Text>
                  </Stack>
                </Row>

                <Separator />

                {/* Step 2: Account Sign-In */}
                <Row justify="between" align="center">
                  <Stack gap="none">
                    <Row gap="xs" align="center">
                      <Badge tone={readyAccountCount > 0 ? 'success' : 'accent'}>
                        {readyAccountCount > 0 ? `2. ${readyAccountCount} Ready` : '2. Sign In'}
                      </Badge>
                      <Text size="sm" weight="semibold">
                        Connect an Antigravity Account
                      </Text>
                    </Row>
                    <Text size="xs" muted>
                      {readyAccountCount > 0
                        ? `${readyAccountCount} of ${accountList.length} persona account(s) signed in and ready.`
                        : 'Sign in once so your AI personas can run Antigravity (agy) in Orca terminals.'}
                    </Text>
                  </Stack>
                  <Row gap="xs">
                    {firstAccountForLogin ? (
                      <Button
                        variant={readyAccountCount > 0 ? 'outline' : 'solid'}
                        tone="accent"
                        size="sm"
                        disabled={busy}
                        onPress={() => void loginAccount(firstAccountForLogin.id)}
                      >
                        {readyAccountCount > 0 ? 'Sign In Another' : 'Sign In Now'}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => set(activeTab, 'accounts')}
                    >
                      Manage
                    </Button>
                  </Row>
                </Row>

                <Separator />

                {/* Step 3: Launch Mode */}
                <Stack gap="xs">
                  <Row gap="xs" align="center">
                    <Badge tone="accent">3. Launch</Badge>
                    <Text size="sm" weight="semibold">
                      Pick How Your AI Team Runs
                    </Text>
                  </Row>
                  <Select
                    label="Team Mode"
                    options={[
                      {
                        label: 'Auto Agent Team (Recommended — 100% automatic, zero setup)',
                        value: 'auto-agents'
                      },
                      {
                        label: `Orca Bots Team (${botList.length} local bot(s) found in Orca)`,
                        value: 'orca-bots'
                      }
                    ]}
                    value={launchMode}
                    onChange={(val) =>
                      set(wfLaunchMode, (val as WorkflowExecutionMode) || 'auto-agents')
                    }
                  />
                  <Text size="xs" muted>
                    {launchMode === 'orca-bots'
                      ? 'Sends your goal to your existing Orca Bots so they message each other directly (bot:<name>).'
                      : 'Spawns specialist AI personas in Orca terminals with a shared team chat room so they talk and hand off work automatically.'}
                  </Text>
                </Stack>
              </Stack>
            </Card>

            {/* 1-Click Starter Missions */}
            <Card
              title="1-Click Starter Missions"
              description="Start immediately — your team personas will automatically coordinate with each other."
            >
              <Stack gap="sm">
                <Row justify="between" align="center">
                  <Stack gap="none">
                    <Text size="sm" weight="semibold">
                      Finish Active Sprint
                    </Text>
                    <Text size="xs" muted>
                      {activeSprint
                        ? `Target: ${activeSprint.name} (${sprintItems.length} work item(s))`
                        : 'Run full PM -> Architect -> Developer -> QA team on your sprint.'}
                    </Text>
                  </Stack>
                  <Button
                    variant="solid"
                    tone="accent"
                    size="sm"
                    disabled={busy || !hasWorkspaceReady}
                    onPress={() => void quickLaunchPreset('feature-epic-delivery', true)}
                  >
                    Launch Sprint Team
                  </Button>
                </Row>

                <Separator />

                <Row justify="between" align="center">
                  <Stack gap="none">
                    <Text size="sm" weight="semibold">
                      Rapid Bugfix & Patch
                    </Text>
                    <Text size="xs" muted>
                      QA reproduces the bug, Developer patches it, Security verifies the fix.
                    </Text>
                  </Stack>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !hasWorkspaceReady}
                    onPress={() => void quickLaunchPreset('rapid-hotfix-sprint', false)}
                  >
                    Launch Hotfix
                  </Button>
                </Row>

                <Separator />

                <Row justify="between" align="center">
                  <Stack gap="none">
                    <Text size="sm" weight="semibold">
                      Architecture & Tech Spike
                    </Text>
                    <Text size="xs" muted>
                      Architect prototypes a solution and Developer estimates implementation effort.
                    </Text>
                  </Stack>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !hasWorkspaceReady}
                    onPress={() => void quickLaunchPreset('tech-spike-sprint', false)}
                  >
                    Launch Spike
                  </Button>
                </Row>

                <Row justify="end" gap="xs">
                  <Button variant="ghost" size="sm" onPress={() => set(activeTab, 'board')}>
                    Open Agile Board
                  </Button>
                  <Button variant="ghost" size="sm" onPress={() => set(activeTab, 'workflows')}>
                    Customize Workflows
                  </Button>
                </Row>
              </Stack>
            </Card>

            {/* Quick Orca Glossary for Newcomers */}
            <Card
              title="New to Orca? Quick Guide"
              description="How each part of Antigravity Flow fits into Orca."
            >
              <Stack gap="xs">
                <Text size="xs">
                  • <Text weight="semibold">Workspace:</Text> Your Git branch/worktree in Orca where
                  terminals and AI agents run safely.
                </Text>
                <Text size="xs">
                  • <Text weight="semibold">Agile Board & Roadmap:</Text> Organize goals into Sprints,
                  Epics, and Work Items (Todo → In Progress → In Review → Done).
                </Text>
                <Text size="xs">
                  • <Text weight="semibold">Startup Workflows:</Text> Multi-persona teams that talk to
                  each other automatically via their shared thread & Orca orchestration mail.
                </Text>
                <Text size="xs">
                  • <Text weight="semibold">Accounts & Quotas:</Text> Isolate different Google
                  Antigravity accounts per persona and monitor remaining token limits.
                </Text>
              </Stack>
            </Card>
          </Stack>
        </Tab>

        {/* ========================================================================= */}
        {/* TAB 1: AGILE BOARD (Synchronized with Orca Workspace Board Lanes)         */}
        {/* ========================================================================= */}
        <Tab value="board" label="Agile Board" icon="blocks">
          <Stack gap="md">
            {/* Sprint Selector & Header Card */}
            <Card>
              <Stack gap="sm">
                <Row justify="between" align="center">
                  <Row gap="xs" align="center">
                    <Text weight="semibold">Sprint:</Text>
                    {sprintOptions.length > 0 ? (
                      <Select
                        label="Selected Sprint"
                        labelHidden
                        options={sprintOptions}
                        value={activeSprint ? activeSprint.id : sprintOptions[0]?.value}
                        onChange={(val) => {
                          if (val) set(selectedSprintId, val)
                        }}
                      />
                    ) : (
                      <Text weight="semibold">No Sprints</Text>
                    )}
                  </Row>
                  <Row gap="xs" align="center">
                    {activeSprint ? (
                      <Badge
                        tone={
                          activeSprint.status === 'active'
                            ? 'success'
                            : activeSprint.status === 'completed'
                              ? 'neutral'
                              : 'accent'
                        }
                      >
                        {activeSprint.status.toUpperCase()}
                      </Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onPress={() => void syncBoardFromAgents()}
                    >
                      Sync Agents
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => void openNativeWorkspaceBoard()}
                    >
                      Workspace Board
                    </Button>
                  </Row>
                </Row>

                {activeSprint?.goal ? (
                  <Text size="xs" muted>
                    Sprint Goal: {activeSprint.goal}
                  </Text>
                ) : null}

                {/* Orca Synchronized Board Lanes Filter Bar */}
                <Row gap="xs" align="center" wrap>
                  <Button
                    variant={laneFilter === 'all' ? 'solid' : 'ghost'}
                    size="sm"
                    onPress={() => set(selectedLaneFilter, 'all')}
                  >
                    All ({sprintItems.length})
                  </Button>
                  <Button
                    variant={laneFilter === 'todo' ? 'solid' : 'ghost'}
                    size="sm"
                    onPress={() => set(selectedLaneFilter, 'todo')}
                  >
                    Todo ({todoCount})
                  </Button>
                  <Button
                    variant={laneFilter === 'in-progress' ? 'solid' : 'ghost'}
                    size="sm"
                    onPress={() => set(selectedLaneFilter, 'in-progress')}
                  >
                    In Progress ({progressCount})
                  </Button>
                  <Button
                    variant={laneFilter === 'in-review' ? 'solid' : 'ghost'}
                    size="sm"
                    onPress={() => set(selectedLaneFilter, 'in-review')}
                  >
                    In Review ({reviewCount})
                  </Button>
                  <Button
                    variant={laneFilter === 'completed' ? 'solid' : 'ghost'}
                    size="sm"
                    onPress={() => set(selectedLaneFilter, 'completed')}
                  >
                    Done ({doneCount})
                  </Button>
                </Row>

                {/* Sprint Lifecycle Action Buttons */}
                {activeSprint ? (
                  <Row justify="end" gap="xs">
                    {activeSprint.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        tone="accent"
                        onPress={() => {
                          const next = !completingSprint
                          set(showCompleteSprint, next)
                          if (next) cancelDeleteSprint()
                        }}
                      >
                        {completingSprint ? 'Cancel Complete' : 'Complete Sprint'}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      tone="danger"
                      disabled={busy}
                      onPress={() =>
                        curDeletingSprintId === activeSprint.id
                          ? cancelDeleteSprint()
                          : openDeleteSprintConfirm(activeSprint.id)
                      }
                    >
                      {curDeletingSprintId === activeSprint.id ? 'Cancel Delete' : 'Delete Sprint'}
                    </Button>
                  </Row>
                ) : null}
              </Stack>
            </Card>

            {/* Complete Sprint Modal / Subform */}
            {completingSprint && activeSprint ? (
              <Card
                title={`Complete ${activeSprint.name}`}
                description="Archive active sprint and optionally roll over incomplete tasks."
              >
                <Stack gap="sm">
                  <Text size="xs">
                    Pending Tasks: {todoCount + progressCount + reviewCount} of {sprintItems.length}{' '}
                    tasks remain uncompleted.
                  </Text>
                  {rolloverSprintOptions.length > 0 ? (
                    <Select
                      label="Roll over unfinished tasks to:"
                      options={rolloverSprintOptions}
                      value={read(rolloverSprintId) || rolloverSprintOptions[0]?.value}
                      onChange={(val) => set(rolloverSprintId, val ?? '')}
                    />
                  ) : (
                    <Text size="xs" muted>
                      No other planning sprint available. Incomplete tasks will remain archived in
                      this sprint.
                    </Text>
                  )}
                  <Row justify="end" gap="xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => set(showCompleteSprint, false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      tone="accent"
                      size="sm"
                      disabled={busy}
                      onPress={() => void completeActiveSprint(activeSprint.id)}
                    >
                      Confirm Complete & Rollover
                    </Button>
                  </Row>
                </Stack>
              </Card>
            ) : null}

            {/* Delete Sprint Confirmation Subform */}
            {activeSprint && curDeletingSprintId === activeSprint.id ? (
              <Card
                title={`Delete ${activeSprint.name}`}
                description="Permanently remove this sprint and choose how to handle its work items."
              >
                {renderDeleteSprintConfirmBody(activeSprint, sprintItems.length, sprintList, busy)}
              </Card>
            ) : null}

            {/* Target Project Workspace Selector */}
            {wsOptions.length > 0 ? (
              <Select
                label="Target Project Workspace"
                options={wsOptions}
                value={read(selectedWorkspaceId) ?? 'active'}
                onChange={(val) => set(selectedWorkspaceId, val ?? 'active')}
                disabled={busy}
              />
            ) : null}

            {/* Work Items Header */}
            <Row justify="between" align="center">
              <Heading level={2}>Sprint Work Items ({visibleItems.length})</Heading>
              <Button
                variant={addingItem ? 'outline' : 'solid'}
                size="sm"
                onPress={() => set(showAddWorkItem, !addingItem)}
              >
                {addingItem ? 'Close' : '+ New Work Item'}
              </Button>
            </Row>

            {/* Work Items List */}
            {visibleItems.length === 0 ? (
              <EmptyState
                icon="blocks"
                title="No Work Items"
                description={
                  laneFilter !== 'all'
                    ? `No tasks in "${laneFilter}" lane.`
                    : 'Add work items to this sprint or create a new sprint in Roadmap.'
                }
              />
            ) : (
              visibleItems.map((item) => {
                const epic = epicList.find((e) => e.id === item.epicId)
                const assignedAcc = accountList.find((a) => a.id === item.assignedAccountId)
                const currentLane = ORCA_LANES.find((l) => l.id === item.status) || ORCA_LANES[0]

                return (
                  <Card key={item.id}>
                    <Stack gap="xs">
                      {/* Top Header Row */}
                      <Row justify="between" align="center">
                        <Row gap="xs" align="center">
                          <Badge tone={currentLane?.tone ?? 'neutral'}>
                            {currentLane?.label.toUpperCase() ?? item.status.toUpperCase()}
                          </Badge>
                          <Text weight="semibold">{item.title}</Text>
                        </Row>
                        <Row gap="xs" align="center">
                          {item.storyPoints ? (
                            <Badge tone="neutral">{item.storyPoints} pts</Badge>
                          ) : null}
                          <IconButton
                            icon="delete"
                            label={`Delete ${item.title}`}
                            variant="ghost"
                            disabled={busy}
                            onPress={() => void deleteAgileWorkItem(item.id)}
                          />
                        </Row>
                      </Row>

                      {/* Epic and Agent assignment badges */}
                      <Row gap="xs" align="center" wrap>
                        {epic ? <Badge tone="accent">Epic: {epic.name}</Badge> : null}
                        {assignedAcc ? (
                          <Text size="xs" muted>
                            Assigned: {assignedAcc.name} ({assignedAcc.personaName || 'Agent'})
                          </Text>
                        ) : null}
                      </Row>

                      {item.description ? (
                        <Text size="xs" muted>
                          {item.description}
                        </Text>
                      ) : null}

                      <Separator />

                      {/* Orca Synchronized Status Lane Controls & Agent Run Button */}
                      <Row justify="between" align="center" wrap gap="xs">
                        <Row gap="xs" align="center">
                          <Text size="xs" muted>
                            Lane:
                          </Text>
                          {ORCA_LANES.map((l) => (
                            <Button
                              key={l.id}
                              variant={item.status === l.id ? 'solid' : 'ghost'}
                              size="sm"
                              disabled={busy}
                              onPress={() => void updateWorkItemStatus(item.id, l.id)}
                            >
                              {l.label}
                            </Button>
                          ))}
                        </Row>

                        <Button
                          variant="solid"
                          tone="accent"
                          size="sm"
                          disabled={busy}
                          onPress={() => void summonAgentForWorkItem(item.id)}
                        >
                          Run with Agent
                        </Button>
                      </Row>
                    </Stack>
                  </Card>
                )
              })
            )}

            {/* Add Work Item Form */}
            {addingItem ? (
              <Card
                title="Add Agile Work Item"
                description="Create a task linked to an Epic, Sprint, and assigned Agent Persona."
              >
                <Stack gap="sm">
                  <Input
                    label="Task Title"
                    placeholder="e.g. Implement OAuth Flow, Design Database Schema"
                    value={read(newItemTitle)}
                    onChange={(val) => set(newItemTitle, val)}
                    disabled={busy}
                  />
                  <Textarea
                    label="Acceptance Criteria & Description"
                    placeholder="Describe task scope, user story, and acceptance criteria..."
                    rows={3}
                    value={read(newItemDesc)}
                    onChange={(val) => set(newItemDesc, val)}
                    disabled={busy}
                  />
                  <Row gap="sm" align="center">
                    {epicOptions.length > 0 ? (
                      <Select
                        label="Epic"
                        options={epicOptions}
                        value={read(newItemEpicId) || epicOptions[0]?.value}
                        onChange={(val) => set(newItemEpicId, val ?? 'epic-101')}
                      />
                    ) : null}
                    {sprintOptions.length > 0 ? (
                      <Select
                        label="Sprint"
                        options={sprintOptions}
                        value={read(newItemSprintId) || sprintOptions[0]?.value}
                        onChange={(val) => set(newItemSprintId, val ?? 'sprint-1')}
                      />
                    ) : null}
                  </Row>
                  <Row gap="sm" align="center">
                    {accountOptions.length > 0 ? (
                      <Select
                        label="Assigned Agent Persona"
                        options={accountOptions}
                        value={read(newItemAccountId) || accountOptions[0]?.value}
                        onChange={(val) => set(newItemAccountId, val ?? '')}
                      />
                    ) : null}
                    <Select
                      label="Initial Board Lane"
                      options={ORCA_LANES.map((l) => ({ label: l.label, value: l.id }))}
                      value={read(newItemStatus)}
                      onChange={(val) => set(newItemStatus, (val as AgileTaskStatus) ?? 'todo')}
                    />
                  </Row>
                  <Input
                    label="Story Points"
                    placeholder="1, 2, 3, 5, 8"
                    value={read(newItemPoints)}
                    onChange={(val) => set(newItemPoints, val)}
                  />
                  <Row justify="end" gap="sm">
                    <Button variant="ghost" disabled={busy} onPress={clearWorkItemForm}>
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      tone="accent"
                      disabled={busy || !read(newItemTitle).trim()}
                      onPress={() => void saveAgileWorkItem()}
                    >
                      Save Work Item
                    </Button>
                  </Row>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Tab>

        {/* ========================================================================= */}
        {/* TAB 2: ROADMAP & SPRINTS LIFECYCLE                                        */}
        {/* ========================================================================= */}
        <Tab value="roadmap" label="Roadmap & Sprints" icon="flag">
          <Stack gap="md">
            {/* Section 1: Strategic Epics & Roadmap Initiatives */}
            <Row justify="between" align="center">
              <Stack gap="none">
                <Heading level={2}>Strategic Epics ({epicList.length})</Heading>
                <Text size="xs" muted>
                  High-level initiatives, milestone goals, and completion velocity.
                </Text>
              </Stack>
              <Button
                variant={addingEpic ? 'outline' : 'solid'}
                size="sm"
                onPress={() => set(showAddEpic, !addingEpic)}
              >
                {addingEpic ? 'Close' : '+ New Epic'}
              </Button>
            </Row>

            {/* Add Epic Form */}
            {addingEpic ? (
              <Card
                title="Create Roadmap Epic"
                description="Define a major strategic capability or product milestone."
              >
                <Stack gap="sm">
                  <Input
                    label="Epic Name"
                    placeholder="e.g. Authentication & RBAC, Billing & Invoicing"
                    value={read(newEpicName)}
                    onChange={(val) => set(newEpicName, val)}
                  />
                  <Textarea
                    label="Epic Description & Scope"
                    placeholder="Describe business objective and target architecture..."
                    rows={3}
                    value={read(newEpicDesc)}
                    onChange={(val) => set(newEpicDesc, val)}
                  />
                  <Select
                    label="Initial Status"
                    options={[
                      { label: 'In Progress', value: 'in-progress' },
                      { label: 'Planned', value: 'planned' },
                      { label: 'Completed', value: 'completed' }
                    ]}
                    value={read(newEpicStatus)}
                    onChange={(val) =>
                      set(
                        newEpicStatus,
                        (val as 'planned' | 'in-progress' | 'completed') ?? 'in-progress'
                      )
                    }
                  />
                  <Row justify="end" gap="sm">
                    <Button variant="ghost" onPress={clearEpicForm}>
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      tone="accent"
                      disabled={!read(newEpicName).trim() || busy}
                      onPress={() => void saveEpic()}
                    >
                      Save Epic
                    </Button>
                  </Row>
                </Stack>
              </Card>
            ) : null}

            {/* Epics List with Progress Calculations */}
            {epicList.length === 0 ? (
              <EmptyState
                icon="flag"
                title="No Strategic Epics"
                description="Add an Epic to organize stories and track roadmap milestones."
              />
            ) : (
              epicList.map((epic) => {
                const epicTasks = itemList.filter((i) => i.epicId === epic.id)
                const totalPoints = epicTasks.reduce((acc, i) => acc + (i.storyPoints || 0), 0)
                const donePoints = epicTasks
                  .filter((i) => i.status === 'completed')
                  .reduce((acc, i) => acc + (i.storyPoints || 0), 0)
                const percent = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0

                return (
                  <Card key={epic.id}>
                    <Stack gap="xs">
                      <Row justify="between" align="center">
                        <Row gap="xs" align="center">
                          <Badge tone={epic.status === 'completed' ? 'success' : 'accent'}>
                            {epic.status ? epic.status.toUpperCase() : 'ACTIVE'}
                          </Badge>
                          <Text weight="semibold">{epic.name}</Text>
                        </Row>
                        <Row gap="xs" align="center">
                          <Badge tone={percent === 100 ? 'success' : 'neutral'}>
                            {percent}% Complete
                          </Badge>
                          <IconButton
                            icon="delete"
                            label={`Delete ${epic.name}`}
                            variant="ghost"
                            disabled={busy}
                            onPress={() => void deleteEpic(epic.id)}
                          />
                        </Row>
                      </Row>

                      {epic.description ? (
                        <Text size="xs" muted>
                          {epic.description}
                        </Text>
                      ) : null}

                      {/* Progress Metrics */}
                      <Row gap="sm" align="center">
                        <Text size="xs" weight="medium">
                          Points: {donePoints} / {totalPoints} completed ({epicTasks.length} work
                          items)
                        </Text>
                      </Row>
                    </Stack>
                  </Card>
                )
              })
            )}

            <Separator />

            {/* Section 2: Sprint Planning & Timeline Lifecycle */}
            <Row justify="between" align="center">
              <Stack gap="none">
                <Heading level={2}>Sprints Timeline ({sprintList.length})</Heading>
                <Text size="xs" muted>
                  Manage active sprints, schedule future timeboxes, and review past iterations.
                </Text>
              </Stack>
              <Button
                variant={addingSprint ? 'outline' : 'solid'}
                size="sm"
                onPress={() => set(showAddSprint, !addingSprint)}
              >
                {addingSprint ? 'Close' : '+ New Sprint'}
              </Button>
            </Row>

            {/* Add Sprint Form */}
            {addingSprint ? (
              <Card
                title="Plan New Sprint"
                description="Define sprint timebox, target velocity, and team goal."
              >
                <Stack gap="sm">
                  <Input
                    label="Sprint Name"
                    placeholder="e.g. Sprint 2: Core Architecture & Backend"
                    value={read(newSprintName)}
                    onChange={(val) => set(newSprintName, val)}
                  />
                  <Input
                    label="Sprint Goal"
                    placeholder="e.g. Deliver database migrations and secure OAuth token validation"
                    value={read(newSprintGoal)}
                    onChange={(val) => set(newSprintGoal, val)}
                  />
                  <Row gap="sm" align="center">
                    <Input
                      label="Start Date"
                      placeholder="e.g. 2026-12-01"
                      value={read(newSprintStart)}
                      onChange={(val) => set(newSprintStart, val)}
                    />
                    <Input
                      label="End Date"
                      placeholder="e.g. 2026-12-14"
                      value={read(newSprintEnd)}
                      onChange={(val) => set(newSprintEnd, val)}
                    />
                  </Row>
                  <Row gap="sm" align="center">
                    <Input
                      label="Target Capacity (Story Points)"
                      placeholder="20"
                      value={read(newSprintPoints)}
                      onChange={(val) => set(newSprintPoints, val)}
                    />
                    <Select
                      label="Initial Sprint Status"
                      options={[
                        { label: 'Planning', value: 'planning' },
                        { label: 'Active', value: 'active' },
                        { label: 'Completed', value: 'completed' }
                      ]}
                      value={read(newSprintStatus)}
                      onChange={(val) =>
                        set(
                          newSprintStatus,
                          (val as 'active' | 'planning' | 'completed') ?? 'planning'
                        )
                      }
                    />
                  </Row>
                  <Row justify="end" gap="sm">
                    <Button variant="ghost" onPress={clearSprintForm}>
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      tone="accent"
                      disabled={!read(newSprintName).trim() || busy}
                      onPress={() => void saveSprint()}
                    >
                      Create Sprint
                    </Button>
                  </Row>
                </Stack>
              </Card>
            ) : null}

            {/* Sprints List */}
            {sprintList.length === 0 ? (
              <EmptyState
                icon="flag"
                title="No Sprints Defined"
                description="Create a sprint to start organizing tasks into iterations."
              />
            ) : (
              sprintList.map((sp) => {
                const spTasks = itemList.filter((i) => i.sprintId === sp.id)
                const spDone = spTasks.filter((i) => i.status === 'completed').length
                const committedPoints = spTasks.reduce((acc, i) => acc + (i.storyPoints || 0), 0)

                return (
                  <Card key={sp.id}>
                    <Stack gap="xs">
                      <Row justify="between" align="center">
                        <Row gap="xs" align="center">
                          <Text weight="semibold">{sp.name}</Text>
                          <Badge
                            tone={
                              sp.status === 'active'
                                ? 'success'
                                : sp.status === 'completed'
                                  ? 'neutral'
                                  : 'accent'
                            }
                          >
                            {sp.status.toUpperCase()}
                          </Badge>
                        </Row>
                        <Row gap="xs" align="center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => {
                              set(selectedSprintId, sp.id)
                              set(activeTab, 'board')
                            }}
                          >
                            Open on Board
                          </Button>
                          <IconButton
                            icon="delete"
                            label={`Delete ${sp.name}`}
                            variant="ghost"
                            tone="danger"
                            disabled={busy}
                            onPress={() =>
                              curDeletingSprintId === sp.id
                                ? cancelDeleteSprint()
                                : openDeleteSprintConfirm(sp.id)
                            }
                          />
                        </Row>
                      </Row>

                      {sp.goal ? (
                        <Text size="xs" muted>
                          Goal: {sp.goal}
                        </Text>
                      ) : null}

                      <Row gap="sm" align="center" wrap>
                        <Badge tone="neutral">
                          Tasks: {spDone} / {spTasks.length} Done
                        </Badge>
                        <Badge tone="neutral">
                          Points: {committedPoints} / {sp.targetPoints || 20} pts
                        </Badge>
                        {sp.startDate || sp.endDate ? (
                          <Text size="xs" muted>
                            {sp.startDate ?? 'Start'} → {sp.endDate ?? 'End'}
                          </Text>
                        ) : null}
                      </Row>

                      {curDeletingSprintId === sp.id ? (
                        <>
                          <Separator />
                          {renderDeleteSprintConfirmBody(sp, spTasks.length, sprintList, busy)}
                        </>
                      ) : null}
                    </Stack>
                  </Card>
                )
              })
            )}
          </Stack>
        </Tab>

        {/* ========================================================================= */}
        {/* TAB 3: STARTUP COMPANY AGILE WORKFLOWS                                    */}
        {/* ========================================================================= */}
        <Tab value="workflows" label="Startup Workflows" icon="layers">
          <Stack gap="md">
            <Row justify="between" align="center">
              <Stack gap="none">
                <Heading level={2}>Startup Agile Workflows</Heading>
                <Text size="xs" muted>
                  Orchestrate multi-role agent pipelines from Epic breakdown to release.
                </Text>
              </Stack>
              <Button
                variant={addingWf ? 'outline' : 'solid'}
                size="sm"
                onPress={() => set(showAddWorkflow, !addingWf)}
              >
                {addingWf ? 'Close' : '+ New Workflow'}
              </Button>
            </Row>

            {tipsVisible ? (
              <Callout tone="accent">
                <Row justify="between" align="center" gap="xs">
                  <Text size="xs">
                    How it works: Pick a mode and goal below, then click Launch. Every persona
                    automatically gets a shared team thread and peer messaging so they talk to each
                    other until the goal is done.
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => set(showBeginnerTips, false)}
                  >
                    Got it
                  </Button>
                </Row>
              </Callout>
            ) : null}

            {/* Team Launch Mode & Goal Target Configuration */}
            <Card
              title="1. Choose Team Mode & Goal"
              description="Recommended for beginners: leave Auto Agent Team selected, pick a Sprint/Epic/Work Item, and click Launch."
            >
              <Stack gap="sm">
                <Select
                  label="How should the team run?"
                  options={[
                    {
                      label: 'Auto Agent Team (Recommended — 100% automatic, no bot setup)',
                      value: 'auto-agents'
                    },
                    {
                      label: `Orca Bots Team (Uses existing Orca Bots — ${botList.length} found)`,
                      value: 'orca-bots'
                    }
                  ]}
                  value={launchMode}
                  onChange={(val) =>
                    set(wfLaunchMode, (val as WorkflowExecutionMode) || 'auto-agents')
                  }
                />

                <Select
                  label="What should the team finish?"
                  options={[
                    { label: 'General Mission (Use workflow default instructions)', value: 'none' },
                    { label: 'Finish a Sprint (all work items in sprint)', value: 'sprint' },
                    { label: 'Finish an Epic (all work items in epic)', value: 'epic' },
                    { label: 'Finish a Single Work Item', value: 'workitem' }
                  ]}
                  value={goalType}
                  onChange={(val) => {
                    const nextType = (val as WorkflowGoalType) || 'none'
                    set(wfGoalType, nextType)
                    if (nextType === 'sprint') {
                      set(wfGoalId, sprintList[0]?.id || '')
                    } else if (nextType === 'epic') {
                      set(wfGoalId, epicList[0]?.id || '')
                    } else if (nextType === 'workitem') {
                      set(wfGoalId, itemList[0]?.id || '')
                    } else {
                      set(wfGoalId, '')
                    }
                  }}
                />

                {goalType !== 'none' && goalTargetOptions.length > 0 ? (
                  <Select
                    label={
                      goalType === 'sprint'
                        ? 'Select Target Sprint'
                        : goalType === 'epic'
                          ? 'Select Target Epic'
                          : 'Select Target Work Item'
                    }
                    options={goalTargetOptions}
                    value={goalId || goalTargetOptions[0]?.value || ''}
                    onChange={(val) => set(wfGoalId, val ?? '')}
                  />
                ) : null}

                <Input
                  label="Extra Notes / Definition of Done (Optional)"
                  placeholder="e.g. Make sure all tests pass and code is clean"
                  value={read(wfCustomGoal)}
                  onChange={(val) => set(wfCustomGoal, val)}
                  disabled={busy}
                />

                {launchMode === 'orca-bots' ? (
                  <Row justify="between" align="center">
                    <Text size="xs" muted>
                      {botList.length > 0
                        ? `Ready Orca Bots: ${botList.map((b) => `bot:${b.name}`).join(', ')} (auto-assigned to steps by default)`
                        : 'No Orca Bots found yet. Create a bot in Orca’s Bots sidebar or switch to Auto Agent Team.'}
                    </Text>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onPress={() => void refreshOrcaBots()}
                    >
                      Refresh Bots
                    </Button>
                  </Row>
                ) : null}
              </Stack>
            </Card>

            {/* Workflows List */}
            {wfList.length === 0 ? (
              <EmptyState
                icon="layers"
                title="No Workflows Defined"
                description="Define a multi-agent team workflow for this project."
              />
            ) : (
              wfList.map((wf) => (
                <Card
                  key={wf.id}
                  title={wf.name}
                  description={wf.description || 'Agile startup pipeline'}
                >
                  <Stack gap="sm">
                    <Text size="xs" weight="medium">
                      Team Personas ({wf.steps.length} steps — auto-connected):
                    </Text>
                    <Stack gap="xs">
                      {wf.steps.map((st, idx) => {
                        const acc = accountList.find((a) => a.id === st.accountId)
                        return (
                          <Row key={st.id} justify="between" align="center">
                            <Row gap="xs" align="center">
                              <Badge tone="neutral">#{idx + 1}</Badge>
                              <Text weight="medium">{st.name}</Text>
                              {st.statusLane ? (
                                <Badge tone="accent">Lane: {st.statusLane}</Badge>
                              ) : null}
                              <Badge tone="success">
                                {acc ? acc.name : st.accountId}
                                {acc?.personaName ? ` (${acc.personaName})` : ''}
                              </Badge>
                              {st.botName ? (
                                <Badge tone="accent">bot:{st.botName}</Badge>
                              ) : null}
                            </Row>
                          </Row>
                        )
                      })}
                    </Stack>

                    <Row justify="end" gap="sm">
                      <Button
                        variant="solid"
                        tone="accent"
                        disabled={busy}
                        onPress={() => void executeWorkflow(wf.id)}
                      >
                        {launchMode === 'orca-bots'
                          ? 'Dispatch to Orca Bots'
                          : 'Launch Auto Agent Team'}
                      </Button>
                    </Row>
                  </Stack>
                </Card>
              ))
            )}

            {/* Add Workflow Form */}
            {addingWf ? (
              <Card
                title="Define Project Multi-Agent Workflow"
                description="Chain multiple agents with different accounts and personas."
              >
                <Stack gap="sm">
                  <Input
                    label="Workflow Name"
                    placeholder="e.g. Sprint 1: Feature Epic Delivery"
                    value={read(wfName)}
                    onChange={(val) => set(wfName, val)}
                    disabled={busy}
                  />
                  <Input
                    label="Workflow Description (Optional)"
                    placeholder="What this multi-agent team achieves"
                    value={read(wfDesc)}
                    onChange={(val) => set(wfDesc, val)}
                    disabled={busy}
                  />

                  <Separator />

                  {/* Steps Configured in Draft */}
                  <Heading level={3}>Configured Steps ({read(wfSteps).length})</Heading>
                  {read(wfSteps).length === 0 ? (
                    <Text size="xs" muted>
                      No steps added yet. Add steps below.
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {read(wfSteps).map((s, idx) => (
                        <Row key={s.id} justify="between" align="center">
                          <Text size="xs" weight="medium">
                            #{idx + 1} {s.name} ({s.accountId}) [{s.statusLane || 'in-progress'}]
                          </Text>
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => {
                              const steps = read(wfSteps).filter((st) => st.id !== s.id)
                              set(wfSteps, steps)
                            }}
                          >
                            Remove
                          </Button>
                        </Row>
                      ))}
                    </Stack>
                  )}

                  <Separator />

                  {/* Add Step Subform */}
                  <Stack gap="xs">
                    <Text size="xs" weight="semibold">
                      Add Step to Pipeline
                    </Text>
                    <Input
                      label="Step Name"
                      placeholder="e.g. 1. Architecture Plan, 2. Feature Coding, 3. Security Audit"
                      value={read(newStepName)}
                      onChange={(val) => set(newStepName, val)}
                    />
                    {accountOptions.length > 0 ? (
                      <Select
                        label="Assign Account Profile"
                        options={accountOptions}
                        value={read(newStepAccountId) || accountOptions[0]?.value}
                        onChange={(val) => set(newStepAccountId, val ?? '')}
                      />
                    ) : null}
                    <Select
                      label="Map to Orca Bot (Optional — for Semi-Auto Bot Mode)"
                      options={botOptions}
                      value={read(newStepBotName)}
                      onChange={(val) => set(newStepBotName, val ?? '')}
                    />
                    <Select
                      label="Target Workspace Board Lane"
                      options={ORCA_LANES.map((l) => ({ label: l.label, value: l.id }))}
                      value={read(newStepStatusLane)}
                      onChange={(val) =>
                        set(newStepStatusLane, (val as AgileTaskStatus) ?? 'in-progress')
                      }
                    />
                    <Textarea
                      label="Step Instructions (Markdown)"
                      placeholder="Step-specific instructions for this agent..."
                      rows={3}
                      value={read(newStepPrompt)}
                      onChange={(val) => set(newStepPrompt, val)}
                    />
                    <Input
                      label="Step Custom Flags (Optional)"
                      placeholder="e.g. --dangerously-skip-permissions"
                      value={read(newStepFlags)}
                      onChange={(val) => set(newStepFlags, val)}
                    />
                    <Button variant="outline" size="sm" onPress={addWorkflowStep}>
                      + Add Step
                    </Button>
                  </Stack>

                  <Separator />

                  <Row justify="end" gap="sm">
                    <Button variant="ghost" disabled={busy} onPress={clearWorkflowForm}>
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      tone="accent"
                      disabled={busy || !read(wfName).trim() || read(wfSteps).length === 0}
                      onPress={() => void saveWorkflow()}
                    >
                      Save Workflow
                    </Button>
                  </Row>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Tab>

        {/* ========================================================================= */}
        {/* TAB 4: ACCOUNTS & PERSONAS                                                */}
        {/* ========================================================================= */}
        <Tab value="accounts" label="Accounts & Personas" icon="bot">
          <Stack gap="md">
            {/* Active Profile & Instant Summon Card */}
            {activeAccount ? (
              <Card
                title="Active Profile"
                description="Summon agent in workspace with isolated environment."
              >
                <Stack gap="sm">
                  <Row justify="between" align="center">
                    <Row gap="xs" align="center">
                      <Text weight="semibold">{activeAccount.name}</Text>
                      {activeAccount.personaName ? (
                        <Badge tone="accent">{activeAccount.personaName}</Badge>
                      ) : null}
                      {activeAccount.email ? (
                        <Badge tone="neutral">{activeAccount.email}</Badge>
                      ) : null}
                      {activeAccount.shareGlobalSkills !== false ? (
                        <Badge tone="success">Global Skills</Badge>
                      ) : null}
                    </Row>
                    <Badge tone="success">Active</Badge>
                  </Row>

                  {activeAccount.description ? (
                    <Text size="xs" muted>
                      {activeAccount.description}
                    </Text>
                  ) : null}

                  {/* Environment Isolation Details */}
                  <Stack gap="xs">
                    <Text size="xs" muted weight="medium">
                      Isolated Directories:
                    </Text>
                    <Row gap="xs" align="center">
                      <Badge tone="neutral">HOME</Badge>
                      <Code>{activeAccount.home}</Code>
                    </Row>
                    <Row gap="xs" align="center">
                      <Badge tone="neutral">GEMINI_HOME</Badge>
                      <Code>{activeAccount.geminiHome}</Code>
                    </Row>
                  </Stack>

                  <Separator />

                  {/* Dynamic CLI Options */}
                  <Stack gap="xs">
                    <Text size="xs" weight="medium">
                      CLI Flags & Execution Options
                    </Text>
                    <Checkbox
                      label="--dangerously-skip-permissions"
                      description="Skip interactive tool approvals in terminal"
                      checked={read(summonSkipPermissions)}
                      onChange={(val) => set(summonSkipPermissions, Boolean(val))}
                    />
                    <Input
                      label="Additional Dynamic Flags"
                      placeholder="e.g. --model gemini-2.5-pro --verbose"
                      value={read(summonCustomFlags)}
                      onChange={(val) => set(summonCustomFlags, val)}
                      disabled={busy}
                    />
                  </Stack>

                  <Separator />

                  {/* Markdown Startup Prompt Textarea */}
                  <Stack gap="xs">
                    <Row justify="between" align="center">
                      <Text size="xs" weight="medium">
                        Startup Prompt (Markdown Supported)
                      </Text>
                      <Badge tone="neutral">Markdown</Badge>
                    </Row>
                    <Textarea
                      label="Startup Prompt"
                      labelHidden
                      placeholder={
                        'Enter markdown instructions or task requirements...\nExample:\n## Objective\nAnalyze git diff and optimize queries.'
                      }
                      rows={4}
                      value={read(summonPrompt)}
                      onChange={(val) => set(summonPrompt, val)}
                      disabled={busy}
                    />
                  </Stack>

                  <Row justify="between" align="center" gap="xs">
                    <Text size="xs" muted>
                      Target Workspace:
                    </Text>
                    <Badge tone={read(selectedWorkspaceId) === 'active' ? 'accent' : 'neutral'}>
                      {read(selectedWorkspaceId) === 'active'
                        ? `⚡ ${activeWsName}${activeWsBranch ? ` (${activeWsBranch})` : ''}`
                        : `📌 ${wsList.find((w) => w.id === read(selectedWorkspaceId))?.name || 'Selected'}`}
                    </Badge>
                  </Row>

                  <Button
                    variant="solid"
                    tone="accent"
                    disabled={busy}
                    onPress={() => void summonAgy(activeAccount.id)}
                  >
                    Summon Agent ({activeAccount.name})
                  </Button>
                </Stack>
              </Card>
            ) : null}

            {/* Accounts List */}
            <Stack gap="xs">
              <Row justify="between" align="center">
                <Heading level={2}>Configured Accounts ({accountList.length})</Heading>
                <Button
                  variant={adding ? 'outline' : 'solid'}
                  size="sm"
                  onPress={() => set(showAddForm, !adding)}
                >
                  {adding ? 'Close Form' : '+ New Account'}
                </Button>
              </Row>

              {accountList.length === 0 ? (
                <EmptyState
                  icon="bot"
                  title="No Accounts Configured"
                  description="Add an account profile with its own isolated environment."
                />
              ) : (
                accountList.map((acc) => {
                  const isSelected = acc.id === currentActiveId
                  const accStat = statsMap[acc.id]
                  const quota = quotasMap[acc.id]

                  const geminiTone =
                    (quota?.gemini5hRemaining ?? 100) > 50
                      ? 'success'
                      : (quota?.gemini5hRemaining ?? 100) > 20
                        ? 'accent'
                        : 'danger'

                  const weeklyTone =
                    (quota?.geminiWeeklyRemaining ?? 100) > 50
                      ? 'success'
                      : (quota?.geminiWeeklyRemaining ?? 100) > 20
                        ? 'accent'
                        : 'danger'

                  return (
                    <Card key={acc.id}>
                      <Stack gap="xs">
                        <Row justify="between" align="center">
                          <Stack gap="none">
                            <Row gap="xs" align="center" wrap>
                              <Text weight="semibold">{acc.name}</Text>
                              {isSelected ? <Badge tone="success">Active</Badge> : null}
                              {acc.personaName ? (
                                <Badge tone="accent">{acc.personaName}</Badge>
                              ) : null}
                              {acc.email ? (
                                <Badge tone="neutral">{acc.email}</Badge>
                              ) : null}
                            </Row>
                            <Text size="xs" muted>
                              ID: {acc.id}
                            </Text>
                            {acc.flags && acc.flags.length > 0 ? (
                              <Text size="xs" muted>
                                Flags: {acc.flags.join(' ')}
                              </Text>
                            ) : null}
                          </Stack>
                          <Row gap="xs" align="center">
                            {quota?.status === 'needs-login' ? (
                              <Button
                                variant="solid"
                                size="sm"
                                disabled={busy}
                                onPress={() => void loginAccount(acc.id)}
                              >
                                Sign in with Google
                              </Button>
                            ) : null}
                            {!isSelected ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onPress={() => void selectAccount(acc.id)}
                              >
                                Set Active
                              </Button>
                            ) : null}
                            <Button
                              variant="solid"
                              size="sm"
                              tone="accent"
                              disabled={busy}
                              onPress={() => void summonAgy(acc.id)}
                            >
                              Summon
                            </Button>
                            <IconButton
                              icon="delete"
                              label={`Delete ${acc.name}`}
                              variant="ghost"
                              disabled={busy}
                              onPress={() => void removeAccount(acc.id)}
                            />
                          </Row>
                        </Row>

                        {/* Real-time Antigravity Token Quota Summary */}
                        <Separator />
                        <Row justify="between" align="center" wrap gap="xs">
                          {quota?.status === 'needs-login' ? (
                            <Row gap="xs" align="center">
                              <Badge tone="warning">Not Logged In</Badge>
                              <Text size="xs" muted>
                                Google account not yet connected. Click "Sign in with Google" to
                                authorize.
                              </Text>
                            </Row>
                          ) : (
                            <Row gap="md" align="center" wrap>
                              <Text size="xs" weight="semibold">
                                Token Quota:
                              </Text>
                              <Row gap="xs" align="center">
                                <Text size="xs" muted>
                                  Gemini 5h:
                                </Text>
                                <Badge tone={geminiTone}>
                                  {typeof quota?.gemini5hRemaining === 'number'
                                    ? `${quota.gemini5hRemaining}%`
                                    : '–'}
                                </Badge>
                              </Row>
                              <Row gap="xs" align="center">
                                <Text size="xs" muted>
                                  Weekly:
                                </Text>
                                <Badge tone={weeklyTone}>
                                  {typeof quota?.geminiWeeklyRemaining === 'number'
                                    ? `${quota.geminiWeeklyRemaining}%`
                                    : '–'}
                                </Badge>
                              </Row>
                              <Row gap="xs" align="center">
                                <Text size="xs" muted>
                                  Claude/GPT:
                                </Text>
                                <Badge tone="neutral">
                                  {typeof quota?.thirdPartyWeeklyRemaining === 'number'
                                    ? `${quota.thirdPartyWeeklyRemaining}%`
                                    : '–'}
                                </Badge>
                              </Row>
                              {quota?.status === 'error' ? (
                                <Badge tone="danger">Offline / Error</Badge>
                              ) : null}
                            </Row>
                          )}
                          <Row gap="xs" align="center">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={quotaLoading}
                              onPress={() => void refreshQuotas(true)}
                            >
                              {quotaLoading ? 'Syncing...' : 'Sync Quota'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => {
                                set(selectedUsageAccountFilter, acc.id)
                                set(activeTab, 'usage')
                              }}
                            >
                              View Table →
                            </Button>
                          </Row>
                        </Row>

                        {/* Quick Usage Summary Badge Row */}
                        <Row justify="between" align="center" wrap gap="xs">
                          <Row gap="xs" align="center" wrap>
                            <Badge tone="neutral">Summons: {accStat?.totalSummons ?? 0}</Badge>
                            <Badge tone="neutral">
                              Tasks: {accStat?.workItemsCompleted ?? 0} Done
                            </Badge>
                            <Badge tone="neutral">
                              Disk: {accStat?.diskUsageFormatted ?? '0 B'}
                            </Badge>
                            {accStat?.lastActiveAt ? (
                              <Text size="xs" muted>
                                Active: {formatTimestamp(accStat.lastActiveAt)}
                              </Text>
                            ) : null}
                          </Row>
                        </Row>
                      </Stack>
                    </Card>
                  )
                })
              )}
            </Stack>

            {/* Add / Configure Account Form */}
            {adding ? (
              <Card
                title="Add Isolated Account Profile"
                description="Define credentials, persona role, and CLI execution options."
              >
                <Stack gap="sm">
                  <Input
                    label="Account Name"
                    placeholder="e.g. product-manager, dev-lead, security-audit"
                    value={read(formName)}
                    onChange={(val) => set(formName, val)}
                    disabled={busy}
                  />
                  <Input
                    label="Email (Optional)"
                    placeholder="e.g. developer@company.com"
                    value={read(formEmail)}
                    onChange={(val) => set(formEmail, val)}
                    disabled={busy}
                  />
                  <Input
                    label="Description (Optional)"
                    placeholder="Notes about this profile purpose"
                    value={read(formDescription)}
                    onChange={(val) => set(formDescription, val)}
                    disabled={busy}
                  />

                  <Separator />

                  {/* Persona Customization */}
                  <Heading level={3}>Persona Customization</Heading>
                  <Select
                    label="Preset Role"
                    options={personaPresetOptions}
                    value={read(formPersonaPreset)}
                    onChange={(val) => handlePersonaPresetChange(val ?? 'senior-fullstack')}
                    disabled={busy}
                  />
                  <Input
                    label="Persona Title"
                    value={read(formPersonaName)}
                    onChange={(val) => set(formPersonaName, val)}
                    disabled={busy}
                  />
                  <Textarea
                    label="Persona Rules & System Instructions (Markdown)"
                    placeholder="Enter system prompt and agent rules..."
                    rows={4}
                    value={read(formPersonaInstructions)}
                    onChange={(val) => set(formPersonaInstructions, val)}
                    disabled={busy}
                  />

                  <Separator />

                  {/* CLI Flags */}
                  <Heading level={3}>CLI Options & Flags</Heading>
                  <Checkbox
                    label="--dangerously-skip-permissions"
                    description="Pre-configure account to bypass permission prompts"
                    checked={read(formSkipPermissions)}
                    onChange={(val) => set(formSkipPermissions, Boolean(val))}
                  />
                  <Input
                    label="Additional Custom Flags"
                    placeholder="e.g. --model gemini-2.5-pro"
                    value={read(formCustomFlags)}
                    onChange={(val) => set(formCustomFlags, val)}
                    disabled={busy}
                  />

                  <Separator />

                  {/* Global Skills Sharing */}
                  <Heading level={3}>Global Skills & Tools</Heading>
                  <Checkbox
                    label="Share global skills (~/.gemini/skills)"
                    description="Allows this account to automatically access global skills and custom tools"
                    checked={read(formShareGlobalSkills)}
                    onChange={(val) => set(formShareGlobalSkills, Boolean(val))}
                  />

                  <Separator />

                  {/* Custom Directories */}
                  <Input
                    label="Custom HOME Directory (Optional)"
                    placeholder="Leave blank for automatic ~/.gemini-accounts/<id>/home"
                    value={read(formCustomHome)}
                    onChange={(val) => set(formCustomHome, val)}
                    disabled={busy}
                  />
                  <Input
                    label="Custom GEMINI_HOME Directory (Optional)"
                    placeholder="Leave blank for automatic ~/.gemini-accounts/<id>/.gemini"
                    value={read(formCustomGeminiHome)}
                    onChange={(val) => set(formCustomGeminiHome, val)}
                    disabled={busy}
                  />

                  <Row justify="end" gap="sm">
                    <Button variant="ghost" disabled={busy} onPress={clearForm}>
                      Cancel
                    </Button>
                    <Button
                      variant="solid"
                      tone="accent"
                      disabled={busy || !read(formName).trim()}
                      onPress={() => void saveAccount()}
                    >
                      Save Account
                    </Button>
                  </Row>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Tab>

        {/* ========================================================================= */}
        {/* TAB 5: USAGE & TOKEN QUOTA ANALYTICS                                      */}
        {/* ========================================================================= */}
        <Tab value="usage" label="Usage & Quota" icon="activity">
          <Stack gap="md">
            {/* Header with Title and Reset Actions */}
            <Row justify="between" align="center">
              <Stack gap="none">
                <Heading level={2}>Antigravity Token Quota & Feature Usage</Heading>
                <Text size="xs" muted>
                  Real-time token remaining quotas, rolling limits, weekly demand, and account
                  velocity.
                </Text>
              </Stack>
              <Row gap="xs" align="center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || quotaLoading}
                  onPress={() => void refreshQuotas(true)}
                >
                  {quotaLoading ? 'Checking...' : 'Refresh Quotas'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={() => void clearUsageData()}
                >
                  Clear History
                </Button>
              </Row>
            </Row>

            {/* MASTER TOKEN QUOTA TABLE */}
            <Card title="Remaining Token Quota (All Accounts)">
              <Stack gap="sm">
                <Text size="xs" muted>
                  Live token remaining percentages across all configured accounts. Scannable at a
                  glance.
                </Text>
                <Table
                  label="Antigravity Account Token Quotas"
                  columns={[
                    { key: 'account', label: 'Account', width: 'md' },
                    { key: 'persona', label: 'Persona', width: 'lg' },
                    { key: 'gemini5h', label: 'Gemini 5-Hour', width: 'sm', align: 'center' },
                    { key: 'geminiWeekly', label: 'Gemini Weekly', width: 'sm', align: 'center' },
                    { key: 'thirdParty', label: 'Claude / GPT', width: 'sm', align: 'center' },
                    { key: 'status', label: 'Status', width: 'xs', align: 'center' },
                    { key: 'lastChecked', label: 'Last Checked', width: 'sm', align: 'end' }
                  ]}
                  rows={masterQuotaRows}
                  emptyText="No accounts registered."
                />
              </Stack>
            </Card>

            {/* DETAILED MODEL BUCKETS BREAKDOWN TABLE */}
            <Card title="Detailed Model Quota Windows & Buckets">
              <Stack gap="sm">
                <Row justify="between" align="center" wrap gap="xs">
                  <Text size="xs" muted>
                    Individual model groups (Gemini Pro/Flash, Claude 3.5 Sonnet, Argon) from agy
                    usage data.
                  </Text>
                  <Row gap="xs" align="center">
                    <Text size="xs" muted>
                      Account:
                    </Text>
                    <Select
                      label="Filter Account"
                      labelHidden
                      options={[{ label: 'All Accounts', value: 'all' }, ...accountOptions]}
                      value={usageFilter}
                      onChange={(val) => set(selectedUsageAccountFilter, val ?? 'all')}
                    />
                  </Row>
                </Row>

                {detailedBucketRows.length > 0 ? (
                  <Table
                    label="Model Quota Buckets Detail"
                    columns={[
                      { key: 'account', label: 'Account', width: 'sm' },
                      { key: 'group', label: 'Model Group', width: 'md' },
                      { key: 'window', label: 'Quota Window', width: 'md' },
                      { key: 'remaining', label: 'Remaining', width: 'sm', align: 'center' },
                      { key: 'used', label: 'Used', width: 'sm', align: 'center' },
                      { key: 'reset', label: 'Resets In', width: 'sm', align: 'end' }
                    ]}
                    rows={detailedBucketRows}
                    emptyText="No model buckets found."
                  />
                ) : (
                  <Callout tone="neutral">
                    <Text size="xs">
                      No model buckets cached yet. Click "Refresh Quotas" above to query agy for
                      remaining limits.
                    </Text>
                  </Callout>
                )}
              </Stack>
            </Card>

            {/* Global Overview Metrics Card */}
            {overview ? (
              <Card title="Global Team Velocity & Storage">
                <Stack gap="sm">
                  <Row gap="sm" align="center" wrap>
                    <Badge tone="accent">Total Summons: {overview.totalSummonsAll}</Badge>
                    <Badge tone="accent">Workflow Steps: {overview.totalWorkflowStepsAll}</Badge>
                    <Badge tone="success">
                      Tasks Completed: {overview.totalWorkItemsCompletedAll} (
                      {overview.totalStoryPointsAll} pts)
                    </Badge>
                    <Badge tone="neutral">
                      Total Disk Footprint: {overview.totalDiskUsageFormatted}
                    </Badge>
                    <Badge tone="success">
                      Top Active: {overview.mostActiveAccountName || 'None'}
                    </Badge>
                  </Row>
                </Stack>
              </Card>
            ) : null}

            {/* Per-Account Environment & Activity Cards */}
            <Heading level={3}>Account Environment & Velocity</Heading>
            <Stack gap="sm">
              {accountList
                .filter((acc) => usageFilter === 'all' || acc.id === usageFilter)
                .map((acc) => {
                  const stat = statsMap[acc.id]
                  const quota = quotasMap[acc.id]
                  const isCurActive = acc.id === currentActiveId

                  return (
                    <Card key={acc.id}>
                      <Stack gap="sm">
                        {/* Title Row */}
                        <Row justify="between" align="center">
                          <Row gap="xs" align="center">
                            <Text weight="semibold">{acc.name}</Text>
                            {isCurActive ? <Badge tone="success">Active Profile</Badge> : null}
                            {acc.personaName ? (
                              <Badge tone="accent">{acc.personaName}</Badge>
                            ) : null}
                            {quota?.status === 'needs-login' ? (
                              <Badge tone="warning">Not Logged In</Badge>
                            ) : null}
                          </Row>
                          <Row gap="xs" align="center">
                            {quota?.status === 'needs-login' ? (
                              <Button
                                variant="solid"
                                size="sm"
                                disabled={busy}
                                onPress={() => void loginAccount(acc.id)}
                              >
                                Sign in with Google
                              </Button>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onPress={() => void summonAgy(acc.id)}
                            >
                              Summon
                            </Button>
                          </Row>
                        </Row>

                        {/* SECTION A: QUICK QUOTA SUMMARY ROW */}
                        <Row gap="md" align="center" wrap>
                          <Text size="xs" weight="medium">
                            Status:
                          </Text>
                          {quota?.status === 'needs-login' ? (
                            <Badge tone="warning">Google Login Required</Badge>
                          ) : (
                            <>
                              <Badge tone="accent">
                                Gemini 5h:{' '}
                                {typeof quota?.gemini5hRemaining === 'number'
                                  ? `${quota.gemini5hRemaining}%`
                                  : '–'}
                              </Badge>
                              <Badge tone="success">
                                Gemini Weekly:{' '}
                                {typeof quota?.geminiWeeklyRemaining === 'number'
                                  ? `${quota.geminiWeeklyRemaining}%`
                                  : '–'}
                              </Badge>
                              <Badge tone="neutral">
                                Claude/GPT:{' '}
                                {typeof quota?.thirdPartyWeeklyRemaining === 'number'
                                  ? `${quota.thirdPartyWeeklyRemaining}%`
                                  : '–'}
                              </Badge>
                            </>
                          )}
                        </Row>

                        <Separator />

                        {/* SECTION B: ACTIVITY & DISK METRICS */}
                        <Stack gap="xs">
                          <Text size="xs" weight="semibold">
                            Account Velocity & Environment:
                          </Text>
                          <Row gap="sm" align="center" wrap>
                            <Badge tone="neutral">Summons: {stat?.totalSummons ?? 0}</Badge>
                            <Badge tone="neutral">
                              Pipeline Steps: {stat?.workflowStepsExecuted ?? 0}
                            </Badge>
                            <Badge tone="success">
                              Tasks Done: {stat?.workItemsCompleted ?? 0} (
                              {stat?.totalStoryPointsCompleted ?? 0} pts)
                            </Badge>
                            <Badge tone="accent">Active Tasks: {stat?.workItemsActive ?? 0}</Badge>
                            <Badge tone="neutral">
                              Disk Size: {stat?.diskUsageFormatted ?? '0 B'}
                            </Badge>
                            <Badge tone="neutral">Conversations: {stat?.sessionCount ?? 0}</Badge>
                          </Row>
                        </Stack>

                        {/* Footer: Path and Last Active */}
                        <Separator />
                        <Row justify="between" align="center" wrap gap="xs">
                          <Row gap="xs" align="center">
                            <Text size="xs" muted>
                              Path:
                            </Text>
                            <Code>{acc.home}</Code>
                          </Row>
                          <Text size="xs" muted>
                            Last active: {formatTimestamp(stat?.lastActiveAt)}
                          </Text>
                        </Row>
                      </Stack>
                    </Card>
                  )
                })}
            </Stack>

            <Separator />

            {/* Recent Activity Timeline Stream */}
            <Row justify="between" align="center">
              <Heading level={3}>Recent Activity Stream ({visibleActivities.length})</Heading>
              {visibleActivities.length > 0 ? (
                <Button variant="ghost" size="sm" onPress={() => void clearUsageData()}>
                  Clear Activity Stream
                </Button>
              ) : null}
            </Row>

            {visibleActivities.length === 0 ? (
              <EmptyState
                icon="activity"
                title="No Activities Recorded"
                description="Summon an agent or run workflow steps to see real-time usage history."
              />
            ) : (
              <Stack gap="xs">
                {visibleActivities.slice(0, 30).map((act) => {
                  const typeTone =
                    act.type === 'summon'
                      ? 'accent'
                      : act.type === 'workflow'
                        ? 'success'
                        : 'neutral'

                  return (
                    <Row
                      key={act.id}
                      justify="between"
                      align="center"
                      padding="xs"
                      style={{
                        borderRadius: '4px',
                        border: '1px solid var(--orca-border)',
                        backgroundColor: 'var(--orca-background-secondary)'
                      }}
                    >
                      <Row gap="xs" align="center">
                        <Badge tone={typeTone}>{act.type.toUpperCase()}</Badge>
                        <Text size="xs" weight="semibold">
                          {act.accountName}:
                        </Text>
                        <Text size="xs">{act.title}</Text>
                        {act.details ? (
                          <Text size="xs" muted>
                            ({act.details})
                          </Text>
                        ) : null}
                      </Row>
                      <Text size="xs" muted>
                        {formatTimestamp(act.timestamp)}
                      </Text>
                    </Row>
                  )
                })}
              </Stack>
            )}
          </Stack>
        </Tab>
      </Tabs>
    </Stack>
  )
}
