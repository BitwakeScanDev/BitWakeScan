import readline from "readline"
import { ShellOps } from "./ShellOps"

/**
 * Interactive shell runner around ShellOps with:
 * - persistent prompt
 * - configurable timeout and output limit
 * - safe error handling and partial output surfacing
 * - builtin meta-commands (:help, :timeout, :limit, :cd, :cwd, :clear, :exit)
 */

type RunConfig = {
  timeoutMs: number
  maxOutputChars: number
}

const cfg: RunConfig = {
  timeoutMs: 30_000,
  maxOutputChars: 200_000, // prevent runaway output flooding the terminal
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  historySize: 500,
})

const ops = new ShellOps()

/** ANSI helpers (no external deps) */
const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
}

function prompt(): void {
  const cwd = process.cwd()
  rl.setPrompt(`${color.cyan("sh")} ${color.gray(cwd)} ${color.dim("> ")} `)
  rl.prompt()
}

function truncate(s: string, limit = cfg.maxOutputChars): string {
  if (!s) return ""
  if (s.length <= limit) return s
  const head = s.slice(0, Math.floor(limit * 0.8))
  const tail = s.slice(-Math.floor(limit * 0.2))
  return `${head}\n${color.dim("… [output truncated] …")}\n${tail}`
}

function printSection(title: string, body: string, ok = true): void {
  const bar = ok ? color.green("──") : color.red("──")
  console.log(`${bar} ${title} ${bar}`)
  if (body) console.log(body)
}

async function handleMetaCommand(line: string): Promise<boolean> {
  const [cmd, ...rest] = line.trim().split(/\s+/)
  switch (cmd) {
    case ":help": {
      console.log(
        [
          color.yellow("Meta-commands:"),
          ":help                show this help",
          ":timeout <ms>        set exec timeout (default 30000)",
          ":limit <chars>       set max printed chars for stdout/stderr",
          ":cwd                 print current working directory",
          ":cd <path>           change directory",
          ":clear               clear the screen",
          ":exit | :quit        exit",
        ].join("\n")
      )
      return true
    }
    case ":timeout": {
      const val = Number(rest[0])
      if (!Number.isFinite(val) || val <= 0) {
        console.log(color.red("Provide a positive integer timeout in ms"))
        return true
      }
      cfg.timeoutMs = Math.floor(val)
      console.log(`timeout set to ${cfg.timeoutMs} ms`)
      return true
    }
    case ":limit": {
      const val = Number(rest[0])
      if (!Number.isFinite(val) || val < 1_000) {
        console.log(color.red("Provide a sane limit (>= 1000)"))
        return true
      }
      cfg.maxOutputChars = Math.floor(val)
      console.log(`max output set to ${cfg.maxOutputChars} chars`)
      return true
    }
    case ":cwd": {
      console.log(process.cwd())
      return true
    }
    case ":cd": {
      const dest = rest.join(" ")
      if (!dest) {
        console.log(color.red("Usage: :cd <path>"))
        return true
      }
      try {
        process.chdir(dest)
        console.log(`cwd: ${process.cwd()}`)
      } catch (e: any) {
        console.error(color.red(`cd failed: ${e?.message || String(e)}`))
      }
      return true
    }
    case ":clear": {
      process.stdout.write("\x1b[2J\x1b[0f")
      return true
    }
    case ":exit":
    case ":quit": {
      cleanupAndExit(0)
      return true
    }
    default:
      return false
  }
}

async function runOnce(line: string): Promise<void> {
  const cmd = line.trim()
  if (!cmd) return

  if (cmd.startsWith(":")) {
    const handled = await handleMetaCommand(cmd)
    if (handled) return
    console.log(color.red(`Unknown meta-command: ${cmd}. Try :help`))
    return
  }

  try {
    const { stdout, stderr } = await ops.run(cmd, { timeoutMs: cfg.timeoutMs })
    if (stdout) printSection("Output", truncate(stdout), true)
    if (stderr) printSection("Errors", truncate(stderr), false)
    if (!stdout && !stderr) console.log(color.gray("[no output]"))
  } catch (err: any) {
    const stdout = truncate(err?.stdout || "")
    const stderr = truncate(err?.stderr || err?.message || String(err) || "")
    console.error(color.red("Execution failed"))
    if (stdout) printSection("Partial output", stdout, false)
    if (stderr) printSection("Error message", stderr, false)
  }
}

function cleanupAndExit(code: number): void {
  rl.close()
  // allow any pending logs to flush
  setTimeout(() => process.exit(code), 10)
}

/** graceful signal handling */
process.on("SIGINT", () => {
  console.log(color.yellow("\n^C"))
  prompt()
})
process.on("SIGTERM", () => {
  console.log(color.yellow("\nReceived SIGTERM"))
  cleanupAndExit(0)
})

/** main REPL */
console.log(color.dim("Type a shell command or :help for meta-commands"))
prompt()
rl.on("line", async (line) => {
  await runOnce(line)
  prompt()
})
rl.on("close", () => {
  // invoked by :exit or EOF
  process.exit(0)
})
