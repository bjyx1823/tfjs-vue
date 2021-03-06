import * as tf from "@tensorflow/tfjs";

/**
  *  归一化
  */
const normalize = (s: tf.Tensor2D) => tf.tidy(() => s.sub(s.min()).div(s.max().sub(s.min())))

/**
  *  反归一化
  */
const unNormalize = (s: any, minS: any, maxS: any) => tf.tidy(() => s.mul(maxS.sub(minS)).add(minS))

/**
 * 分离点坐标为xs,ys  
 */
const splitPoint = (s: number[][]) => {
  let xs = s.map(d => [d[0], d[1]])
  let ys = s.map(d => d[2])
  return [xs, ys]
}

/**
 * 合并生成点坐标为[x,y]
 */
const combinePoint = (xs: number[], preds: number[]) => Array.from(preds).map((val, i) => {
  let tmp = [];
  /** 依次排入xyz坐标 */
  tmp.push(xs[2 * i]);
  tmp.push(xs[2 * i + 1]);
  tmp.push(val);
  return tmp;
})

/**
 * createModel
 */
export const createModel = () => {
  /** Define model, add one layer after another, which do tidy automatically. */
  let model = tf.sequential();
  /** Here is the input layer, must has specify inputshape */
  model.add(tf.layers.dense({ units: 2, inputShape: [2] }));
  /** 6层非线性层 */
  let layerCount = 6
  for (let index = 0; index < layerCount; index++) {
    /* Here are any hidden layers  */
    model.add(tf.layers.dense({ units: 50, activation: 'relu' }))
  }
  /** Output layer */
  model.add(tf.layers.dense({ units: 1, }))

  return model
}

/**
 * 准备数据 规范化  
 * 先转化为张量 后进行归一化  
 * 并保留范围信息用于预测数据的处理
 */
export const convertToTensor = (data: number[][]) => tf.tidy(() => {
  /** 打乱数据 */
  tf.util.shuffle(data);

  /** 数组对里提取分离x，y */
  const [inputs, labels] = splitPoint(data)

  /** 形状要符合长度 */
  const inputTensor = tf.tensor2d(inputs, [inputs.length, 2])
  const labelTensor = tf.tensor2d(labels, [labels.length, 1])

  let t = {} as any;

  /** 归一化 并保存范围信息用于以后反归一化 */
  t.inputMax = inputTensor.max()
  t.inputMin = inputTensor.min()
  t.labelMax = labelTensor.max()
  t.labelMin = labelTensor.min()
  t.inputs = normalize(inputTensor)
  t.labels = normalize(labelTensor)

  return t
})

/**
* 训练模型
*/
export const trainModel = async ({ model, normalizationData, config }: any) => {
  try {
    /** 配置优化器 损失函数 */
    model.compile({
      optimizer: tf.train.adam(),
      loss: tf.losses.meanSquaredError,
      metrics: ['mse']
    })
    let { inputs, labels } = normalizationData

    /** 训练 调整所有可变 */
    let t = await model.fit(inputs, labels, config)

    return t
  } catch (error) {
    console.log('[E] [trainModel]: ', error);
  }
}

/**
 * 测试模型
 */
export const testModel = (model: any, normalizationData: any) => {
  const { inputMax, inputMin, labelMax, labelMin } = normalizationData

  const [xs, preds] = tf.tidy(() => {
    /** 生成测试数值 */
    // const xs = tf.linspace(0, 1, 100)
    let scale = 30
    /* 横坐标取20个均分 */
    let x = Array.from({ length: scale }, (val, i) => i).map(d => d / scale)
    let fresh = []
    for (let i = 0; i < scale; i++) {
      for (let j = 0; j < scale; j++) {
        /* 每个点的x，y值 */
        fresh.push(x[i])
        fresh.push(x[j])
      }
    }
    /* 生成scale*scale的均匀散点  */
    let xs = tf.tensor2d(fresh, [scale * scale, 2])
    /** 控制形状并预测结果 */
    const preds = model.predict(xs)

    /** 反归一化 */
    const unNormXs = unNormalize(xs, inputMin, inputMax)
    const unNormPreds = unNormalize(preds, labelMin, labelMax)

    /** 获取实际数值返回 */
    return [unNormXs.dataSync(), unNormPreds.dataSync()]
  })

  return combinePoint(xs, preds)
}
