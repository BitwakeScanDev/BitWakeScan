import readline from "readline"
import { AssetPulseService } from "./assetPulseService"

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const rpcUrl = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com"
const service = new AssetPulseService(rpcUrl)

rl.question("Token mint to pulse: ", async (mint) => {
  try {
    const data = await service.fetchPulse(mint.trim(), 50)
    console.log("Timestamp\t\tTransfers\tTotal Balance")
    data.forEach(p => {
      console.log(`${new Date(p.timestamp).toISOString()}\t${p.transferCount}\t\t${p.totalBalance}`)
    })
  } catch (err: any) {
    console.error("Error:", err.message)
  } finally {
    rl.close()
  }
})
