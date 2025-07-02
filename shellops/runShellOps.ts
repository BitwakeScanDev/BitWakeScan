import readline from "readline"
import { ShellOps } from "./ShellOps"

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ops = new ShellOps()

rl.question("Enter shell command to execute: ", async (cmd) => {
  try {
    const { stdout, stderr } = await ops.run(cmd.trim())
    console.log("Output:\n", stdout)
    if (stderr) console.error("Errors:\n", stderr)
  } catch ({ stdout, stderr }) {
    console.error("Execution failed.")
    console.log("Partial output:\n", stdout)
    console.error("Error message:\n", stderr)
  } finally {
    rl.close()
  }
})
