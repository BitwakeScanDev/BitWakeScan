
import readline from "readline"
import { StreamScope } from "./streamScope"

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const rpc = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com"
const scope = new StreamScope(rpc)

rl.question("Token mint to scope: ", async mint => {
  try {
    const points = await scope.stream(mint.trim(), 50)
    console.log("Timestamp\t\tTransfers")
    points.forEach(p =>
      console.log(`${new Date(p.timestamp).toISOString()}\t${p.transferCount}`)
    )
  } catch (e: any) {
    console.error("Error:", e.message)
  } finally {
    rl.close()
  }
})
