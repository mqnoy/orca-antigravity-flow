// Antigravity Flow - Plugin Worker
// Handles isolated account storage, environment resolution, and summoning agy with GEMINI_HOME and HOME.
// Includes agile startup workflows, sprints, epics, and Orca Workspace Board integration.

import { execFile } from 'node:child_process'
import { lstat, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const STORAGE_KEY_ACCOUNTS = 'accounts'
const STORAGE_KEY_ACTIVE = 'active_account_id'
const STORAGE_KEY_WORKFLOWS = 'project_workflows'
const STORAGE_KEY_SPRINTS = 'agile_sprints'
const STORAGE_KEY_EPICS = 'agile_epics'
const STORAGE_KEY_WORKITEMS = 'agile_workitems'
const STORAGE_KEY_USAGE = 'account_usage_metrics'
const STORAGE_KEY_ACTIVITIES = 'account_recent_activities'

const DEFAULT_BASE_DIR = '~/.gemini-accounts'
const DEFAULT_AGY_CMD = 'agy'

const ORCA_DEFAULT_BOARD_LANES = [
  { id: 'todo', label: 'Todo', color: 'neutral', icon: 'circle' },
  {
    id: 'in-progress',
    label: 'In progress',
    color: 'conductor-progress',
    icon: 'conductor-progress'
  },
  { id: 'in-review', label: 'In review', color: 'conductor-review', icon: 'conductor-review' },
  { id: 'completed', label: 'Done', color: 'conductor-done', icon: 'conductor-done' }
]

const GLOBAL_SKILL_PATHS = [['skills'], ['config', 'skills'], ['antigravity-cli', 'skills']]

/**
 * Links global host skills (~/.gemini/skills) into an account's isolated GEMINI_HOME
 * so all accounts have access to global tools, MCP servers, and custom skills.
 * @param {string} geminiHome
 */
async function linkGlobalSkillsToAccount(geminiHome) {
  const userGemini = join(homedir(), '.gemini')
  const isWin = process.platform === 'win32'

  for (const segments of GLOBAL_SKILL_PATHS) {
    const target = join(userGemini, ...segments)
    const link = join(geminiHome, ...segments)

    try {
      const targetStat = await stat(target).catch(() => null)
      if (!targetStat || !targetStat.isDirectory()) {
        continue
      }

      await mkdir(dirname(link), { recursive: true })

      const linkStat = await lstat(link).catch(() => null)
      if (linkStat?.isSymbolicLink()) {
        continue
      }
      if (linkStat?.isDirectory()) {
        continue
      }

      await symlink(target, link, isWin ? 'junction' : 'dir').catch(() => null)
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Expands leading tilde to user's home directory and resolves to absolute path.
 * @param {string} pathString
 * @returns {string}
 */
function resolvePath(pathString) {
  if (!pathString || typeof pathString !== 'string') {
    return ''
  }
  const trimmed = pathString.trim()
  if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return resolve(join(homedir(), trimmed.slice(1)))
  }
  return resolve(trimmed)
}

/**
 * Sanitizes an account name into a valid kebab-case identifier.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  )
}

/**
 * Recursively computes directory size in bytes without following symlinks.
 * @param {string} dirPath
 * @returns {Promise<number>}
 */
async function getDirectorySize(dirPath) {
  let total = 0
  try {
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue // Skip symlinks (e.g. global host skills link)
      }
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await getDirectorySize(fullPath)
      } else if (entry.isFile()) {
        const s = await stat(fullPath).catch(() => null)
        if (s) total += s.size
      }
    }
  } catch {
    // Non-fatal if directory does not exist or permission denied
  }
  return total
}

/**
 * Counts saved conversations/sessions in an account's brain directory.
 * @param {string} geminiHome
 * @returns {Promise<number>}
 */
async function countAccountSessions(geminiHome) {
  let count = 0
  try {
    const brainDir = join(geminiHome, 'brain')
    const entries = await readdir(brainDir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        count++
      }
    }
  } catch {}
  return count
}

/**
 * Formats byte size into human readable string (B, KB, MB, GB).
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * Recursively cleans any object/array so it is 100% strictly valid JSON without undefined keys.
 * Required because Orca storage and panel handlers validate outputs against z.json().
 * @template T
 * @param {T} val
 * @returns {T}
 */
function cleanJson(val) {
  if (val === undefined || val === null) return null
  return JSON.parse(JSON.stringify(val))
}

/**
 * Clamps a terminal title to Orca host's 512-character limit.
 * @param {string} title
 * @returns {string}
 */
function clampTerminalTitle(title) {
  return title.length > 512 ? `${title.slice(0, 509)}...` : title
}

/**
 * Escapes a command argument or environment variable for shell execution.
 * @param {string} value
 * @param {boolean} isWin
 * @returns {string}
 */
