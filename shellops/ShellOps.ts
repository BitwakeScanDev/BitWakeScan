import { exec, ExecOptions as NodeExecOptions } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

/** Resolve a sensible default shell across platforms */
function getDefaultShell(): string {
  if (process.platform === "win32") {
    // Prefer PowerShell if available; fall back to cmd.exe
    return process.env.ComSpec || "cmd.exe"
  }
  return process.env.SHELL || "/bin/bash"
}

export interface RunOptions {
  /** Working directory override */
  cwd?: string
  /** Shell to use (default: platform-aware) */
  shell?: string
  /** Timeout in milliseconds */
  timeoutMs?: number
  /** Environment variables (merged onto process.env) */
  env?: NodeJS.ProcessEnv
  /** Max buffer for stdout/stderr in bytes (default 10MB) */
  maxBuffer?: number
  /** Abort via signal (AbortController) */
  signal?: AbortSignal
  /** Encoding for stdout/stderr (default "utf8") */
  encoding?: BufferEncoding
  /** Provide stdin to the command */
  input?: string | Buffer
  /** Whether to trim stdout/stderr (default true) */
  trim?: boolean
  /** If true, non-zero exit codes throw; otherwise return RunResult (default false) */
  rejectOnNonZero?: boolean
  /** Strings to redact from stdout/stderr in the result or error */
  redact?: string[]
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
  /** true if the process was killed due to timeout or signal */
  killed: boolean
  /** signal name if terminated by a signal */
  signal: NodeJS.Signals | null
  /** execution duration in milliseconds */
  durationMs: number
}

export class ExecError extends Error {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  durationMs: number
  constructor(message: string, params: { code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; durationMs: number }) {
    super(message)
    this.name = "ExecError"
    this.code = params.code
    this.signal = params.signal
    this.stdout = params.stdout
    this.stderr = params.stderr
    this.durationMs = params.durationMs
  }
}

/** Redact sensitive tokens from a string */
function redact(text: string, tokens?: string[]): string {
  if (!tokens?.length || !text) return text
  let out = text
  for (const t of tokens) {
    if (!t) continue
    // Replace long tokens with fixed mask; short ones with generic mask to avoid ReDoS / excessive work
    const safe = t.length > 3 ? t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null
    out = safe ? out.replace(new RegExp(safe, "g"), "•••") : out
  }
  return out
}

/** Normalize output by optional trimming and converting CRLF to LF for consistency */
function normalizeOutput(s: string, trim: boolean): string {
  const v = (s ?? "").toString().replace(/\r\n/g, "\n")
  return trim ? v.trim() : v
}

/**
 * Simple, resilient shell runner with:
 * - platform-aware default shell
 * - timeout, buffer, env, signal support
 * - optional strict mode (rejectOnNonZero)
 * - redaction of sensitive tokens
 * - duration and kill/signal metadata
 */
export class ShellOps {
  constructor(private readonly defaultCwd: string = process.cwd()) {}

  /**
   * Execute a command and return structured result.
   *
   * By default does NOT throw on non-zero exit; set rejectOnNonZero to true to throw ExecError.
   */
  public async run(command: string, opts: RunOptions = {}): Promise<RunResult> {
    const {
      cwd = this.defaultCwd,
      shell = getDefaultShell(),
      timeoutMs,
      env,
      maxBuffer = 10 * 1024 * 1024,
      signal,
      encoding = "utf8",
      input,
      trim = true,
      rejectOnNonZero = false,
      redact: redactTokens,
    } = opts

    const start = Date.now()
    const nodeOpts: NodeExecOptions & { shell: string; encoding: BufferEncoding; input?: string | Buffer } = {
      cwd,
      shell,
      timeout: timeoutMs,
      env: env ? { ...process.env, ...env } : process.env,
      maxBuffer,
      signal,
      encoding,
      input,
    }

    try {
      const { stdout, stderr } = await execAsync(command, nodeOpts)
      const durationMs = Date.now() - start
      const cleanOut = redact(normalizeOutput(stdout, trim), redactTokens)
      const cleanErr = redact(normalizeOutput(stderr, trim), redactTokens)
      return {
        stdout: cleanOut,
        stderr: cleanErr,
        exitCode: 0,
        killed: false,
        signal: null,
        durationMs,
      }
    } catch (e: any) {
      const durationMs = Date.now() - start
      const code: number | null = typeof e?.code === "number" ? e.code : null
      const sig: NodeJS.Signals | null = e?.signal ?? null
      const out = redact(normalizeOutput(e?.stdout ?? "", trim), redactTokens)
      const err = redact(normalizeOutput(e?.stderr ?? e?.message ?? "", trim), redactTokens)

      const result: RunResult = {
        stdout: out,
        stderr: err,
        exitCode: code,
        killed: Boolean(e?.killed) || sig !== null || (timeoutMs ? durationMs >= timeoutMs : false),
        signal: sig,
        durationMs,
      }

      if (rejectOnNonZero) {
        const detail =
          `Command failed${code !== null ? ` with exit code ${code}` : ""}${sig ? ` due to signal ${sig}` : ""}`
        throw new ExecError(detail, { code, signal: sig, stdout: out, stderr: err, durationMs })
      }

      return result
    }
  }

  /**
   * Convenience strict variant: throws ExecError when exitCode != 0 or signaled.
   */
  public async runOrThrow(command: string, opts: Omit<RunOptions, "rejectOnNonZero"> = {}): Promise<RunResult> {
    return this.run(command, { ...opts, rejectOnNonZero: true })
  }
}
