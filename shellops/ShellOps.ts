import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export class ShellOps {
  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Executes a shell command in the given working directory.
   * Automatically trims stdout/stderr and handles errors gracefully.
   */
  async run(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.cwd, shell: "/bin/bash" })
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim()
      }
    } catch (error: any) {
      return {
        stdout: error.stdout?.toString().trim() || "",
        stderr: error.stderr?.toString().trim() || error.message || "Unknown error"
      }
    }
  }
}
