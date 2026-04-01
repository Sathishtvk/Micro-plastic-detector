// microplastics_detection.js
// Synthetic microplastics-in-blood detection demo.

const WIDTH = 120;
const HEIGHT = 80;
const NOISE_LEVEL = 30;
const MICROPLASTIC_COUNT = 8;
const BLOOD_CELL_COUNT = 30;

function createEmptyGrid(width, height, value = 0) {
  const grid = new Array(height);
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(value);
  }
  return grid;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addCircle(grid, centerX, centerY, radius, intensity) {
  const height = grid.length;
  const width = grid[0].length;
  for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        grid[y][x] = clamp(grid[y][x] + intensity, 0, 255);
      }
    }
  }
}

function generateSyntheticBloodSample() {
  const grid = createEmptyGrid(WIDTH, HEIGHT, 50);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      grid[y][x] = clamp(grid[y][x] + Math.floor((Math.random() - 0.5) * NOISE_LEVEL), 0, 255);
    }
  }

  // Add blood cells as moderate dark circles.
  for (let i = 0; i < BLOOD_CELL_COUNT; i++) {
    const radius = 3 + Math.floor(Math.random() * 2);
    const cx = 10 + Math.floor(Math.random() * (WIDTH - 20));
    const cy = 10 + Math.floor(Math.random() * (HEIGHT - 20));
    addCircle(grid, cx, cy, radius, -10);
  }

  // Add microplastics as bright particles.
  for (let i = 0; i < MICROPLASTIC_COUNT; i++) {
    const radius = 2 + Math.floor(Math.random() * 3);
    const cx = 10 + Math.floor(Math.random() * (WIDTH - 20));
    const cy = 10 + Math.floor(Math.random() * (HEIGHT - 20));
    addCircle(grid, cx, cy, radius, 120);
  }

  return grid;
}

function smoothGrid(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const result = createEmptyGrid(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += grid[ny][nx];
            count += 1;
          }
        }
      }
      result[y][x] = Math.round(sum / count);
    }
  }
  return result;
}

function thresholdGrid(grid, threshold) {
  return grid.map(row => row.map(value => (value >= threshold ? 1 : 0)));
}

function labelComponents(binaryGrid) {
  const height = binaryGrid.length;
  const width = binaryGrid[0].length;
  const labelGrid = createEmptyGrid(width, height, 0);
  let nextLabel = 1;
  const labelMap = {};

  function floodFill(sx, sy, label) {
    const stack = [[sx, sy]];
    let area = 0;
    let minX = sx;
    let maxX = sx;
    let minY = sy;
    let maxY = sy;

    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (binaryGrid[y][x] !== 1) continue;
      if (labelGrid[y][x] !== 0) continue;
      labelGrid[y][x] = label;
      area += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }

    return { area, minX, maxX, minY, maxY };
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binaryGrid[y][x] === 1 && labelGrid[y][x] === 0) {
        const stats = floodFill(x, y, nextLabel);
        labelMap[nextLabel] = stats;
        nextLabel += 1;
      }
    }
  }

  return { labelGrid, labelMap, count: nextLabel - 1 };
}

function extractParticleFeatures(labelData) {
  return Object.entries(labelData.labelMap).map(([label, stats]) => {
    const width = stats.maxX - stats.minX + 1;
    const height = stats.maxY - stats.minY + 1;
    const aspectRatio = width / height;
    const compactness = stats.area / (width * height);
    return {
      label: Number(label),
      area: stats.area,
      width,
      height,
      aspectRatio: Math.max(aspectRatio, 1 / aspectRatio),
      compactness,
    };
  });
}

function classifyParticles(features) {
  return features.map(feature => {
    // Microplastics are small bright particles with moderate compactness.
    const isMicroplastic =
      feature.area >= 8 &&
      feature.area <= 45 &&
      feature.compactness >= 0.42 &&
      feature.aspectRatio <= 2.5;
    return { ...feature, isMicroplastic };
  });
}

function summarizeDetections(detections) {
  const microplastics = detections.filter(item => item.isMicroplastic);
  const bloodCells = detections.filter(item => !item.isMicroplastic);
  return {
    totalCandidates: detections.length,
    microplasticCount: microplastics.length,
    bloodCellCandidates: bloodCells.length,
    microplastics,
  };
}

function printReport(summary) {
  console.log('Microplastics Detection Report');
  console.log('--------------------------------');
  console.log(`Total candidate particles: ${summary.totalCandidates}`);
  console.log(`Detected microplastic particles: ${summary.microplasticCount}`);
  console.log(`Other candidate particles: ${summary.bloodCellCandidates}`);
  console.log('Detected microplastics details:');
  summary.microplastics.forEach(item => {
    console.log(` - label ${item.label}: area=${item.area}, aspectRatio=${item.aspectRatio.toFixed(2)}, compactness=${item.compactness.toFixed(2)}`);
  });
}

function runDetectionPipeline() {
  const rawSample = generateSyntheticBloodSample();
  const cleanedSample = smoothGrid(rawSample);
  const thresholded = thresholdGrid(cleanedSample, 110);
  const labelData = labelComponents(thresholded);
  const features = extractParticleFeatures(labelData);
  const detections = classifyParticles(features);
  const summary = summarizeDetections(detections);
  printReport(summary);
}

runDetectionPipeline();
