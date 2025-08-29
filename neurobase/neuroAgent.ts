import * as tf from "@tensorflow/tfjs-node"
import { promises as fs } from "fs"
import * as path from "path"
import { Trainer, TrainerOptions } from "./trainer"

export interface NeuroAgentOptions extends TrainerOptions {
  /** Directory for saving/loading model */
  modelPath?: string
  /** Log level */
  logLevel?: "silent" | "info" | "debug"
}

export interface PredictOptions {
  /** Apply softmax to the final tensor (useful for classifiers) */
  softmax?: boolean
}

type LogLevel = "silent" | "info" | "debug"

export class NeuroAgent {
  private trainer: Trainer
  private model?: tf.LayersModel
  private readonly inputDim: number
  private readonly modelPath: string
  private logLevel: LogLevel

  // Prevent duplicate concurrent loads
  private loadingPromise: Promise<tf.LayersModel> | null = null

  constructor(inputDim: number, opts: NeuroAgentOptions = {}) {
    this.inputDim = inputDim
    this.modelPath = opts.modelPath ?? "neuro-model"
    this.logLevel = opts.logLevel ?? "info"
    this.trainer = new Trainer(inputDim, opts)
  }

  /** Change log level at runtime */
  public setLogLevel(level: LogLevel) {
    this.logLevel = level
  }

  private log(msg: string, level: "info" | "debug" = "info") {
    if (this.logLevel === "silent") return
    if (level === "debug" && this.logLevel !== "debug") return
    // eslint-disable-next-line no-console
    const tag = level === "debug" ? "debug" : "log"
    console[tag](`[NeuroAgent] ${msg}`)
  }

  /** Ensure model directory exists */
  private async ensureDirExists(dir: string) {
    await fs.mkdir(dir, { recursive: true })
  }

  /** Quick check: is there a saved model on disk? */
  public async hasSavedModel(): Promise<boolean> {
    try {
      const p = path.join(this.modelPath, "model.json")
      await fs.access(p)
      return true
    } catch {
      return false
    }
  }

  /** Persist the currently loaded model to disk */
  public async save(): Promise<void> {
    if (!this.model) throw new Error("No model in memory to save")
    await this.ensureDirExists(this.modelPath)
    this.log(`Saving model to ${this.modelPath}`, "info")
    await this.model.save(`file://${this.modelPath}`)
  }

  /** Force-load model from disk (replacing in-memory model) */
  public async load(): Promise<tf.LayersModel> {
    this.log(`Loading model from ${this.modelPath}`, "info")
    if (!(await this.hasSavedModel())) {
      throw new Error(`Model not found at ${this.modelPath}/model.json`)
    }
    const mdl = await tf.loadLayersModel(`file://${this.modelPath}/model.json`)
    this.model = mdl
    this.log("Model loaded successfully", "debug")
    return mdl
  }

  /** Attach an already-built LayersModel (warm start / custom arch) */
  public attachModel(model: tf.LayersModel): void {
    this.model = model
    this.log("Model attached to agent (in-memory)", "debug")
  }

  /** Train via Trainer, then export to disk */
  public async trainAndExport(epochs = 10): Promise<void> {
    this.log(`Starting training for ${epochs} epochs`, "info")
    this.model = await this.trainer.train({ epochs })
    await this.ensureDirExists(this.modelPath)
    this.log(`Training complete; saving to ${this.modelPath}`, "info")
    await this.trainer.save(this.modelPath)
  }

  /**
   * Load model from disk if not already in memory.
   * Collapses concurrent load calls into a single in-flight promise.
   */
  private async ensureModelLoaded(): Promise<tf.LayersModel> {
    if (this.model) return this.model
    if (this.loadingPromise) return this.loadingPromise

    this.loadingPromise = (async () => {
      this.log(`Loading model from ${this.modelPath}`, "info")
      try {
        const mdl = await tf.loadLayersModel(`file://${this.modelPath}/model.json`)
        this.model = mdl
        this.log("Model loaded successfully", "debug")
        return mdl
      } catch (err) {
        throw new Error(
          `Failed to load model at "${this.modelPath}": ${(err as Error).message}`
        )
      } finally {
        // Allow subsequent loads if this one failed
        this.loadingPromise = null
      }
    })()

    return this.loadingPromise
  }

