const sharp = require('sharp');
const Jimp = require('jimp');

// console.log('--- Inspecting Jimp module ---');
// console.log('typeof Jimp:', typeof Jimp);
// if (Jimp) {
//   console.log('Jimp is an object/function. Keys:', Object.keys(Jimp));
//   console.log('typeof Jimp.read:', typeof Jimp.read);
//   if (typeof Jimp.read !== 'function') {
//     console.log('Jimp.read is NOT a function!');
//     if (Jimp.default && typeof Jimp.default.read === 'function') {
//       console.log('However, Jimp.default.read IS a function. This might indicate an ES Module / CommonJS interop issue or a problem with the Jimp export structure.');
//     } else {
//       console.log('Jimp.default.read is also not a function or Jimp.default is not defined.');
//     }
//   }
// } else {
//   console.log('Jimp is null or undefined!');
// }
// console.log('-----------------------------');

// --- 1. Color Feature Extraction ---
async function getColorHistogram(imagePath, bins = 16) {
  console.log(`[getColorHistogram] Processing: ${imagePath}`);
  try {
    const image = await Jimp.Jimp.read(imagePath); // Changed to Jimp.Jimp.read
    const histogram = new Array(bins * bins * bins).fill(0);
    const binSize = 256 / bins;

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = Math.floor(this.bitmap.data[idx + 0] / binSize);
      const g = Math.floor(this.bitmap.data[idx + 1] / binSize);
      const b = Math.floor(this.bitmap.data[idx + 2] / binSize);
      histogram[r * bins * bins + g * bins + b]++;
    });

    const totalPixels = image.bitmap.width * image.bitmap.height;
    console.log(`[getColorHistogram] Image: ${imagePath}, Total Pixels: ${totalPixels}`);
    if (totalPixels === 0) {
      console.warn(`[getColorHistogram] Image: ${imagePath} has 0 total pixels. Returning zero array.`);
      return new Array(bins * bins * bins).fill(0);
    }
    
    // Log some raw histogram counts before normalization
    // console.log(`[getColorHistogram] Image: ${imagePath}, Raw histogram (first 10): ${histogram.slice(0, 10).join(', ')}`);

    const normalizedHistogram = histogram.map(count => count / totalPixels);
    // console.log(`[getColorHistogram] Image: ${imagePath}, Normalized histogram (first 10): ${normalizedHistogram.slice(0, 10).map(f => f.toFixed(5)).join(', ')}`);
    
    // Check for NaN in normalizedHistogram
    if (normalizedHistogram.some(isNaN)) {
        console.error(`[getColorHistogram] Image: ${imagePath} - NaN found in normalizedHistogram. Raw histogram (first 10): ${histogram.slice(0,10).join(', ')}`);
        // Potentially return zeros or try to fix
        return new Array(bins * bins * bins).fill(0);
    }
    console.log(`[getColorHistogram] Successfully processed: ${imagePath}. First 5 normalized: ${normalizedHistogram.slice(0,5).join(', ')}`);
    return normalizedHistogram;
  } catch (error) {
    console.error(`[getColorHistogram] Error for ${imagePath}:`, error);
    return new Array(bins * bins * bins).fill(0); 
  }
}

// --- 2. Shape Feature Extraction (Using Jimp) ---
async function getShapeFeatures(imagePath, thresholdValue = 128) {
  console.log(`[getShapeFeatures] Processing: ${imagePath}`);
  try {
    const image = await Jimp.Jimp.read(imagePath); // Changed to Jimp.Jimp.read
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    if (width === 0 || height === 0) {
      return [0, 0, 0]; // Default for empty image
    }

    // 1. Aspect Ratio
    const aspectRatio = width / height;

    // 2. Normalized Centroid
    const grayscaleImage = image.clone().greyscale(); // Corrected: .greyscale() and clone image before modification

    let sumX = 0;
    let sumY = 0;
    let objectPixelCount = 0;

    grayscaleImage.scan(0, 0, width, height, function (x, y, idx) { // Use grayscaleImage here
      const red = this.bitmap.data[idx + 0]; // In grayscale, R=G=B
      if (red > thresholdValue) { // Simple thresholding
        sumX += x;
        sumY += y;
        objectPixelCount++;
      }
    });

    let normalizedCentroidX = 0;
    let normalizedCentroidY = 0;

    if (objectPixelCount > 0) {
      const centroidX = sumX / objectPixelCount;
      const centroidY = sumY / objectPixelCount;
      normalizedCentroidX = centroidX / width;
      normalizedCentroidY = centroidY / height;
    }
    
    // Ensure features are numbers and handle potential NaN/Infinity
    const features = [
        isFinite(aspectRatio) ? aspectRatio : 0,
        isFinite(normalizedCentroidX) ? normalizedCentroidX : 0,
        isFinite(normalizedCentroidY) ? normalizedCentroidY : 0
    ];
    console.log(`[getShapeFeatures] Image: ${imagePath}, Features: [${features.join(', ')}]`);
    return features;

  } catch (error) {
    console.error(`[getShapeFeatures] Error for ${imagePath}:`, error);
    return [0, 0, 0];
  }
}

