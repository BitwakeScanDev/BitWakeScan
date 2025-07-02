
import * as tf from "@tensorflow/tfjs-node"
import { Trainer } from "./trainer"

export class NeuroAgent {
  private trainer: Trainer
  private model?: tf.LayersModel

  constructor(inputDim: number) {
    this.trainer = new Trainer(inputDim)
  }

  async trainAndExport(epochs = 10, savePath = "neuro-model"): Promise<void> {
    this.model = await this.trainer.train({ epochs })
    await this.trainer.save(savePath)
  }

  async predict(input: number[][]): Promise<number[]> {
    if (!this.model) {
      this.model = await tf.loadLayersModel(`file://neuro-model/model.json`)
    }
    const tensor = tf.tensor2d(input)
    const output = this.model.predict(tensor) as tf.Tensor
    const data = await output.array() as number[][]
    return data.map(d => d[0])
  }
}