function escapeShellArg(value, isWin) {
  if (isWin) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Builds the shell command string to execute agy with isolated GEMINI_HOME, HOME, flags, and prompt.
 * @param {object} params
 * @param {string} params.home
 * @param {string} params.geminiHome
 * @param {string} params.agyCmd
 * @param {string[]} [params.flags]
 * @param {string} [params.customFlags]
 * @param {string} [params.prompt]
 * @param {string} [params.promptFile]
 * @returns {string}
 */
function buildAgyCommand({ home, geminiHome, agyCmd, flags, customFlags, prompt, promptFile }) {
  const isWin = process.platform === 'win32'
  const flagList = []

  if (Array.isArray(flags)) {
    for (const f of flags) {
      if (typeof f === 'string' && f.trim() && !flagList.includes(f.trim())) {
        flagList.push(f.trim())
      }
    }
  }

  if (typeof customFlags === 'string' && customFlags.trim()) {
    flagList.push(customFlags.trim())
  }

  const flagsPart = flagList.length > 0 ? ` ${flagList.join(' ')}` : ''

  const hasPromptFlag = flagList.some(
    (f) =>
      f === '-i' ||
      f === '--prompt-interactive' ||
      f.startsWith('-i=') ||
      f.startsWith('--prompt-interactive=') ||
      f === '-p' ||
      f === '--print' ||
      f === '--prompt' ||
      f.startsWith('-p=') ||
      f.startsWith('--print=') ||
      f.startsWith('--prompt=')
  )

  let promptPart = ''
  if (promptFile && typeof promptFile === 'string') {
    if (isWin) {
      promptPart =
        prompt && prompt.trim()
          ? ` ${hasPromptFlag ? '' : '-i '}${escapeShellArg(prompt.trim(), true)}`
          : ` < ${escapeShellArg(promptFile, true)}`
    } else {
      promptPart = ` ${hasPromptFlag ? '' : '-i '}"$(cat ${escapeShellArg(promptFile, false)})"`
    }
  } else if (prompt && prompt.trim()) {
    promptPart = ` ${hasPromptFlag ? '' : '-i '}${escapeShellArg(prompt.trim(), isWin)}`
  }

  if (isWin) {
    return `set "HOME=${home}" && set "GEMINI_HOME=${geminiHome}" && set "DBUS_SESSION_BUS_ADDRESS=" && set "SSH_CONNECTION=127.0.0.1" && ${agyCmd}${flagsPart}${promptPart}`
  }

  const safeHome = escapeShellArg(home, false)
  const safeGemini = escapeShellArg(geminiHome, false)
  return `env HOME=${safeHome} GEMINI_HOME=${safeGemini} DBUS_SESSION_BUS_ADDRESS="" SSH_CONNECTION="127.0.0.1" ${agyCmd}${flagsPart}${promptPart}`
}

/** @type {import('orca/worker').Activate} */
export default async function activate(orca) {
  /**
   * Safe storage.set wrapper ensuring JSON-safe values without undefined keys.
   * @param {string} key
   * @param {unknown} value
   */
  async function storageSet(key, value) {
    return await orca.storage.set(key, cleanJson(value))
  }

  orca.log('Antigravity Flow worker activating...')

  /**
   * Tracks the currently focused workspace context.
   * @type {{ workspaceId?: string, branch?: string, displayName?: string, terminals?: any[] } | null}
   */
  let currentActiveWorkspaceContext = null

  // Fetch initial active workspace context if available
  try {
    const initialCtx = await orca.host.call('workspace.readContext', {})
    if (initialCtx) {
      currentActiveWorkspaceContext = initialCtx
    }
  } catch (err) {
    orca.log(`Notice: initial workspace.readContext: ${err.message}`)
  }

  // Listen to workspace.changed event from Orca host
  if (orca.events && typeof orca.events.on === 'function') {
    try {
      orca.events.on('workspace.changed', async (payload) => {
        try {
          currentActiveWorkspaceContext = payload?.context ?? null
          const wsRes = await orca.host.call('workspace.list', {}).catch(() => ({ workspaces: [] }))
          const workspaces = (wsRes?.workspaces || []).map((w) => ({
            id: w.id,
            name: w.name,
            branch: w.branch ?? null,
            path: w.path,
            projectId: w.projectId ?? null
          }))

          let activeWorkspaceId = payload?.context?.workspaceId ?? null
          if (!activeWorkspaceId && payload?.context?.displayName) {
            const match = workspaces.find((w) => w.name === payload.context.displayName)
            if (match) activeWorkspaceId = match.id
          }
          if (!activeWorkspaceId && workspaces.length > 0) {
            activeWorkspaceId = workspaces[0].id
          }

          orca.panels.post('workspace.changed', {
            context: payload?.context ?? null,
            activeWorkspaceId,
            workspaces
          })
        } catch (err) {
          orca.log(`Notice: workspace.changed event handling error: ${err.message}`)
        }
      })
    } catch (err) {
      orca.log(`Notice: subscribing to workspace.changed: ${err.message}`)
    }
  }

  /**
   * Resolves the target workspace ID, prioritizing explicit selection,
   * then live focused workspace context, then cached context, then workspace.list.
   * @param {string | undefined | null} explicitWorkspaceId
   * @returns {Promise<string | null>}
   */
  async function resolveTargetWorkspace(explicitWorkspaceId) {
    if (explicitWorkspaceId && explicitWorkspaceId !== 'active') {
      return explicitWorkspaceId
    }

    // 1. Query live active workspace context directly from host
    try {
      const ctx = await orca.host.call('workspace.readContext', {})
      if (ctx) {
        currentActiveWorkspaceContext = ctx
        if (ctx.workspaceId) {
          return ctx.workspaceId
        }
        if (ctx.displayName) {
          const wsRes = await orca.host.call('workspace.list', {})
          const match = (wsRes?.workspaces || []).find((w) => w.name === ctx.displayName)
          if (match) return match.id
        }
      }
    } catch (err) {
      orca.log(`Notice: workspace.readContext failed during resolution: ${err.message}`)
    }

    // 2. Check cached context
    if (currentActiveWorkspaceContext?.workspaceId) {
      return currentActiveWorkspaceContext.workspaceId
    }

    // 3. Fallback to workspace.list first workspace
    try {
      const wsRes = await orca.host.call('workspace.list', {})
      return wsRes?.workspaces?.[0]?.id ?? null
    } catch {
      return null
    }
  }

  /**
   * Retrieves configured accounts from storage.
   * @returns {Promise<import('../src/protocol').AntigravityAccount[]>}
   */
  async function getStoredAccounts() {
    const raw = await orca.storage.get(STORAGE_KEY_ACCOUNTS)
    return Array.isArray(raw) ? raw : []
  }

  /**
   * Retrieves active account id from storage.
   * @returns {Promise<string | null>}
   */
  async function getActiveAccountId() {
    const active = await orca.storage.get(STORAGE_KEY_ACTIVE)
    return typeof active === 'string' && active.length > 0 ? active : null
  }

  /**
   * Retrieves stored project workflows.
   * @returns {Promise<import('../src/protocol').ProjectWorkflow[]>}
   */
  async function getStoredWorkflows() {
    const raw = await orca.storage.get(STORAGE_KEY_WORKFLOWS)
    return Array.isArray(raw) ? raw : []
  }

  /**
   * Retrieves stored Agile sprints.
   * @returns {Promise<import('../src/protocol').AgileSprint[]>}
   */
  async function getStoredSprints() {
    const raw = await orca.storage.get(STORAGE_KEY_SPRINTS)
    return Array.isArray(raw) ? raw : []
  }

  /**
   * Retrieves stored Agile epics.
   * @returns {Promise<import('../src/protocol').AgileEpic[]>}
   */
  async function getStoredEpics() {
    const raw = await orca.storage.get(STORAGE_KEY_EPICS)
    return Array.isArray(raw) ? raw : []
  }

  /**
   * Retrieves stored Agile work items.
   * @returns {Promise<import('../src/protocol').AgileWorkItem[]>}
   */
  async function getStoredWorkItems() {
    const raw = await orca.storage.get(STORAGE_KEY_WORKITEMS)
    return Array.isArray(raw) ? raw : []
  }

  /**
   * Retrieves stored usage metrics per account.
   * @returns {Promise<Record<string, { totalSummons: number, workflowStepsExecuted: number, lastActiveAt: number | null }>>}
   */
  async function getStoredUsageMetrics() {
    const raw = await orca.storage.get(STORAGE_KEY_USAGE)
    return raw && typeof raw === 'object' ? raw : {}
  }

  /**
   * Retrieves stored recent account activity events.
   * @returns {Promise<import('../src/protocol').AccountActivityEvent[]>}
   */
  async function getStoredActivities() {
    const raw = await orca.storage.get(STORAGE_KEY_ACTIVITIES)
    return Array.isArray(raw) ? raw : []
  }

  /**
   * Records an account activity event and updates usage counters.
   * @param {{
   *   accountId: string
   *   type: 'summon' | 'workflow' | 'task'
   *   title: string
   *   details?: string
   *   workspaceId?: string
   * }} params
   */
  async function recordAccountActivity({ accountId, type, title, details, workspaceId }) {
    try {
      const accounts = await getStoredAccounts()
      const account = accounts.find((a) => a.id === accountId)
      const accountName = account ? account.name : accountId

      const metrics = await getStoredUsageMetrics()
      const cur = metrics[accountId] || {
        totalSummons: 0,
        workflowStepsExecuted: 0,
        lastActiveAt: null
      }

      if (type === 'summon' || type === 'task') {
        cur.totalSummons = (cur.totalSummons || 0) + 1
      } else if (type === 'workflow') {
        cur.workflowStepsExecuted = (cur.workflowStepsExecuted || 0) + 1
      }
      cur.lastActiveAt = Date.now()
      metrics[accountId] = cur
      await storageSet(STORAGE_KEY_USAGE, metrics)

      const activities = await getStoredActivities()
      const event = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId,
        accountName,
        timestamp: Date.now(),
        type,
        title,
        ...(details ? { details } : {}),
        ...(workspaceId ? { workspaceId } : {})
      }

      const updatedActivities = [event, ...activities].slice(0, 100)
      await storageSet(STORAGE_KEY_ACTIVITIES, updatedActivities)

      // Post asynchronous change event to panel
      const full = await computeFullUsageStats()
      orca.panels.post('usage.changed', {
        stats: full.stats,
        overview: full.overview,
        recentActivities: updatedActivities
      })
    } catch (err) {
      orca.log(`Failed to record account activity: ${err.message}`)
    }
  }

  /**
   * Computes aggregated usage statistics and per-account breakdown.
   * @returns {Promise<{
   *   stats: Record<string, import('../src/protocol').AccountUsageStats>
   *   overview: import('../src/protocol').TotalUsageOverview
   * }>}
   */
  async function computeFullUsageStats() {
    const accounts = await getStoredAccounts()
    const metrics = await getStoredUsageMetrics()
    const workItems = await getStoredWorkItems()

    let totalSummonsAll = 0
    let totalWorkflowStepsAll = 0
    let totalWorkItemsCompletedAll = 0
    let totalStoryPointsAll = 0
    let totalDiskBytesAll = 0
    let maxActivityScore = -1
    let mostActiveAccountName = null

    /** @type {Record<string, import('../src/protocol').AccountUsageStats>} */
    const stats = {}

    for (const account of accounts) {
      const raw = metrics[account.id] || {
        totalSummons: 0,
        workflowStepsExecuted: 0,
        lastActiveAt: null
      }

      // Filter work items assigned to this account
      const accTasks = workItems.filter(
        (i) =>
          i.assignedAccountId === account.id ||
          (account.personaName && i.assignedPersona === account.personaName)
      )
      const completedTasks = accTasks.filter((i) => i.status === 'completed')
      const activeTasks = accTasks.filter((i) => i.status !== 'completed')
      const storyPoints = completedTasks.reduce((acc, i) => acc + (i.storyPoints || 0), 0)

      // Compute isolated disk footprint (excluding symlinks)
      const baseAccountDir = dirname(account.home)
      const diskBytes = await getDirectorySize(baseAccountDir)
      const sessionCount = await countAccountSessions(account.geminiHome)

      const summons = raw.totalSummons || 0
      const workflowSteps = raw.workflowStepsExecuted || 0
      const score = summons * 2 + workflowSteps * 3 + completedTasks.length * 5

      if (score > maxActivityScore && score > 0) {
        maxActivityScore = score
        mostActiveAccountName = account.name
      }

      totalSummonsAll += summons
      totalWorkflowStepsAll += workflowSteps
      totalWorkItemsCompletedAll += completedTasks.length
      totalStoryPointsAll += storyPoints
      totalDiskBytesAll += diskBytes

      stats[account.id] = {
        accountId: account.id,
        accountName: account.name,
        ...(account.personaName ? { personaName: account.personaName } : {}),
        totalSummons: summons,
        workflowStepsExecuted: workflowSteps,
        workItemsCompleted: completedTasks.length,
        workItemsActive: activeTasks.length,
        totalStoryPointsCompleted: storyPoints,
        lastActiveAt: raw.lastActiveAt || null,
        diskUsageBytes: diskBytes,
        diskUsageFormatted: formatBytes(diskBytes),
        sessionCount
      }
    }

    /** @type {import('../src/protocol').TotalUsageOverview} */
    const overview = {
      totalSummonsAll,
      totalWorkflowStepsAll,
      totalWorkItemsCompletedAll,
      totalStoryPointsAll,
      totalDiskUsageBytes: totalDiskBytesAll,
      totalDiskUsageFormatted: formatBytes(totalDiskBytesAll),
      mostActiveAccountName: mostActiveAccountName || (accounts[0] ? accounts[0].name : 'None')
    }

    return { stats, overview }
  }

  /**
   * Resolves the configured base directory for accounts.
   * @returns {Promise<string>}
   */
  async function getAccountsBaseDirectory() {
    try {
      const setting = await orca.settings?.get?.('accountsBaseDir')
      const rawBase =
        typeof setting === 'string' && setting.trim() ? setting.trim() : DEFAULT_BASE_DIR
      return resolvePath(rawBase)
    } catch {
      return resolvePath(DEFAULT_BASE_DIR)
    }
  }

  /**
   * Resolves the configured agy executable command.
   * @returns {Promise<string>}
   */
  async function getAgyExecutable() {
    try {
      const setting = await orca.settings?.get?.('agyCommand')
      return typeof setting === 'string' && setting.trim() ? setting.trim() : DEFAULT_AGY_CMD
    } catch {
      return DEFAULT_AGY_CMD
    }
  }

  const quotaCache = new Map()

  /**
   * Checks whether an account has authenticated Google credentials in its isolated environment.
   * @param {import('../src/protocol').AntigravityAccount} account
   * @returns {Promise<{ loggedIn: boolean, email: string | null }>}
   */
  async function checkAccountAuthStatus(account) {
    const isHostDefault =
      account.id === 'default' &&
      (account.home === process.env.HOME ||
        account.geminiHome === join(process.env.HOME || '', '.gemini'))

    const candidateFiles = [
      // Primary Antigravity CLI OAuth token files (current official format)
      join(account.home, '.gemini', 'antigravity-cli', 'antigravity-oauth-token'),
      join(account.geminiHome, 'antigravity-cli', 'antigravity-oauth-token'),
      join(account.home, '.gemini', 'antigravity-oauth-token'),
      join(account.geminiHome, 'antigravity-oauth-token'),
      join(account.home, '.config', 'antigravity', 'credential-user-scope'),
      // Legacy or alternative OAuth files
      join(account.geminiHome, 'oauth_creds.json'),
      join(account.home, '.gemini', 'oauth_creds.json'),
      join(account.geminiHome, 'google_accounts.json'),
      join(account.home, '.gemini', 'google_accounts.json'),
      join(account.geminiHome, 'antigravity-cli', 'oauth_creds.json'),
      join(account.home, '.gemini', 'antigravity-cli', 'oauth_creds.json')
    ]

    for (const f of candidateFiles) {
      try {
        const raw = await readFile(f, 'utf8')
        try {
          const data = JSON.parse(raw)
          if (
            data.token ||
            data.access_token ||
            data.refresh_token ||
            data.id_token_email ||
            (typeof data.active === 'string' && data.active.trim())
          ) {
            return {
              loggedIn: true,
              email: data.id_token_email || data.active || data.email || null
            }
          }
        } catch {
          // Plain text credential files
          if (raw && raw.trim().length > 0) {
            return {
              loggedIn: true,
              email: raw.trim().includes('@') ? raw.trim() : null
            }
          }
        }
      } catch {}
    }

    if (isHostDefault) {
      const hostCreds = [
        join(process.env.HOME || '', '.gemini', 'antigravity-cli', 'antigravity-oauth-token'),
        join(process.env.HOME || '', '.gemini', 'oauth_creds.json')
      ]
      for (const hostCred of hostCreds) {
        try {
          const raw = await readFile(hostCred, 'utf8')
          const data = JSON.parse(raw)
          if (data.token || data.access_token || data.refresh_token || data.id_token_email) {
            return { loggedIn: true, email: data.id_token_email || data.email || null }
          }
        } catch {}
      }
    }

    return { loggedIn: false, email: null }
  }

  /**
   * Fetches real-time quota and remaining token limits for an Antigravity account using agy -p /usage.
   * @param {import('../src/protocol').AntigravityAccount} account
   * @param {boolean} forceRefresh
   * @returns {Promise<import('../src/protocol').AccountQuotaInfo>}
   */
  async function fetchAccountQuota(account, forceRefresh = false) {
    if (forceRefresh) {
      quotaCache.delete(account.id)
    }
    const cached = quotaCache.get(account.id)
    if (!forceRefresh && cached && Date.now() - cached.updatedAt < 60000) {
      return cached
    }

    // Check if account is actually logged in before executing agy
    const authStatus = await checkAccountAuthStatus(account)
    if (!authStatus.loggedIn) {
      /** @type {import('../src/protocol').AccountQuotaInfo} */
      const notLoggedInResult = cleanJson({
        accountId: account.id,
        status: 'needs-login',
        updatedAt: Date.now(),
        error: 'Not logged in with Google. Click "Sign in" to authenticate this account.',
        groups: [],
        geminiWeeklyRemaining: null,
        gemini5hRemaining: null,
        thirdPartyWeeklyRemaining: null,
        thirdParty5hRemaining: null
      })
      quotaCache.set(account.id, notLoggedInResult)
      return notLoggedInResult
    }

    // Sync detected Google account email if not yet stored
    if (authStatus.email && account.email !== authStatus.email) {
      try {
        account.email = authStatus.email
        const allAccounts = await getStoredAccounts()
        const idx = allAccounts.findIndex((a) => a.id === account.id)
        if (idx >= 0) {
          allAccounts[idx] = { ...allAccounts[idx], email: authStatus.email }
          await storageSet(STORAGE_KEY_ACCOUNTS, allAccounts)
          orca.panels.post('accounts.changed', {
            accounts: allAccounts,
            activeId: await getActiveAccountId()
          })
        }
      } catch (err) {
        orca.log(`Notice: updating account email: ${err.message}`)
      }
    }

    try {
      await mkdir(account.home, { recursive: true })
      await mkdir(account.geminiHome, { recursive: true })

      const agyCmd = await getAgyExecutable()
      // Strictly isolate environment so agy does not fall back to the host keyring or host LS daemon
      const env = {
        ...process.env,
        HOME: account.home,
        GEMINI_HOME: account.geminiHome,
        AGY_CLI_DISABLE_AUTO_UPDATE: 'true',
        DBUS_SESSION_BUS_ADDRESS: 'unix:path=/dev/null'
      }
      delete env.ANTIGRAVITY_LS_ADDRESS
      delete env.ANTIGRAVITY_CSRF_TOKEN
      delete env.ANTIGRAVITY_APP_DATA_DIR
      delete env.ANTIGRAVITY_PROJECT_ID
      delete env.ANTIGRAVITY_AGENTAPI_EXE
      delete env.ANTIGRAVITY_TRAJECTORY_ID
      delete env.ANTIGRAVITY_CONVERSATION_ID

      const { stdout } = await execFileAsync(
        agyCmd,
        ['-p', '/usage', '--output-format', 'json', '--print-timeout', '15s'],
        {
          env,
          timeout: 20000,
          maxBuffer: 1024 * 1024
        }
      )

      let parsed = null
      try {
        parsed = JSON.parse(stdout)
      } catch {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0])
          } catch {}
        }
      }

      const usageData = parsed?.command?.data
      if (!usageData || !Array.isArray(usageData.groups)) {
        throw new Error(parsed?.response || 'Invalid quota response from agy')
      }

      /** @type {import('../src/protocol').AccountQuotaGroup[]} */
      const groups = usageData.groups.map((g) => ({
        name: String(g.name || 'Default'),
        description: g.description ? String(g.description) : null,
        buckets: (g.buckets || []).map((b) => {
          const remainingFraction =
            typeof b.remaining_fraction === 'number' ? b.remaining_fraction : 1
          const remainingPercent = Math.round(remainingFraction * 100)
          return {
            id: String(b.id || b.name || 'bucket'),
            name: String(b.name || 'Quota'),
            window: String(b.window || 'weekly'),
            remainingPercent,
            usedPercent: 100 - remainingPercent,
            remainingFraction,
            resetTime: b.reset_time ? String(b.reset_time) : null,
            description: b.description ? String(b.description) : null
          }
        })
      }))

      let geminiWeeklyRemaining = null
      let gemini5hRemaining = null
      let thirdPartyWeeklyRemaining = null
      let thirdParty5hRemaining = null

      for (const grp of groups) {
        const lowerName = grp.name.toLowerCase()
        if (lowerName.includes('gemini') && !lowerName.includes('argon')) {
          for (const b of grp.buckets) {
            if (b.window === 'weekly') geminiWeeklyRemaining = b.remainingPercent
            if (b.window === '5h') gemini5hRemaining = b.remainingPercent
          }
        } else if (lowerName.includes('claude') || lowerName.includes('gpt')) {
          for (const b of grp.buckets) {
            if (b.window === 'weekly') thirdPartyWeeklyRemaining = b.remainingPercent
            if (b.window === '5h') thirdParty5hRemaining = b.remainingPercent
          }
        }
      }

      /** @type {import('../src/protocol').AccountQuotaInfo} */
      const result = cleanJson({
        accountId: account.id,
        status: 'ok',
        updatedAt: Date.now(),
        groups,
        geminiWeeklyRemaining,
        gemini5hRemaining,
        thirdPartyWeeklyRemaining,
        thirdParty5hRemaining
      })

      quotaCache.set(account.id, result)
      return result
    } catch (err) {
      const isAuthErr = /auth|login|unauthorized|permission|required/i.test(err?.message || '')
      /** @type {import('../src/protocol').AccountQuotaInfo} */
      const errorResult = cleanJson({
        accountId: account.id,
        status: isAuthErr ? 'needs-login' : 'error',
        updatedAt: Date.now(),
        error: isAuthErr
          ? 'Not logged in with Google. Click "Sign in" to authenticate this account.'
          : String(err?.message || 'Failed to fetch quota from agy'),
        groups: [],
        geminiWeeklyRemaining: null,
        gemini5hRemaining: null,
        thirdPartyWeeklyRemaining: null,
        thirdParty5hRemaining: null
      })
      quotaCache.set(account.id, errorResult)
      return errorResult
    }
  }

  // --- SEED DEFAULTS FOR AGILE STARTUP ---
  const initialAccounts = await getStoredAccounts()
  if (initialAccounts.length === 0) {
    const baseDir = await getAccountsBaseDirectory()

    /** @type {import('../src/protocol').AntigravityAccount[]} */
    const seedAccounts = [
      {
        id: 'pm-scrum',
        name: 'Product Lead',
        description: 'Product Manager & Scrum Master for sprint planning & epics',
        home: join(baseDir, 'pm-scrum', 'home'),
        geminiHome: join(baseDir, 'pm-scrum', '.gemini'),
        flags: ['--dangerously-skip-permissions'],
        personaName: 'Product Manager & Scrum Lead',
        personaInstructions:
          '# Product Manager & Scrum Lead Persona\n' +
          '- Break down product requirements into user stories and acceptance criteria.\n' +
          '- Organize backlog items, define sprint scopes, and maintain epic milestones.\n' +
          '- Ensure features align directly with startup business value.',
        createdAt: Date.now()
      },
      {
        id: 'architect',
        name: 'Architect',
        description: 'Software Architect for technical design and contracts',
        home: join(baseDir, 'architect', 'home'),
        geminiHome: join(baseDir, 'architect', '.gemini'),
        flags: ['--dangerously-skip-permissions'],
        personaName: 'Software Architect & Planner',
        personaInstructions:
          '# Software Architect Persona\n' +
          '- Analyze requirements thoroughly and inspect existing codebase before writing code.\n' +
          '- Design scalable interfaces, API contracts, and implementation plans.\n' +
          '- Prioritize modularity and cross-platform resilience.',
        createdAt: Date.now()
      },
      {
        id: 'senior-fullstack',
        name: 'Dev Lead',
        description: 'Senior Fullstack Developer for rapid core implementation',
        home: join(baseDir, 'senior-fullstack', 'home'),
        geminiHome: join(baseDir, 'senior-fullstack', '.gemini'),
        flags: ['--dangerously-skip-permissions'],
        personaName: 'Senior Fullstack Developer',
        personaInstructions:
          '# Senior Fullstack Developer Persona\n' +
          '- Write clean, modular, and type-safe code following TDD.\n' +
          '- Implement end-to-end features efficiently with high reliability.\n' +
          '- Verify edge cases and validate changes before committing.',
        createdAt: Date.now()
      },
      {
        id: 'qa-reviewer',
        name: 'QA & Reviewer',
        description: 'Code Reviewer & Quality Engineer',
        home: join(baseDir, 'qa-reviewer', 'home'),
        geminiHome: join(baseDir, 'qa-reviewer', '.gemini'),
        flags: ['--dangerously-skip-permissions'],
        personaName: 'Code Reviewer & QA Engineer',
        personaInstructions:
          '# Code Reviewer & QA Engineer Persona\n' +
          '- Audit git diffs for potential regressions, bugs, and performance traps.\n' +
          '- Enforce project conventions and verify acceptance criteria.\n' +
          '- Provide clear, actionable feedback.',
        createdAt: Date.now()
      },
      {
        id: 'security-auditor',
        name: 'Security Lead',
        description: 'Security & Compliance Auditor',
        home: join(baseDir, 'security-auditor', 'home'),
        geminiHome: join(baseDir, 'security-auditor', '.gemini'),
        flags: ['--dangerously-skip-permissions'],
        personaName: 'Security Auditor',
        personaInstructions:
          '# Security Auditor Persona\n' +
          '- Audit permission models, input sanitization, and IPC boundaries.\n' +
          '- Detect vulnerabilities, token leakage, and unsafe shell interpolations.\n' +
          '- Enforce defense-in-depth principles.',
        createdAt: Date.now()
      }
    ]

    for (const acc of seedAccounts) {
      await mkdir(acc.home, { recursive: true }).catch(() => null)
      await mkdir(acc.geminiHome, { recursive: true }).catch(() => null)
      await linkGlobalSkillsToAccount(acc.geminiHome).catch(() => null)
    }

    await storageSet(STORAGE_KEY_ACCOUNTS, seedAccounts)
    await storageSet(STORAGE_KEY_ACTIVE, seedAccounts[2].id) // Default to Dev Lead
  }

  // Seed default Agile Sprints, Epics, Work Items, and Workflows
  const initialWorkflows = await getStoredWorkflows()
  if (initialWorkflows.length === 0) {
    /** @type {import('../src/protocol').ProjectWorkflow[]} */
    const defaultWorkflows = [
      {
        id: 'sprint-feature-delivery',
        name: 'Agile Sprint: Feature Epic Delivery',
        description:
          'Full startup sprint pipeline: Planning -> Architecture -> Fullstack Dev -> QA Review -> Security Audit.',
        steps: [
          {
            id: 'step-1',
            name: 'Sprint Planning & Epic Breakdown',
            accountId: 'pm-scrum',
            role: 'Product Manager & Scrum Lead',
            statusLane: 'todo',
            prompt:
              '## Sprint Planning & Epic Scope\n- Analyze user requirements and acceptance criteria.\n- Decompose the epic into concrete work items and update the Workspace Board.'
          },
          {
            id: 'step-2',
            name: 'Technical Architecture & Spec',
            accountId: 'architect',
            role: 'Software Architect & Planner',
            statusLane: 'todo',
            prompt:
              '## Technical Spec & Architecture\n- Inspect existing codebase architecture.\n- Design API contracts, data models, and component hierarchy.\n- Document technical design in docs/architecture/.'
          },
          {
            id: 'step-3',
            name: 'Core Feature Implementation & TDD',
            accountId: 'senior-fullstack',
            role: 'Senior Fullstack Developer',
            statusLane: 'in-progress',
            prompt:
              '## Implementation\n- Build the feature according to architectural spec.\n- Write modular, type-safe code with unit tests.\n- Verify all changes compile and pass test suites.'
          },
          {
            id: 'step-4',
            name: 'QA Acceptance & Edge Case Review',
            accountId: 'qa-reviewer',
            role: 'Code Reviewer & QA Engineer',
            statusLane: 'in-review',
            prompt:
              '## QA Review\n- Review git diff against user stories and acceptance criteria.\n- Test edge cases, performance boundaries, and error recovery.\n- Ensure no regressions.'
          },
          {
            id: 'step-5',
            name: 'Security & Permission Audit',
            accountId: 'security-auditor',
            role: 'Security Auditor',
            statusLane: 'completed',
            prompt:
              '## Security Audit\n- Review authorization, sanitization, and environment boundaries.\n- Verify credentials and secrets remain safe.\n- Sign off for production release.'
          }
        ]
      },
      {
        id: 'rapid-hotfix-sprint',
        name: 'Agile Hotfix: Rapid Bugfix & Patch',
        description:
          'Rapid turnaround hotfix for production defects: Reproduction -> Fix -> Release Verification.',
        steps: [
          {
            id: 'step-1',
            name: 'Bug Triage & Reproduction',
            accountId: 'qa-reviewer',
            role: 'Code Reviewer & QA Engineer',
            statusLane: 'in-progress',
            prompt:
              '## Bug Triage & Repro\n- Isolate failure, identify root cause, and create minimal failing test.'
          },
          {
            id: 'step-2',
            name: 'Surgical Patch Implementation',
            accountId: 'senior-fullstack',
            role: 'Senior Fullstack Developer',
            statusLane: 'in-progress',
            prompt:
              '## Patch Implementation\n- Apply minimal surgical fix.\n- Ensure failing test passes and no existing behaviors break.'
          },
          {
            id: 'step-3',
            name: 'Release Verification & Patch Approval',
            accountId: 'security-auditor',
            role: 'Security Auditor',
            statusLane: 'completed',
            prompt:
              '## Patch Release Verification\n- Verify hotfix safety, inspect permissions, and clear for deployment.'
          }
        ]
      },
      {
        id: 'tech-spike-sprint',
        name: 'Agile Spike: Architecture & Tech Evaluation',
        description:
          'Time-boxed technical spike to evaluate technologies and mitigate risk before sprint planning.',
        steps: [
          {
            id: 'step-1',
            name: 'Feasibility Spike & Benchmark',
            accountId: 'architect',
            role: 'Software Architect & Planner',
            statusLane: 'in-progress',
            prompt:
              '## Technical Spike\n- Prototype minimal proof-of-concept.\n- Benchmark performance, resource usage, and API ergonomics.'
          },
          {
            id: 'step-2',
            name: 'Codebase Viability & Story Point Estimation',
            accountId: 'senior-fullstack',
            role: 'Senior Fullstack Developer',
            statusLane: 'in-review',
            prompt:
              '## Spike Audit & Estimation\n- Review spike code and estimate implementation complexity and story points for next sprint.'
          }
        ]
      }
    ]
    await storageSet(STORAGE_KEY_WORKFLOWS, defaultWorkflows)
  }

  const rawSprints = await orca.storage.get(STORAGE_KEY_SPRINTS)
  if (!Array.isArray(rawSprints)) {
    /** @type {import('../src/protocol').AgileSprint[]} */
    const defaultSprints = [
      {
        id: 'sprint-1',
        name: 'Sprint 1: Core Foundation & MVP Launch',
        goal: 'Establish isolated multi-account agent workflows and sync with Orca Workspace Board.',
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10)
      },
      {
        id: 'sprint-2',
        name: 'Sprint 2: Growth & Advanced Team Autonomy',
        goal: 'Scale multi-agent team capabilities with automated testing and continuous integration.',
        status: 'planning'
      }
    ]
    await storageSet(STORAGE_KEY_SPRINTS, defaultSprints)
  }

  const initialEpics = await getStoredEpics()
  if (initialEpics.length === 0) {
    /** @type {import('../src/protocol').AgileEpic[]} */
    const defaultEpics = [
      {
        id: 'epic-101',
        name: '[EPIC-101] Core Agent Infrastructure & Multi-Tenancy',
        description:
          'Environment isolation, OAuth credential boundaries, and global skills linking.',
        color: '#3b82f6'
      },
      {
        id: 'epic-102',
        name: '[EPIC-102] Team Collaboration & Pipeline Execution',
        description: 'Multi-persona coordination and chained pipeline execution.',
        color: '#10b981'
      },
      {
        id: 'epic-103',
        name: '[EPIC-103] Workspace Board & Agile Kanban Integration',
        description:
          'Direct synchronization with Orca Workspace Board lanes (Todo, In Progress, In Review, Done).',
        color: '#8b5cf6'
      }
    ]
    await storageSet(STORAGE_KEY_EPICS, defaultEpics)
  }

  const initialWorkItems = await getStoredWorkItems()
  if (initialWorkItems.length === 0) {
    /** @type {import('../src/protocol').AgileWorkItem[]} */
    const defaultWorkItems = [
      {
        id: 'task-101',
        title: 'Isolate HOME and GEMINI_HOME Per Account',
        description: 'Prevent credential collisions and ensure headless OAuth tokens remain clean.',
        epicId: 'epic-101',
        sprintId: 'sprint-1',
        status: 'completed',
        assignedAccountId: 'architect',
        assignedPersona: 'Software Architect & Planner',
        storyPoints: 3,
        updatedAt: Date.now() - 3600000
      },
      {
        id: 'task-102',
        title: 'Implement Agile Startup Workflows & Chaining',
        description:
          'Coordinate PM, Architect, Fullstack, QA, and Security roles across sequential steps.',
        epicId: 'epic-102',
        sprintId: 'sprint-1',
        status: 'in-progress',
        assignedAccountId: 'senior-fullstack',
        assignedPersona: 'Senior Fullstack Developer',
        storyPoints: 5,
        updatedAt: Date.now()
      },
      {
        id: 'task-103',
        title: 'Integrate with Workspace Kanban Board in Orca',
        description: 'Allow 1-click opening of Workspace Board and lane status transitions.',
        epicId: 'epic-103',
        sprintId: 'sprint-1',
        status: 'todo',
        assignedAccountId: 'senior-fullstack',
        assignedPersona: 'Senior Fullstack Developer',
        storyPoints: 5,
        updatedAt: Date.now()
      },
      {
        id: 'task-104',
        title: 'Security Audit: IPC Boundaries & Permissions',
        description:
          'Verify strict JSON payloads and defense against unauthorized shell execution.',
        epicId: 'epic-101',
        sprintId: 'sprint-1',
        status: 'in-review',
        assignedAccountId: 'security-auditor',
        assignedPersona: 'Security Auditor',
        storyPoints: 2,
        updatedAt: Date.now()
      }
    ]
    await storageSet(STORAGE_KEY_WORKITEMS, defaultWorkItems)
  }

  // --- 1. ACCOUNTS HANDLERS ---
  orca.panels.handle('accounts.list', async () => {
    const accounts = await getStoredAccounts()
    const activeId = await getActiveAccountId()
    return {
      accounts,
      activeId: activeId ?? accounts[0]?.id ?? null
    }
  })

  orca.panels.handle('accounts.add', async (input) => {
    if (!input || !input.name || typeof input.name !== 'string' || !input.name.trim()) {
      throw new Error('Account name is required')
    }

    const name = input.name.trim()
    const accounts = await getStoredAccounts()
    const baseDir = await getAccountsBaseDirectory()

    const candidateId = input.id && input.id.trim() ? slugify(input.id.trim()) : slugify(name)
    let finalId = candidateId
    let counter = 1
    while (accounts.some((acc) => acc.id === finalId && acc.name !== name)) {
      finalId = `${candidateId}-${counter++}`
    }

    const home =
      input.customHome && input.customHome.trim()
        ? resolvePath(input.customHome.trim())
        : join(baseDir, finalId, 'home')

    const geminiHome =
      input.customGeminiHome && input.customGeminiHome.trim()
        ? resolvePath(input.customGeminiHome.trim())
        : join(baseDir, finalId, '.gemini')

    await mkdir(home, { recursive: true })
    await mkdir(geminiHome, { recursive: true })

    const personaInstructions =
      typeof input.personaInstructions === 'string' && input.personaInstructions.trim()
        ? input.personaInstructions.trim()
        : null

    if (personaInstructions) {
      const rulesDir = join(geminiHome, 'rules')
      await mkdir(rulesDir, { recursive: true })
      await writeFile(join(rulesDir, 'AGENTS.md'), personaInstructions, 'utf8')
      await writeFile(join(home, 'PERSONA.md'), personaInstructions, 'utf8')
    }

    const shareGlobalSkills = input.shareGlobalSkills !== false
    if (shareGlobalSkills) {
      await linkGlobalSkillsToAccount(geminiHome)
    }

    /** @type {import('../src/protocol').AntigravityAccount} */
    const newAccount = {
      id: finalId,
      name,
      home,
      geminiHome,
      shareGlobalSkills,
      createdAt: Date.now()
    }
    if (input.email && input.email.trim()) newAccount.email = input.email.trim()
    if (input.description && input.description.trim())
      newAccount.description = input.description.trim()
    if (Array.isArray(input.flags) && input.flags.length > 0) newAccount.flags = input.flags
    if (input.customFlags && input.customFlags.trim())
      newAccount.customFlags = input.customFlags.trim()
    if (input.personaName && input.personaName.trim())
      newAccount.personaName = input.personaName.trim()
    if (personaInstructions) newAccount.personaInstructions = personaInstructions

    const existingIndex = accounts.findIndex((a) => a.id === finalId)
    let updatedAccounts
    if (existingIndex >= 0) {
      updatedAccounts = [...accounts]
      updatedAccounts[existingIndex] = cleanJson({ ...accounts[existingIndex], ...newAccount })
    } else {
      updatedAccounts = [...accounts, cleanJson(newAccount)]
    }

    await storageSet(STORAGE_KEY_ACCOUNTS, updatedAccounts)
    await storageSet(STORAGE_KEY_ACTIVE, finalId)

    const payload = cleanJson({
      account: newAccount,
      accounts: updatedAccounts,
      activeId: finalId
    })

    orca.panels.post('accounts.changed', {
      accounts: payload.accounts,
      activeId: payload.activeId
    })

    return payload
  })

  orca.panels.handle('accounts.remove', async ({ id }) => {
    const accounts = await getStoredAccounts()
    const activeId = await getActiveAccountId()
    const updated = accounts.filter((a) => a.id !== id)

    let nextActiveId = activeId
    if (activeId === id) {
      nextActiveId = updated[0]?.id ?? null
    }

    await storageSet(STORAGE_KEY_ACCOUNTS, updated)
    await storageSet(STORAGE_KEY_ACTIVE, nextActiveId)

    orca.panels.post('accounts.changed', {
      accounts: updated,
      activeId: nextActiveId
    })

    return {
      removedId: id,
      accounts: updated,
      activeId: nextActiveId
    }
  })

  orca.panels.handle('accounts.setActive', async ({ id }) => {
    const accounts = await getStoredAccounts()
    const match = accounts.find((a) => a.id === id)
    if (!match) {
      throw new Error(`Account "${id}" not found`)
    }

    await storageSet(STORAGE_KEY_ACTIVE, id)
    orca.panels.post('accounts.changed', {
      accounts,
      activeId: id
    })

    return { activeId: id }
  })

  orca.panels.handle('accounts.getWorkspaces', async () => {
    try {
      const [listRes, contextRes] = await Promise.allSettled([
        orca.host.call('workspace.list', {}),
        orca.host.call('workspace.readContext', {})
      ])

      const listValue = listRes.status === 'fulfilled' ? listRes.value : null
      const contextValue =
        contextRes.status === 'fulfilled' ? contextRes.value : currentActiveWorkspaceContext
      if (contextValue) {
        currentActiveWorkspaceContext = contextValue
      }

      const workspaces = (listValue?.workspaces || []).map((w) => ({
        id: w.id,
        name: w.name,
        branch: w.branch ?? null,
        path: w.path,
        projectId: w.projectId ?? null
      }))

      let activeWorkspaceId = contextValue?.workspaceId ?? null
      if (!activeWorkspaceId && contextValue?.displayName) {
        const match = workspaces.find((w) => w.name === contextValue.displayName)
        if (match) activeWorkspaceId = match.id
      }
      if (!activeWorkspaceId && workspaces.length > 0) {
        activeWorkspaceId = workspaces[0].id
      }

      return {
        workspaces,
        activeWorkspaceId,
        focusedWorkspaceName: contextValue?.displayName ?? null,
        focusedBranch: contextValue?.branch ?? null,
        focusedContext: contextValue ?? null
      }
    } catch (err) {
      orca.log(`Notice: accounts.getWorkspaces failed: ${err.message}`)
      return {
        workspaces: [],
        activeWorkspaceId: null,
        focusedWorkspaceName: null,
        focusedBranch: null,
        focusedContext: null
      }
    }
  })

  orca.panels.handle('accounts.summon', async (params) => {
    const accounts = await getStoredAccounts()
    if (accounts.length === 0) {
      throw new Error('No accounts configured. Please add an account first.')
    }

    const activeId = await getActiveAccountId()
    const targetAccountId = params?.accountId || activeId || accounts[0]?.id
    const account = accounts.find((a) => a.id === targetAccountId) || accounts[0]
    if (!account) {
      throw new Error('Unable to resolve account to summon.')
    }

    const targetWorkspaceId = await resolveTargetWorkspace(params?.workspaceId)
    if (!targetWorkspaceId) {
      throw new Error('No workspace found. Please open a workspace before summoning agy.')
    }

    await mkdir(account.home, { recursive: true })
    await mkdir(account.geminiHome, { recursive: true })
    if (account.shareGlobalSkills !== false) {
      await linkGlobalSkillsToAccount(account.geminiHome)
    }

    let promptFile = null
    if (params?.prompt && typeof params.prompt === 'string' && params.prompt.trim()) {
      promptFile = join(account.home, 'active-prompt.md')
      try {
        await writeFile(promptFile, params.prompt.trim(), 'utf8')
      } catch (err) {
        promptFile = null
      }
    }

    const flags = [...(account.flags || []), ...(params?.flags || [])]
    const customFlags = [account.customFlags, params?.customFlags].filter(Boolean).join(' ')
    const agyCmd = await getAgyExecutable()
    const command = buildAgyCommand({
      home: account.home,
      geminiHome: account.geminiHome,
      agyCmd,
      flags,
      customFlags,
      prompt: params?.prompt,
      promptFile
    })

    const personaLabel = account.personaName ? ` - ${account.personaName}` : ''
    const title = clampTerminalTitle(`agy (${account.name}${personaLabel})`)
    const outcome = await orca.host.call('terminal.create', {
      workspaceId: targetWorkspaceId,
      title,
      command
    })

    const terminalId = outcome?.terminalId ?? ''
    try {
      await orca.host.call('notifications.show', {
        title: 'Antigravity Flow',
        body: `Summoned ${account.name}${personaLabel} in workspace terminal.`
      })
    } catch {}

    await recordAccountActivity({
      accountId: account.id,
      type: 'summon',
      title: `Summoned ${account.name}`,
      details: params?.prompt
        ? `Prompt: ${params.prompt.slice(0, 100)}`
        : 'Interactive terminal session',
      workspaceId: targetWorkspaceId
    })

    orca.panels.post('accounts.summoned', {
      terminalId,
      accountId: account.id,
      accountName: account.name
    })

    return {
      terminalId,
      workspaceId: targetWorkspaceId,
      accountId: account.id,
      accountName: account.name,
      command
    }
  })

  orca.panels.handle('accounts.login', async (params) => {
    const accounts = await getStoredAccounts()
    const targetAccountId = params?.accountId
    const account = accounts.find((a) => a.id === targetAccountId) || accounts[0]
    if (!account) {
      throw new Error(`Account "${targetAccountId}" not found`)
    }

    const targetWorkspaceId = await resolveTargetWorkspace(params?.workspaceId)
    if (!targetWorkspaceId) {
      throw new Error('Please open a workspace before authenticating.')
    }

    await mkdir(account.home, { recursive: true })
    await mkdir(account.geminiHome, { recursive: true })
    if (account.shareGlobalSkills !== false) {
      await linkGlobalSkillsToAccount(account.geminiHome)
    }

    const agyCmd = await getAgyExecutable()
    const isWin = process.platform === 'win32'
    const command = isWin
      ? `set "HOME=${account.home}" && set "GEMINI_HOME=${account.geminiHome}" && set "DBUS_SESSION_BUS_ADDRESS=unix:path=/dev/null" && ${agyCmd}`
      : `env HOME=${escapeShellArg(account.home, false)} GEMINI_HOME=${escapeShellArg(account.geminiHome, false)} DBUS_SESSION_BUS_ADDRESS="unix:path=/dev/null" ${agyCmd}`

    const title = clampTerminalTitle(`[Sign in] ${account.name}`)
    const outcome = await orca.host.call('terminal.create', {
      workspaceId: targetWorkspaceId,
      title,
      command
    })

    return {
      terminalId: outcome?.terminalId ?? '',
      accountName: account.name
    }
  })

  // --- 2. WORKFLOWS HANDLERS ---
  orca.panels.handle('workflows.list', async (params) => {
    const all = await getStoredWorkflows()
    const targetWsId =
      params?.workspaceId === 'active'
        ? await resolveTargetWorkspace('active')
        : params?.workspaceId

    if (!targetWsId && !params?.projectId) {
      return { workflows: all }
    }
    const filtered = all.filter((w) => {
      if (targetWsId && w.workspaceId === targetWsId) return true
      if (params.projectId && w.projectId === params.projectId) return true
      return !w.workspaceId && !w.projectId
    })
    return { workflows: filtered }
  })

  orca.panels.handle('workflows.save', async ({ workflow }) => {
    if (!workflow || !workflow.name || !workflow.name.trim()) {
      throw new Error('Workflow name is required')
    }
    const all = await getStoredWorkflows()
    const id = workflow.id && workflow.id.trim() ? slugify(workflow.id) : slugify(workflow.name)
    const normalized = {
      ...workflow,
      id,
      name: workflow.name.trim(),
      steps: Array.isArray(workflow.steps) ? workflow.steps : []
    }
    const idx = all.findIndex((w) => w.id === id)
    let updated
    if (idx >= 0) {
      updated = [...all]
      updated[idx] = normalized
    } else {
      updated = [...all, normalized]
    }
    await storageSet(STORAGE_KEY_WORKFLOWS, updated)
    orca.panels.post('workflows.changed', { workflows: updated })
    return { workflow: normalized, workflows: updated }
  })

  orca.panels.handle('workflows.delete', async ({ id }) => {
    const all = await getStoredWorkflows()
    const updated = all.filter((w) => w.id !== id)
    await storageSet(STORAGE_KEY_WORKFLOWS, updated)
    orca.panels.post('workflows.changed', { workflows: updated })
    return { ok: true, workflows: updated }
  })

  orca.panels.handle('workflows.execute', async (params = {}) => {
    const { workflowId, workspaceId } = params || {}
    if (typeof workflowId !== 'string' || !workflowId.trim()) {
      throw new Error('Workflow ID is required')
    }
    const targetWorkspaceId = await resolveTargetWorkspace(workspaceId)
    if (!targetWorkspaceId) {
      throw new Error('Target workspace is required to execute workflow')
    }
    const workflows = await getStoredWorkflows()
    const wf = workflows.find((w) => w.id === workflowId)
    if (!wf) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }
    if (!wf.steps || wf.steps.length === 0) {
      throw new Error(`Workflow "${wf.name}" contains no agent steps`)
    }

    const accounts = await getStoredAccounts()
    const agyCmd = await getAgyExecutable()
    let startedCount = 0

    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i]
      const account = accounts.find((a) => a.id === step.accountId) || accounts[0]
      if (!account) continue

      await mkdir(account.home, { recursive: true })
      await mkdir(account.geminiHome, { recursive: true })
      if (account.shareGlobalSkills !== false) {
        await linkGlobalSkillsToAccount(account.geminiHome)
      }

      let promptFile = null
      if (step.prompt && step.prompt.trim()) {
        promptFile = join(account.home, `workflow-${wf.id}-step-${i + 1}.md`)
        try {
          await writeFile(promptFile, step.prompt.trim(), 'utf8')
        } catch {
          promptFile = null
        }
      }

      const flags = [...(account.flags || [])]
      const customFlags = [account.customFlags, step.customFlags].filter(Boolean).join(' ')
      const command = buildAgyCommand({
        home: account.home,
        geminiHome: account.geminiHome,
        agyCmd,
        flags,
        customFlags,
        prompt: step.prompt,
        promptFile
      })

      const personaLabel = account.personaName ? ` [${account.personaName}]` : ''
      const laneLabel = step.statusLane ? ` [${step.statusLane}]` : ''
      const title = clampTerminalTitle(
        `[Workflow: ${wf.name}] #${i + 1} ${step.name}${laneLabel} (${account.name}${personaLabel})`
      )
      await orca.host.call('terminal.create', {
        workspaceId: targetWorkspaceId,
        title,
        command
      })
      await recordAccountActivity({
        accountId: account.id,
        type: 'workflow',
        title: `Workflow Step: ${step.name}`,
        details: `Pipeline: "${wf.name}" (${step.statusLane || 'in-progress'})`,
        workspaceId: targetWorkspaceId
      })
      startedCount++
    }

    try {
      await orca.host.call('notifications.show', {
        title: 'Antigravity Workflow Launched',
        body: `Launched ${startedCount} agent step(s) for "${wf.name}"`
      })
    } catch {}

    return {
      ok: true,
      message: `Launched ${startedCount} agent steps for "${wf.name}"!`,
      startedSteps: startedCount
    }
  })

  // --- 3. AGILE BOARD & WORK ITEMS HANDLERS ---
  orca.panels.handle('board.openNative', async () => {
    try {
      await orca.host.call('commands.run', { action: 'workspace.openBoard' })
      return { opened: true }
    } catch (err) {
      orca.log(`Notice: could not run workspace.openBoard: ${err.message}`)
      return { opened: false }
    }
  })

  orca.panels.handle('board.getAgileState', async () => {
    const sprints = await getStoredSprints()
    const epics = await getStoredEpics()
    const workItems = await getStoredWorkItems()
    return { sprints, epics, workItems, lanes: ORCA_DEFAULT_BOARD_LANES }
  })

  orca.panels.handle('board.saveSprint', async ({ sprint }) => {
    if (!sprint || !sprint.name || !sprint.name.trim()) {
      throw new Error('Sprint name is required')
    }
    const all = await getStoredSprints()
    const id = sprint.id && sprint.id.trim() ? slugify(sprint.id) : `sprint-${Date.now()}`
    const normalized = {
      ...sprint,
      id,
      name: sprint.name.trim(),
      status: sprint.status || 'planning'
    }
    const idx = all.findIndex((s) => s.id === id)
    let updated = [...all]
    if (idx >= 0) {
      updated[idx] = normalized
    } else {
      updated.push(normalized)
    }
    if (normalized.status === 'active') {
      updated = updated.map((s) =>
        s.id === id ? s : s.status === 'active' ? { ...s, status: 'planning' } : s
      )
    }
    await storageSet(STORAGE_KEY_SPRINTS, updated)
    const epics = await getStoredEpics()
    const workItems = await getStoredWorkItems()
    orca.panels.post('board.changed', {
      sprints: updated,
      epics,
      workItems,
      lanes: ORCA_DEFAULT_BOARD_LANES
    })
    return { sprint: normalized, sprints: updated }
  })

  orca.panels.handle('board.completeSprint', async ({ sprintId, rolloverToSprintId }) => {
    const sprints = await getStoredSprints()
    const workItems = await getStoredWorkItems()
    const sprintIdx = sprints.findIndex((s) => s.id === sprintId)
    if (sprintIdx >= 0) {
      sprints[sprintIdx] = { ...sprints[sprintIdx], status: 'completed' }
    }
    let updatedItems = [...workItems]
    if (rolloverToSprintId) {
      updatedItems = updatedItems.map((item) => {
        if (item.sprintId === sprintId && item.status !== 'completed') {
          return { ...item, sprintId: rolloverToSprintId, updatedAt: Date.now() }
        }
        return item
      })
      await storageSet(STORAGE_KEY_WORKITEMS, updatedItems)
    }
    await storageSet(STORAGE_KEY_SPRINTS, sprints)
    const epics = await getStoredEpics()
    orca.panels.post('board.changed', {
      sprints,
      epics,
      workItems: updatedItems,
      lanes: ORCA_DEFAULT_BOARD_LANES
    })
    return { ok: true, sprints, workItems: updatedItems }
  })

  orca.panels.handle('board.deleteSprint', async ({ sprintId, moveToSprintId } = {}) => {
    if (typeof sprintId !== 'string' || !sprintId.trim()) {
      throw new Error('Sprint ID is required')
    }
    const targetId = sprintId.trim()
    const sprints = await getStoredSprints()
    const workItems = await getStoredWorkItems()
    const epics = await getStoredEpics()

    if (!sprints.some((s) => s.id === targetId)) {
      throw new Error(`Sprint "${targetId}" not found`)
    }

    const updatedSprints = sprints.filter((s) => s.id !== targetId)
    const targetMoveId = typeof moveToSprintId === 'string' ? moveToSprintId.trim() : ''

    if (targetMoveId) {
      if (targetMoveId === targetId) {
        throw new Error('Cannot move work items to the sprint being deleted')
      }
      if (!updatedSprints.some((s) => s.id === targetMoveId)) {
        throw new Error(`Target sprint "${targetMoveId}" not found`)
      }
    }

    const updatedItems = targetMoveId
      ? workItems.map((item) =>
          item.sprintId === targetId
            ? { ...item, sprintId: targetMoveId, updatedAt: Date.now() }
            : item
        )
      : workItems.filter((item) => item.sprintId !== targetId)

    let epicsChanged = false
    const updatedEpics = epics.map((epic) => {
      if (epic.targetSprintId !== targetId) return epic
      epicsChanged = true
      if (targetMoveId) {
        return { ...epic, targetSprintId: targetMoveId }
      }
      const { targetSprintId: _removed, ...rest } = epic
      return rest
    })

    await storageSet(STORAGE_KEY_SPRINTS, updatedSprints)
    await storageSet(STORAGE_KEY_WORKITEMS, updatedItems)
    if (epicsChanged) {
      await storageSet(STORAGE_KEY_EPICS, updatedEpics)
    }

    orca.panels.post('board.changed', {
      sprints: updatedSprints,
      epics: updatedEpics,
      workItems: updatedItems,
      lanes: ORCA_DEFAULT_BOARD_LANES
    })

    return {
      ok: true,
      deletedSprintId: targetId,
      sprints: updatedSprints,
      workItems: updatedItems,
      epics: updatedEpics
    }
  })

  orca.panels.handle('board.saveEpic', async ({ epic }) => {
    if (!epic || !epic.name || !epic.name.trim()) {
      throw new Error('Epic name is required')
    }
    const all = await getStoredEpics()
    const id = epic.id && epic.id.trim() ? slugify(epic.id) : `epic-${Date.now()}`
    const normalized = {
      ...epic,
      id,
      name: epic.name.trim(),
      status: epic.status || 'in-progress'
    }
    const idx = all.findIndex((e) => e.id === id)
    let updated
    if (idx >= 0) {
      updated = [...all]
      updated[idx] = normalized
    } else {
      updated = [...all, normalized]
    }
    await storageSet(STORAGE_KEY_EPICS, updated)
    const sprints = await getStoredSprints()
    const workItems = await getStoredWorkItems()
    orca.panels.post('board.changed', {
      sprints,
      epics: updated,
      workItems,
      lanes: ORCA_DEFAULT_BOARD_LANES
    })
    return { epic: normalized, epics: updated }
  })

  orca.panels.handle('board.deleteEpic', async ({ epicId }) => {
    const all = await getStoredEpics()
    const updated = all.filter((e) => e.id !== epicId)
    await storageSet(STORAGE_KEY_EPICS, updated)
    const sprints = await getStoredSprints()
    const workItems = await getStoredWorkItems()
    orca.panels.post('board.changed', {
      sprints,
      epics: updated,
      workItems,
      lanes: ORCA_DEFAULT_BOARD_LANES
    })
    return { ok: true, epics: updated }
  })

  orca.panels.handle('board.saveWorkItem', async ({ item }) => {
    if (!item || !item.title || !item.title.trim()) {
      throw new Error('Work item title is required')
    }
    const all = await getStoredWorkItems()
    const id = item.id && item.id.trim() ? item.id.trim() : `task-${Date.now()}`
    const normalized = {
      ...item,
      id,
      title: item.title.trim(),
      updatedAt: Date.now()
    }

    const idx = all.findIndex((i) => i.id === id)
    let updated
    if (idx >= 0) {
      updated = [...all]
      updated[idx] = normalized
    } else {
      updated = [...all, normalized]
    }

    await storageSet(STORAGE_KEY_WORKITEMS, updated)
    const sprints = await getStoredSprints()
    const epics = await getStoredEpics()
    orca.panels.post('board.changed', { sprints, epics, workItems: updated })
    return { item: normalized, workItems: updated }
  })

  orca.panels.handle('board.updateItemStatus', async ({ itemId, status }) => {
    const all = await getStoredWorkItems()
    const idx = all.findIndex((i) => i.id === itemId)
    if (idx < 0) {
      throw new Error(`Work item "${itemId}" not found`)
    }
    const updated = [...all]
    updated[idx] = {
      ...updated[idx],
      status,
      updatedAt: Date.now()
    }
    await storageSet(STORAGE_KEY_WORKITEMS, updated)
    const sprints = await getStoredSprints()
    const epics = await getStoredEpics()
    orca.panels.post('board.changed', { sprints, epics, workItems: updated })
    return { itemId, status, workItems: updated }
  })

  orca.panels.handle('board.deleteWorkItem', async ({ itemId }) => {
    const all = await getStoredWorkItems()
    const updated = all.filter((i) => i.id !== itemId)
    await storageSet(STORAGE_KEY_WORKITEMS, updated)
    const sprints = await getStoredSprints()
    const epics = await getStoredEpics()
    orca.panels.post('board.changed', { sprints, epics, workItems: updated })
    return { ok: true, workItems: updated }
  })

  orca.panels.handle('board.summonWorkItem', async ({ itemId, workspaceId }) => {
    const workItems = await getStoredWorkItems()
    const item = workItems.find((i) => i.id === itemId)
    if (!item) {
      throw new Error(`Work item "${itemId}" not found`)
    }

    const sprints = await getStoredSprints()
    const epics = await getStoredEpics()
    const accounts = await getStoredAccounts()

    const sprint = sprints.find((s) => s.id === item.sprintId)
    const epic = epics.find((e) => e.id === item.epicId)

    // Resolve target account by assigned id or persona match
    let account = accounts.find((a) => a.id === item.assignedAccountId)
    if (!account && item.assignedPersona) {
      account = accounts.find((a) => a.personaName === item.assignedPersona)
    }
    if (!account) {
      const activeId = await getActiveAccountId()
      account = accounts.find((a) => a.id === activeId) || accounts[0]
    }
    if (!account) {
      throw new Error('No account available to assign to this work item.')
    }

    const targetWorkspaceId = await resolveTargetWorkspace(workspaceId || item.workspaceId)
    if (!targetWorkspaceId) {
      throw new Error('Please select or open a project workspace in Orca.')
    }

    await mkdir(account.home, { recursive: true })
    await mkdir(account.geminiHome, { recursive: true })
    if (account.shareGlobalSkills !== false) {
      await linkGlobalSkillsToAccount(account.geminiHome)
    }

    // Markdown Agile prompt
    const promptContent = [
      `# Agile Work Item: ${item.title}`,
      `**Sprint**: ${sprint ? sprint.name : item.sprintId}`,
      `**Epic**: ${epic ? epic.name : item.epicId}`,
      `**Story Points**: ${item.storyPoints ?? 3}`,
      `**Assigned Role**: ${account.personaName || account.name}`,
      '',
      '## Task Description & Objective',
      item.description ||
        'Implement the requirements according to agile sprint definition and acceptance criteria.',
      '',
      '## Agile Workflow Instructions',
      '1. Review the requirements and inspect the relevant project files in this workspace.',
      '2. Implement the changes with clean code and tests following project conventions.',
      '3. Verify all checks pass before signaling task completion.'
    ].join('\n')

    const promptFile = join(account.home, `agile-task-${item.id}.md`)
    await writeFile(promptFile, promptContent, 'utf8')

    const flags = [...(account.flags || [])]
    const customFlags = account.customFlags || ''
    const agyCmd = await getAgyExecutable()
    const command = buildAgyCommand({
      home: account.home,
      geminiHome: account.geminiHome,
      agyCmd,
      flags,
      customFlags,
      prompt: promptContent,
      promptFile
    })

    const title = clampTerminalTitle(`[Agile: ${item.id}] ${item.title} (${account.name})`)
    const outcome = await orca.host.call('terminal.create', {
      workspaceId: targetWorkspaceId,
      title,
      command
    })

    // Advance status to in-progress if currently in todo
    if (item.status === 'todo') {
      item.status = 'in-progress'
      item.updatedAt = Date.now()
      const idx = workItems.findIndex((i) => i.id === item.id)
      if (idx >= 0) {
        workItems[idx] = item
        await storageSet(STORAGE_KEY_WORKITEMS, workItems)
        orca.panels.post('board.changed', { sprints, epics, workItems })
      }
    }

    try {
      await orca.host.call('notifications.show', {
        title: 'Agile Agent Summoned',
        body: `Agent started on "${item.title}" in workspace.`
      })
    } catch {}

    const terminalId = outcome?.terminalId ?? ''
    await recordAccountActivity({
      accountId: account.id,
      type: 'task',
      title: `Assigned Task: ${item.title}`,
      details: `Sprint: ${sprint?.name ?? 'Backlog'} • ${item.storyPoints || 3} pts`,
      workspaceId: targetWorkspaceId
    })

    orca.panels.post('accounts.summoned', {
      terminalId,
      accountId: account.id,
      accountName: account.name
    })

    return {
      terminalId,
      itemTitle: item.title,
      accountName: account.name
    }
  })

  // --- 4. FEATURE USAGE MONITORING HANDLERS ---
  orca.panels.handle('usage.getStats', async () => {
    const { stats, overview } = await computeFullUsageStats()
    const recentActivities = await getStoredActivities()
    return { stats, overview, recentActivities }
  })

  orca.panels.handle('usage.clearHistory', async (params) => {
    if (params?.accountId) {
      const metrics = await getStoredUsageMetrics()
      delete metrics[params.accountId]
      await storageSet(STORAGE_KEY_USAGE, metrics)
      const activities = await getStoredActivities()
      const filtered = activities.filter((a) => a.accountId !== params.accountId)
      await storageSet(STORAGE_KEY_ACTIVITIES, filtered)
    } else {
      await storageSet(STORAGE_KEY_USAGE, {})
      await storageSet(STORAGE_KEY_ACTIVITIES, [])
    }
    const { stats, overview } = await computeFullUsageStats()
    const recentActivities = await getStoredActivities()
    orca.panels.post('usage.changed', { stats, overview, recentActivities })
    return { ok: true, stats, overview, recentActivities }
  })

  // --- 5. REAL-TIME QUOTA & TOKEN LIMITS HANDLERS ---
  orca.panels.handle('quota.getAccountQuota', async (params) => {
    const accounts = await getStoredAccounts()
    const forceRefresh = Boolean(params?.forceRefresh)
    const targetAccountId = params?.accountId

    /** @type {Record<string, import('../src/protocol').AccountQuotaInfo>} */
    const quotas = {}

    if (targetAccountId) {
      const targetAccount = accounts.find((a) => a.id === targetAccountId)
      if (targetAccount) {
        quotas[targetAccount.id] = await fetchAccountQuota(targetAccount, forceRefresh)
      }
    } else {
      const results = await Promise.allSettled(
        accounts.map((acc) => fetchAccountQuota(acc, forceRefresh))
      )
      for (let i = 0; i < accounts.length; i++) {
        const res = results[i]
        const acc = accounts[i]
        if (res.status === 'fulfilled') {
          quotas[acc.id] = res.value
        } else {
          quotas[acc.id] = cleanJson({
            accountId: acc.id,
            status: 'error',
            updatedAt: Date.now(),
            error: String(res.reason?.message || 'Failed to fetch quota'),
            groups: [],
            geminiWeeklyRemaining: null,
            gemini5hRemaining: null,
            thirdPartyWeeklyRemaining: null,
            thirdParty5hRemaining: null
          })
        }
      }
    }

    const cleanResult = cleanJson({ quotas })
    orca.panels.post('quota.changed', cleanResult)
    return cleanResult
  })

  if (orca.commands?.register) {
    orca.commands.register('antigravity.openFlow', async () => {
      return 'Antigravity Flow panel is available in the right sidebar.'
    })
  }

  orca.log('Antigravity Flow worker ready with Agile Board integration.')
}
