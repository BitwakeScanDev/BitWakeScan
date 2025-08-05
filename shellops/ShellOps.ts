import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export interface RunOptions {
  /** Override working directory */
  cwd?: string
  /** Shell to use (default /bin/bash) */
  shell?: string
  /** Timeout in milliseconds */
  timeoutMs?: number
  /** Environment variables */
  env?: NodeJS.ProcessEnv
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

/**
 * Simple wrapper around shell commands with async/await,
 * capturing stdout, stderr, and exit code.
 */
export class ShellOps {
  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Executes a shell command.
   *
   * @param command  The command to run (bash syntax)
   * @param opts     Optional run settings
   * @returns        stdout, stderr, and exit code
   */
  public async run(command: string, opts: RunOptions = {}): Promise<RunResult> {
    const { cwd = this.cwd, shell = "/bin/bash", timeoutMs, env } = opts

    try {
      const { stdout, stderr } = await execAsync(command, { cwd, shell, timeout: timeoutMs, env })
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      }
    } catch (err: any) {
      // err.code is exit code, err.stdout and err.stderr may be Buffers or strings
      const code = typeof err.code === "number" ? err.code : null
      const out = err.stdout?.toString().trim() || ""
      const errStr = err.stderr?.toString().trim() || err.message || ""
      return {
        stdout: out,
        stderr: errStr,
        exitCode: code,
      }
    }
  }
}
