import { exec } from "child_process"

export class ShellOps {
  constructor(private readonly cwd: string = process.cwd()) {}

  run(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.cwd }, (error, stdout, stderr) => {
        if (error) {
          return reject({ stdout, stderr: error.message })
        }
        resolve({ stdout, stderr })
      })
    })
  }
}
