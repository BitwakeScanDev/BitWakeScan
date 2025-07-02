import { BlobServiceClient, ContainerClient } from "@azure/storage-blob"

export class StorixClient {
  private container: ContainerClient

  constructor(connectionString: string, containerName: string) {
    const service = BlobServiceClient.fromConnectionString(connectionString)
    this.container = service.getContainerClient(containerName)
  }

  async upload(key: string, content: Buffer | string): Promise<void> {
    const blob = this.container.getBlockBlobClient(key)
    await blob.upload(content, Buffer.byteLength(content as string))
  }

  async download(key: string): Promise<Buffer> {
    const blob = this.container.getBlobClient(key)
    const resp = await blob.download()
    const chunks: Buffer[] = []
    for await (const chunk of resp.readableStreamBody!) {
      chunks.push(chunk as Buffer)
    }
    return Buffer.concat(chunks)
  }
}
