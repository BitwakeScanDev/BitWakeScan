import readline from "readline/promises"
import { stdin as input, stdout as output } from "node:process"
import Table from "cli-table3"
import { AssetPulseService } from "./assetPulseService"

async function main() {
  const rl = readline.createInterface({ input, output })
  try {
    // Prompt for mint address
    let mint = (await rl.question("Token mint to pulse: ")).trim()
    if (!mint) {
      console.error("❌ Mint address is required")
      process.exitCode = 1
      return
    }

    // Prompt for limit
    let limitInput = (await rl.question("Number of data points to fetch (default 50): "))
      .trim()
    let limit = Number(limitInput)
    if (limitInput && (isNaN(limit) || limit <= 0)) {
      console.error("❌ Invalid number for data points")
      process.exitCode = 1
      return
    }
    if (!limitInput) {
      limit = 50
    }

    const rpcUrl = process.env.SOLANA_RPC_ENDPOINT ||
      "https://api.mainnet-beta.solana.com"
    const service = new AssetPulseService(rpcUrl)

    console.log(`\nFetching last ${limit} pulses for mint ${mint}...\n`)
    const data = await service.fetchPulse(mint, limit)

    if (!data.length) {
      console.log("No pulse data returned.")
      return
    }

    // Build table
    const table = new Table({
      head: ["Timestamp", "Transfers", "Total Balance"].map(h => `\x1b[1m${h}\x1b[0m`),
      colWidths: [25, 12, 15],
    })

    for (const p of data) {
      table.push([
        new Date(p.timestamp).toISOString(),
        p.transferCount,
        p.totalBalance.toLocaleString(),
      ])
    }

    console.log(table.toString())
  } catch (err: any) {
    console.error("Error:", err.message || err)
    process.exitCode = 1
  } finally {
    rl.close()
  }
}

main()
