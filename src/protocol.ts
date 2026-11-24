// The panel <-> worker contract, declared once: src/panel.tsx and worker/main.mjs both read it.
export {}

export interface AntigravityAccount {
  /** Unique account slug/identifier (e.g. 'work', 'personal'). */
  id: string
  /** Human-readable display label. */
  name: string
  /** Optional email associated with the account. */
  email?: string
  /** Optional account notes or description. */
  description?: string
  /** Dedicated directory used as HOME for full isolation. */
  home: string
  /** Dedicated directory used as GEMINI_HOME for agy config & auth isolation. */
  geminiHome: string
  /** Configured CLI options/flags (e.g. ['--dangerously-skip-permissions']). */
  flags?: string[]
  /** Custom dynamic CLI flags string (e.g. '--model gemini-2.5-pro --sandbox'). */
  customFlags?: string
  /** Persona role name (e.g. 'Senior Fullstack Developer', 'Security Auditor'). */
  personaName?: string
  /** Markdown instructions defining the persona's role, system rules, and guidelines. */
  personaInstructions?: string
  /** Whether to link global host skills (~/.gemini/skills) into this account. Defaults to true. */
  shareGlobalSkills?: boolean
  /** Timestamp when account was added. */
  createdAt: number
}

export interface WorkspaceSummary {
  id: string
  name: string
  branch?: string | null
  path: string
  projectId?: string | null
}

export type AgileTaskStatus = 'todo' | 'in-progress' | 'in-review' | 'completed'

export interface AgileBoardLane {
  id: AgileTaskStatus
  label: string
  color: string
  icon: string
}

export interface AgileSprint {
  id: string
  name: string
  goal?: string
  status: 'active' | 'planning' | 'completed'
  startDate?: string
  endDate?: string
  targetPoints?: number
}

export interface AgileEpic {
  id: string
  name: string
  description?: string
  color?: string
  targetSprintId?: string
  status?: 'planned' | 'in-progress' | 'completed'
}

export interface AgileWorkItem {
  id: string
  title: string
  description?: string
  epicId: string
  sprintId: string
  status: AgileTaskStatus
  assignedAccountId?: string
  assignedPersona?: string
  workspaceId?: string
  storyPoints?: number
  updatedAt: number
}

export type WorkflowExecutionMode = 'auto-agents' | 'orca-bots'

export type WorkflowGoalType = 'none' | 'sprint' | 'epic' | 'workitem'

export interface OrcaBotSummary {
  id: string
  name: string
  agent: string
  specialty?: string | null
  homeDir: string
}

export interface WorkflowGoalTarget {
  type: WorkflowGoalType
  id?: string
  customGoal?: string
}

export interface WorkflowStep {
  id: string
  name: string
  accountId: string
  prompt: string
  customFlags?: string
  role?: string
  statusLane?: AgileTaskStatus
  /** Optional Orca Bot name mapped to this step for Semi-Auto Bot mode. */
  botName?: string
}

export interface ProjectWorkflow {
  id: string
  name: string
  description?: string
  projectId?: string
  workspaceId?: string
  sprintId?: string
  epicId?: string
  executionMode?: WorkflowExecutionMode
  goalTarget?: WorkflowGoalTarget
  steps: WorkflowStep[]
}

export interface AccountActivityEvent {
  id: string
  accountId: string
  accountName: string
  timestamp: number
  type: 'summon' | 'workflow' | 'task'
  title: string
  details?: string
  workspaceId?: string
}

export interface AccountUsageStats {
  accountId: string
  accountName: string
  personaName?: string
  totalSummons: number
  workflowStepsExecuted: number
  workItemsCompleted: number
  workItemsActive: number
  totalStoryPointsCompleted: number
  lastActiveAt: number | null
  diskUsageBytes: number
  diskUsageFormatted: string
  sessionCount: number
}

export interface TotalUsageOverview {
  totalSummonsAll: number
  totalWorkflowStepsAll: number
  totalWorkItemsCompletedAll: number
  totalStoryPointsAll: number
  totalDiskUsageBytes: number
  totalDiskUsageFormatted: string
  mostActiveAccountName: string | null
}

export interface AccountQuotaBucket {
  id: string
  name: string
  window: string
  remainingPercent: number
  usedPercent: number
  remainingFraction: number
  resetTime?: string
  description?: string
}

export interface AccountQuotaGroup {
  name: string
  description?: string
  buckets: AccountQuotaBucket[]
}

