
import fetch from "node-fetch"

export interface Packet {
  id: string
  timestamp: number
  payload: Record<string, any>
}

export class SendPack {
  constructor(private endpoint: string) {}

  async send(packet: Packet): Promise<{ success: boolean; status: number }> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet)
    })
    return { success: res.ok, status: res.status }
  }

  create(id: string, payload: Record<string, any>): Packet {
    return { id, timestamp: Date.now(), payload }
  }
}
