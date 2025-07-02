import * as tf from "@tensorflow/tfjs-node"

export interface DataSet {
  features: tf.Tensor2D
  labels: tf.Tensor2D
}

export async function loadData(
  numSamples = 1000,
  numFeatures = 20
): Promise<DataSet> {
  const features = tf.randomNormal([numSamples, numFeatures])
  const sums = features.sum(1)
  const labels = sums.greater(0).toFloat().reshape([numSamples, 1])
  return { features, labels }
}