export interface AccountQuotaInfo {
  accountId: string
  status: 'ok' | 'needs-login' | 'fetching' | 'error'
  updatedAt: number
  error?: string
  groups: AccountQuotaGroup[]
  geminiWeeklyRemaining?: number | null
  gemini5hRemaining?: number | null
  thirdPartyWeeklyRemaining?: number | null
  thirdParty5hRemaining?: number | null
}

declare module 'orca' {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
  interface PluginRequests {
    /** Get all accounts and the currently active account ID. */
    'accounts.list': {
      input: void | Record<string, never>
      output: {
        accounts: AntigravityAccount[]
        activeId: string | null
      }
    }

    /** Add or update an Antigravity account with isolated environments and persona. */
    'accounts.add': {
      input: {
        id?: string
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
      }
      output: {
        account: AntigravityAccount
        accounts: AntigravityAccount[]
        activeId: string | null
      }
    }

    /** Remove an account by its ID. */
    'accounts.remove': {
      input: {
        id: string
      }
      output: {
        removedId: string
        accounts: AntigravityAccount[]
        activeId: string | null
      }
    }

    /** Set the active account without summoning. */
    'accounts.setActive': {
      input: {
        id: string
      }
      output: {
        activeId: string | null
      }
    }

    /** Get available workspaces for terminal creation. */
    'accounts.getWorkspaces': {
      input: void | Record<string, never>
      output: {
        workspaces: WorkspaceSummary[]
        activeWorkspaceId: string | null
        focusedWorkspaceName?: string | null
        focusedBranch?: string | null
        focusedContext?: {
          workspaceId?: string
          branch?: string
          displayName?: string
          terminals?: { id: string; title?: string }[]
        } | null
      }
    }

    /**
     * Launch an interactive terminal to log in to Google Antigravity for a specific account.
     */
    'accounts.login': {
      input: {
        accountId: string
        workspaceId?: string
      }
      output: {
        terminalId: string
        accountName: string
      }
    }

    /**
     * Summon agy in a workspace terminal with isolated GEMINI_HOME, HOME, flags, and prompt.
     */
    'accounts.summon': {
      input: {
        accountId?: string
        workspaceId?: string
        prompt?: string
        flags?: string[]
        customFlags?: string
      }
      output: {
        terminalId: string
        workspaceId: string
        accountId: string
        accountName: string
        command: string
      }
    }

    /** Get workflows configured for projects/workspaces. */
    'workflows.list': {
      input: {
        workspaceId?: string
        projectId?: string
      }
      output: {
        workflows: ProjectWorkflow[]
      }
    }

    /** Save or update a project workflow. */
    'workflows.save': {
      input: {
        workflow: ProjectWorkflow
      }
      output: {
        workflow: ProjectWorkflow
        workflows: ProjectWorkflow[]
      }
    }

    /** Delete a project workflow. */
    'workflows.delete': {
      input: {
        id: string
        workspaceId?: string
      }
      output: {
        ok: boolean
        workflows: ProjectWorkflow[]
      }
    }

    /** Discover local Orca Bots configured in ~/.orca/bots. */
    'bots.list': {
      input: void | Record<string, never>
      output: {
        bots: OrcaBotSummary[]
        botsDir: string
      }
    }

    /** Execute all agent steps in a workflow in 100% Auto Agents mode or Semi-Auto Orca Bots mode. */
    'workflows.execute': {
      input: {
        workflowId: string
        workspaceId?: string
        mode?: WorkflowExecutionMode
        goalType?: WorkflowGoalType
        goalId?: string
        customGoal?: string
      }
      output: {
        ok: boolean
        message: string
        startedSteps: number
        mode: WorkflowExecutionMode
        dispatchedBots?: string[]
        missingBots?: string[]
        coordinationDir?: string
      }
    }

    /** Sync live terminal agent states and queued agent status updates onto Agile Board lanes */
    'board.syncFromAgents': {
      input: {
        workspaceId?: string
      } | void
      output: {
        syncedCount: number
        changes: { itemId: string; title: string; from: AgileTaskStatus; to: AgileTaskStatus; reason: string }[]
        workItems: AgileWorkItem[]
      }
    }

    /** Open Orca native Workspace Kanban Board */
    'board.openNative': {
      input: void | Record<string, never>
      output: {
        opened: boolean
      }
    }

    /** Get Agile state (sprints, epics, work items, and board lanes) */
    'board.getAgileState': {
      input: {
        workspaceId?: string
      } | void
      output: {
        sprints: AgileSprint[]
        epics: AgileEpic[]
        workItems: AgileWorkItem[]
        lanes: AgileBoardLane[]
      }
    }

