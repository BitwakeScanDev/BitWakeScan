import * as tf from "@tensorflow/tfjs-node"
import { Trainer, TrainerOptions } from "./trainer"

export interface NeuroAgentOptions extends TrainerOptions {
  modelPath?: string            // directory for saving/loading model
  logLevel?: "silent" | "info" | "debug"
}

/**
 * NeuroAgent wraps training, saving/loading, and prediction
 * for a simple tf.LayersModel with robust validation and logging.
 */
export class NeuroAgent {
  private trainer: Trainer
  private model?: tf.LayersModel
  private readonly inputDim: number
  private readonly modelPath: string
  private readonly logLevel: "silent" | "info" | "debug"

  constructor(inputDim: number, opts: NeuroAgentOptions = {}) {
    this.inputDim = inputDim
    this.modelPath = opts.modelPath ?? "neuro-model"
    this.logLevel = opts.logLevel ?? "info"
    this.trainer = new Trainer(inputDim, opts)
  }

  private log(msg: string, level: "info" | "debug" = "info") {
    if (this.logLevel === "silent") return
    if (level === "debug" && this.logLevel !== "debug") return
    // eslint-disable-next-line no-console
    console[level === "debug" ? "debug" : "log"](`[NeuroAgent] ${msg}`)
  }

  /**
   * Train the model for given epochs and export to disk.
   */
  public async trainAndExport(epochs = 10): Promise<void> {
    this.log(`Starting training for ${epochs} epochs`, "info")
    this.model = await this.trainer.train({ epochs })
    this.log(`Training complete; saving to ${this.modelPath}`, "info")
    await this.trainer.save(this.modelPath)
  }

  /**
   * Load model from disk if not in memory.
   * If load fails, throws an error.
   */
  private async ensureModelLoaded(): Promise<tf.LayersModel> {
    if (this.model) return this.model
    this.log(`Loading model from ${this.modelPath}`, "info")
    try {
      this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`)
      this.log("Model loaded successfully", "debug")
      return this.model
    } catch (err) {
      throw new Error(
        `Failed to load model at "${this.modelPath}": ${(err as Error).message}`
      )
    }
  }

  /**
   * Predict on a batch of samples.
   * @param input 2D array of shape [batchSize][inputDim]
   * @returns 2D array of predictions
   */
  public async predict(input: number[][]): Promise<number[][]> {
    if (!Array.isArray(input) || input.length === 0) {
      throw new Error("Input must be a non-empty 2D array")
    }
    if (input.some(row => row.length !== this.inputDim)) {
      throw new Error(
        `Each input row must have length ${this.inputDim}; received lengths: ` +
        input.map(r => r.length).join(", ")
      )
    }

    const model = await this.ensureModelLoaded()
    const tensor = tf.tensor2d(input)
    this.log(`Running inference on batch of size ${input.length}`, "debug")

    try {
      const output = model.predict(tensor)
      if (Array.isArray(output)) {
        // multiple outputs
        const arrays = await Promise.all(output.map(t => (t as tf.Tensor).array()))
        return arrays as number[][]
      } else {
        // single output tensor
        const arr = (await (output as tf.Tensor).array()) as number[][]
        return arr
      }
    } finally {
      tensor.dispose()
    }
  }

  /**
   * Dispose loaded model from memory
   */
  public disposeModel(): void {
    if (this.model) {
      this.model.dispose()
      this.model = undefined
      this.log("Model disposed from memory", "debug")
    }
  }
}
