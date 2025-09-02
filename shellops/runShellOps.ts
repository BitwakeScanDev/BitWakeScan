import readline from "readline"
import { ShellOps } from "./ShellOps"

/**
 * Interactive shell runner around ShellOps with:
 * - persistent prompt
 * - configurable timeout and output limit
 * - safe error handling and partial output surfacing
 * - builtin meta-commands (:help, :timeout, :limit, :cd, :cwd, :clear, :exit)
 * - extra meta-commands (:env, :mask, :unmask, :masks, :pwd)
 * - deterministic redaction of sensitive substrings in output
 */

type RunConfig = {
  timeoutMs: number
  maxOutputChars: number
  timeZone: "utc" | "local"
}

const cfg: RunConfig = {
  timeoutMs: Number(process.env.SHELL_TIMEOUT_MS) > 0 ? Math.floor(Number(process.env.SHELL_TIMEOUT_MS)) : 30_000,
  maxOutputChars:
    Number(process.env.SHELL_OUTPUT_LIMIT) && Number(process.env.SHELL_OUTPUT_LIMIT) >= 1000
      ? Math.floor(Number(process.env.SHELL_OUTPUT_LIMIT))
      : 200_000,
  timeZone: (process.env.SHELL_TZ as "utc" | "local") === "local" ? "local" : "utc"
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  historySize: 500
})

const ops = new ShellOps()

/** ANSI helpers (no external deps) */
const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`
}

/** Redaction store */
const masks = new Set<string>(
  (process.env.REPL_MASKS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
)

/** Normalize path: expand ~ */
function normalizePath(p: string): string {
  if (!p) return p
  if (p.startsWith("~")) return p.replace("~", process.env.HOME || process.env.USERPROFILE || "")
  return p
}

function ts(): string {
  const d = new Date()
  return cfg.timeZone === "utc" ? d.toISOString() : d.toLocaleString()
}

function prompt(): void {
  const cwd = process.cwd()
  rl.setPrompt(`${color.cyan("sh")} ${color.gray(cwd)} ${color.dim("> ")} `)
  rl.prompt()
}

function redact(s: string): string {
  if (!s) return s
  let out = s
  for (const m of masks) {
    if (!m) continue
    const esc = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const replacement = m.length <= 4 ? "***" : `${m.slice(0, 2)}***${m.slice(-2)}`
    out = out.replace(new RegExp(esc, "g"), replacement)
  }
  return out
}

function truncate(s: string, limit = cfg.maxOutputChars): string {
  if (!s) return ""
  const input = redact(s)
  if (input.length <= limit) return input
  const head = input.slice(0, Math.floor(limit * 0.8))
  const tail = input.slice(-Math.floor(limit * 0.2))
  return `${head}\n${color.dim("… [output truncated] …")}\n${tail}`
}

function printSection(title: string, body: string, ok = true): void {
  const bar = ok ? color.green("──") : color.red("──")
  console.log(`${bar} ${title} ${bar}`)
  if (body) console.log(body)
}

function printHelp(): void {
  console.log(
    [
      color.yellow("Meta-commands:"),
      ":help                show this help",
      ":timeout [ms]        set or show exec timeout (default 30000)",
      ":limit [chars]       set or show max printed chars for stdout/stderr",
      ":cwd | :pwd          print current working directory",
      ":cd <path>           change directory",
      ":env [KEY]           show env or a specific env var",
      ":mask <value>        add a redaction mask applied to outputs",
      ":unmask <value>      remove a redaction mask",
      ":masks               list active masks (redacted)",
      ":clear               clear the screen",
      ":exit | :quit        exit"
    ].join("\n")
  )
}

async function handleMetaCommand(line: string): Promise<boolean> {
  const [cmd, ...rest] = line.trim().split(/\s+/)
  switch (cmd) {
    case ":help": {
      printHelp()
      return true
    }
    case ":timeout": {
      if (!rest[0]) {
        console.log(`timeout is ${cfg.timeoutMs} ms`)
        return true
      }
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
      if (!rest[0]) {
        console.log(`max output is ${cfg.maxOutputChars} chars`)
        return true
      }
      const val = Number(rest[0])
      if (!Number.isFinite(val) || val < 1_000) {
        console.log(color.red("Provide a sane limit (>= 1000)"))
        return true
      }
      cfg.maxOutputChars = Math.floor(val)
      console.log(`max output set to ${cfg.maxOutputChars} chars`)
      return true
    }
    case ":cwd":
    case ":pwd": {
      console.log(process.cwd())
      return true
    }
    case ":cd": {
      const dest = normalizePath(rest.join(" "))
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
    case ":env": {
      const key = rest.join(" ")
      if (!key) {
        const keys = Object.keys(process.env).sort().slice(0, 200)
        console.log(keys.map(k => `${k}=${process.env[k] ?? ""}`).join("\n"))
      } else {
        console.log(`${key}=${process.env[key] ?? ""}`)
      }
      return true
    }
    case ":mask": {
      const val = rest.join(" ")
      if (!val) {
        console.log(color.red("Usage: :mask <value>"))
        return true
      }
      masks.add(val)
      console.log("mask added")
      return true
    }
    case ":unmask": {
      const val = rest.join(" ")
      if (!val) {
        console.log(color.red("Usage: :unmask <value>"))
        return true
      }
      const ok = masks.delete(val)
      console.log(ok ? "mask removed" : "mask not found")
      return true
    }
    case ":masks": {
      if (masks.size === 0) {
        console.log("[no masks]")
        return true
      }
      for (const m of masks) {
        const red = m.length <= 4 ? "***" : `${m.slice(0, 2)}***${m.slice(-2)}`
        console.log(red)
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

  const startedAt = Date.now()
  try {
    const { stdout, stderr } = await ops.run(cmd, { timeoutMs: cfg.timeoutMs })
    const took = Date.now() - startedAt
    if (stdout) printSection("Output", truncate(stdout), true)
    if (stderr) printSection("Errors", truncate(stderr), false)
    if (!stdout && !stderr) console.log(color.gray("[no output]"))
    console.log(color.gray(`[${ts()}] done in ${took} ms`))
  } catch (err: any) {
    const stdout = truncate(err?.stdout || "")
    const stderr = truncate(err?.stderr || err?.message || String(err) || "")
    console.error(color.red("Execution failed"))
    if (stdout) printSection("Partial output", stdout, false)
    if (stderr) printSection("Error message", stderr, false)
    console.log(color.gray(`[${ts()}] failed after ${Date.now() - startedAt} ms`))
  }
}

function cleanupAndExit(code: number): void {
  rl.close()
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
rl.on("line", async line => {
  await runOnce(line)
  prompt()
})
rl.on("close", () => {
  process.exit(0)
})