// --- 3. Texture Feature Extraction (Using Jimp) ---
async function getTextureFeatures(imagePath) {
  console.log(`[getTextureFeatures] Processing: ${imagePath}`);
  try {
    const image = await Jimp.Jimp.read(imagePath); // Changed to Jimp.Jimp.read
    const grayscaleImage = image.clone().greyscale(); // Corrected: .greyscale() and clone image before modification

    const width = grayscaleImage.bitmap.width; // Use grayscaleImage here
    const height = grayscaleImage.bitmap.height; // Use grayscaleImage here
    const totalPixels = width * height;

    if (totalPixels === 0) {
      return [0]; // Default for empty image
    }

    let sumOfPixels = 0;
    const pixelValues = [];

    grayscaleImage.scan(0, 0, width, height, function (x, y, idx) { // Use grayscaleImage here
      const pixelValue = this.bitmap.data[idx + 0]; // In grayscale, R=G=B
      pixelValues.push(pixelValue);
      sumOfPixels += pixelValue;
    });

    const mean = sumOfPixels / totalPixels;

    let sumOfSquaredDifferences = 0;
    for (const value of pixelValues) {
      sumOfSquaredDifferences += Math.pow(value - mean, 2);
    }

    const variance = sumOfSquaredDifferences / totalPixels;
    const standardDeviation = Math.sqrt(variance);

    // Ensure feature is a number and handle potential NaN/Infinity
    const feature = isFinite(standardDeviation) ? standardDeviation : 0;
    console.log(`[getTextureFeatures] Image: ${imagePath}, Feature: [${feature}]`);
    return [feature];

  } catch (error) {
    console.error(`[getTextureFeatures] Error for ${imagePath}:`, error);
    return [0];
  }
}

// --- 4. Combine Features ---
async function extractFeatures(imagePath) {
  console.log(`[extractFeatures] Processing: ${imagePath}`);
  try {
    const colorHistogram = await getColorHistogram(imagePath);
    const shapeFeatures = await getShapeFeatures(imagePath);
    const textureFeatures = await getTextureFeatures(imagePath);

    // Combine all features into a single vector if needed, or keep them separate
    // For now, let's assume they are combined later or used separately by the similarity function
    const combined_vector = [...colorHistogram, ...shapeFeatures, ...textureFeatures];
    console.log(`[extractFeatures] Image: ${imagePath}, Combined vector length: ${combined_vector.length}, First 5 color: ${colorHistogram.slice(0,5).join(', ')}, Shape: ${shapeFeatures.join(', ')}, Texture: ${textureFeatures.join(', ')}`);

    return {
      colorHistogram,
      shapeFeatures,
      textureFeatures,
      combined_vector // Make sure this is what process_dataset.js expects
    };
  } catch (error) {
    console.error(`Error in extractFeatures for ${imagePath}:`, error);
    throw error;
  }
}

// --- 5. Calculate Similarity (using Cosine Similarity) ---
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0; // Or throw an error, or handle as appropriate
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (normA * normB);
}

function calculateSimilarity(features1, features2) {
  if (!features1 || !features2 || !features1.combined_vector || !features2.combined_vector) {
    console.warn('Cannot calculate similarity: combined_vector missing from one or both features.');
    return 0;
  }
  return cosineSimilarity(features1.combined_vector, features2.combined_vector);
}

module.exports = { extractFeatures, calculateSimilarity };
