import readline from "readline"
import { TaskManager } from "./TaskManager"

const manager = new TaskManager()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function menu() {
  console.log(`
1) List tasks
2) Create task
3) Remove task
4) Exit
`)
  rl.question("Choose: ", handle)
}

async function handle(choice: string) {
  switch (choice.trim()) {
    case "1":
      console.table(manager.list())
      break
    case "2":
      rl.question("Title: ", title => {
        rl.question("Payload (JSON, optional): ", json => {
          let payload: any
          try { payload = json.trim() ? JSON.parse(json) : undefined } catch { payload = json }
          const task = manager.create(title.trim(), payload)
          console.log("Created:", task)
          menu()
        })
      })
      return
    case "3":
      rl.question("Task ID: ", id => {
        const ok = manager.remove(id.trim())
        console.log(ok ? "Removed" : "Not found")
        menu()
      })
      return
    case "4":
      rl.close()
      return
    default:
      console.log("Invalid choice")
  }
  menu()
}

menu()
