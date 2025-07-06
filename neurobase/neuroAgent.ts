import * as tf from "@tensorflow/tfjs-node"
import { Trainer } from "./trainer"

export class NeuroAgent {
  private trainer: Trainer
  private model?: tf.LayersModel
  private readonly inputDim: number
  private readonly defaultModelPath: string

  constructor(inputDim: number, modelPath = "neuro-model") {
    this.inputDim = inputDim
    this.trainer = new Trainer(inputDim)
    this.defaultModelPath = modelPath
  }

  async trainAndExport(epochs = 10): Promise<void> {
    this.model = await this.trainer.train({ epochs })
    await this.trainer.save(this.defaultModelPath)
  }

  private async ensureModelLoaded(): Promise<tf.LayersModel> {
    if (!this.model) {
      try {
        this.model = await tf.loadLayersModel(`file://${this.defaultModelPath}/model.json`)
      } catch (error) {
        throw new Error(`Model could not be loaded from "${this.defaultModelPath}": ${String(error)}`)
      }
    }
    return this.model
  }

  async predict(input: number[][]): Promise<number[]> {
    if (!Array.isArray(input) || input.length === 0 || input[0].length !== this.inputDim) {
      throw new Error(`Invalid input shape: expected ${this.inputDim} features per sample`)
    }

    const model = await this.ensureModelLoaded()
    const tensor = tf.tensor2d(input)

    try {
      const output = model.predict(tensor) as tf.Tensor
      const result = await output.array() as number[][]
      return result.map(r => r[0])
    } finally {
      tensor.dispose()
    }
  }
}