  /** Human-friendly summary (or logs it in debug) */
  public summary(): string {
    if (!this.model) return "No model loaded"
    const lines: string[] = []
    // tfjs-node doesn't have .summary() printing hook, so capture layers
    lines.push(`Model: ${this.model.name ?? "(unnamed)"} with ${this.model.layers.length} layer(s)`)
    for (const [i, l] of this.model.layers.entries()) {
      lines.push(`  [${i}] ${l.name}: ${l.getClassName()} | outputShape=${JSON.stringify(l.outputShape)}`)
    }
    const txt = lines.join("\n")
    this.log(`\n${txt}`, "debug")
    return txt
  }

  /**
   * Predict on a batch of samples.
   * - Accepts 1D single sample or 2D batch
   * - Validates shapes and finite numbers
   * - Optionally applies softmax
   * @returns 2D array of predictions [batchSize][outDim]
   */
  public async predict(input: number[] | number[][], opts: PredictOptions = {}): Promise<number[][]> {
    const batch: number[][] = Array.isArray(input[0])
      ? (input as number[][])
      : [input as number[]]

    if (batch.length === 0) throw new Error("Input must be a non-empty 1D or 2D array")
    if (batch.some(row => row.length !== this.inputDim)) {
      throw new Error(
        `Each input row must have length ${this.inputDim}; received lengths: ` +
          batch.map(r => r.length).join(", ")
      )
    }
    // numeric sanity
    for (let i = 0; i < batch.length; i++) {
      for (let j = 0; j < batch[i].length; j++) {
        const v = batch[i][j]
        if (!Number.isFinite(v)) throw new Error(`Non-finite value at [${i},${j}]: ${v}`)
      }
    }

    const model = await this.ensureModelLoaded()
    const x = tf.tensor2d(batch)
    this.log(`Running inference on batch of size ${batch.length}`, "debug")

    try {
      let y = model.predict(x) as tf.Tensor | tf.Tensor[]
      if (Array.isArray(y)) {
        // If model has multiple outputs, take first by default (common case); apply softmax per-tensor otherwise.
        const arrs = await Promise.all(
          y.map(t => {
            const tt = opts.softmax ? tf.softmax(t) : t
            return tt.array() as Promise<number[][]>
          })
        )
        // If multiple outputs, return the first (or merge as needed)
        return arrs[0]
      } else {
        const out = opts.softmax ? tf.softmax(y) : y
        const arr = (await out.array()) as number[] | number[][]
        // Ensure 2D
        return Array.isArray(arr[0]) ? (arr as number[][]) : [arr as number[]]
      }
    } finally {
      x.dispose()
    }
  }

  /** Convenience wrapper for a single sample */
  public async predictOne(input: number[], opts: PredictOptions = {}): Promise<number[]> {
    const out2d = await this.predict(input, opts)
    return out2d[0]
  }

  /** Quick micro-benchmark for inference */
  public async benchmarkPredict(sample: number[], repeats = 50): Promise<{ msPerPred: number }> {
    if (sample.length !== this.inputDim) {
      throw new Error(`Sample length ${sample.length} must equal inputDim ${this.inputDim}`)
    }
    await this.ensureModelLoaded()
    // Warm-up
    await this.predictOne(sample)
    const t0 = process.hrtime.bigint()
    for (let i = 0; i < repeats; i++) {
      await this.predictOne(sample)
    }
    const dtMs = Number(process.hrtime.bigint() - t0) / 1e6
    const msPerPred = dtMs / repeats
    this.log(`Benchmark: ~${msPerPred.toFixed(3)} ms/pred over ${repeats} runs`, "info")
    return { msPerPred }
  }

  /** Dispose loaded model from memory */
  public disposeModel(): void {
    if (this.model) {
      this.model.dispose()
      this.model = undefined
      this.log("Model disposed from memory", "debug")
    }
  }
}