    /** Save or update an Agile Work Item */
    'board.saveWorkItem': {
      input: {
        item: AgileWorkItem
      }
      output: {
        item: AgileWorkItem
        workItems: AgileWorkItem[]
      }
    }

    /** Update status lane of an Agile Work Item */
    'board.updateItemStatus': {
      input: {
        itemId: string
        status: AgileTaskStatus
      }
      output: {
        itemId: string
        status: AgileTaskStatus
        workItems: AgileWorkItem[]
      }
    }

    /** Delete an Agile Work Item */
    'board.deleteWorkItem': {
      input: {
        itemId: string
      }
      output: {
        ok: boolean
        workItems: AgileWorkItem[]
      }
    }

    /** Summon an agent dedicated to an Agile Work Item */
    'board.summonWorkItem': {
      input: {
        itemId: string
        workspaceId?: string
      }
      output: {
        terminalId: string
        itemTitle: string
        accountName: string
      }
    }

    /** Save or update an Agile Sprint */
    'board.saveSprint': {
      input: {
        sprint: AgileSprint
      }
      output: {
        sprint: AgileSprint
        sprints: AgileSprint[]
      }
    }

    /** Complete an active sprint and roll over pending tasks */
    'board.completeSprint': {
      input: {
        sprintId: string
        rolloverToSprintId?: string
      }
      output: {
        ok: boolean
        sprints: AgileSprint[]
        workItems: AgileWorkItem[]
      }
    }

    /** Delete an Agile Sprint and optionally move its work items to another sprint */
    'board.deleteSprint': {
      input: {
        sprintId: string
        moveToSprintId?: string
      }
      output: {
        ok: boolean
        deletedSprintId: string
        sprints: AgileSprint[]
        workItems: AgileWorkItem[]
        epics: AgileEpic[]
      }
    }

    /** Save or update an Agile Epic (Roadmap) */
    'board.saveEpic': {
      input: {
        epic: AgileEpic
      }
      output: {
        epic: AgileEpic
        epics: AgileEpic[]
      }
    }

    /** Delete an Agile Epic from Roadmap */
    'board.deleteEpic': {
      input: {
        epicId: string
      }
      output: {
        ok: boolean
        epics: AgileEpic[]
      }
    }

    /** Get feature usage monitoring stats for all or a specific account */
    'usage.getStats': {
      input: {
        accountId?: string
      } | void
      output: {
        stats: Record<string, AccountUsageStats>
        overview: TotalUsageOverview
        recentActivities: AccountActivityEvent[]
      }
    }

    /** Clear usage statistics/activity history */
    'usage.clearHistory': {
      input: {
        accountId?: string
      } | void
      output: {
        ok: boolean
        stats: Record<string, AccountUsageStats>
        overview: TotalUsageOverview
        recentActivities: AccountActivityEvent[]
      }
    }

    /** Get real-time quota and remaining token limits for accounts. */
    'quota.getAccountQuota': {
      input: {
        accountId?: string
        forceRefresh?: boolean
      } | void
      output: {
        quotas: Record<string, AccountQuotaInfo>
      }
    }
  }

  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
  interface PluginPanelEvents {
    /** Posted whenever accounts or the active account changes. */
    'accounts.changed': {
      accounts: AntigravityAccount[]
      activeId: string | null
    }

    /** Posted when agy is summoned successfully. */
    'accounts.summoned': {
      terminalId: string
      accountId: string
      accountName: string
    }

    /** Posted when project workflows are updated. */
    'workflows.changed': {
      workflows: ProjectWorkflow[]
    }

    /** Posted when agile board items or sprints change. */
    'board.changed': {
      sprints: AgileSprint[]
      epics: AgileEpic[]
      workItems: AgileWorkItem[]
      lanes: AgileBoardLane[]
    }

    /** Posted when account usage metrics or activity events change. */
    'usage.changed': {
      stats: Record<string, AccountUsageStats>
      overview: TotalUsageOverview
      recentActivities: AccountActivityEvent[]
    }

    /** Posted when account quota information is updated. */
    'quota.changed': {
      quotas: Record<string, AccountQuotaInfo>
    }

    /** Posted when the active focused workspace changes in Orca. */
    'workspace.changed': {
      context: {
        workspaceId?: string
        branch?: string
        displayName?: string
        terminals?: { id: string; title?: string }[]
      } | null
      activeWorkspaceId: string | null
      workspaces: WorkspaceSummary[]
    }
  }
}
