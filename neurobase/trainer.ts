
import * as tf from "@tensorflow/tfjs-node"
import { DataSet, loadData } from "./dataLoader"
import { createModel } from "./neuroModel"

export interface TrainConfig {
  epochs?: number
  batchSize?: number
  validationSplit?: number
}


export class Trainer {
  private model: tf.LayersModel

  constructor(inputDim: number) {
    this.model = createModel(inputDim)
  }

  async train(config: TrainConfig = {}): Promise<tf.LayersModel> {
    const { features, labels } = await loadData()
    const { epochs = 10, batchSize = 32, validationSplit = 0.1 } = config
    await this.model.fit(features, labels, {
      epochs,
      batchSize,
      validationSplit,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}/${epochs}  loss=${logs!.loss!.toFixed(4)}  acc=${logs!.acc!.toFixed(4)}`)
        }
      }
    })
    return this.model
  }

  async save(path: string): Promise<void> {
    await this.model.save(`file://${path}`)
    console.log(`Model saved to ${path}`)
  }
}
