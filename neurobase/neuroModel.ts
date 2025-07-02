import * as tf from "@tensorflow/tfjs-node"

/**
 * Builds a simple feedforward neural network for binary classification.
 */
export function createModel(inputDim: number = 20): tf.LayersModel {
  const model = tf.sequential()
  model.add(tf.layers.dense({ units: 64, activation: "relu", inputShape: [inputDim] }))
  model.add(tf.layers.dense({ units: 64, activation: "relu" }))
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }))
  model.compile({
    optimizer: tf.train.adam(1e-3),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"]
  })
  return model
}
