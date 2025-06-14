"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccuracyEvaluator = void 0;
class AccuracyEvaluator {
    static evaluate(predictions, groundTruth) {
        const truthMap = new Map(groundTruth.map(gt => [gt.fieldName, gt]));
        const validPredictions = predictions.filter(p => truthMap.has(p.fieldName));
        if (validPredictions.length === 0) {
            throw new Error('No matching predictions found for ground truth');
        }
        const confusionMatrix = this.buildConfusionMatrix(validPredictions, truthMap);
        const typeSpecificMetrics = this.calculateTypeSpecificMetrics(confusionMatrix);
        const overallMetrics = this.calculateOverallMetrics(typeSpecificMetrics);
        return {
            ...overallMetrics,
            confusionMatrix,
            typeSpecificMetrics
        };
    }
    static evaluateMultiple(benchmarkCases, inferenceFunction) {
        return Promise.all(benchmarkCases.map(async (benchmarkCase) => {
            const predictions = await inferenceFunction(benchmarkCase.dataset);
            return this.evaluate(predictions, benchmarkCase.groundTruth);
        }));
    }
    static compareConfidence(predictions, groundTruth) {
        const truthMap = new Map(groundTruth.map(gt => [gt.fieldName, gt]));
        const validPredictions = predictions.filter(p => truthMap.has(p.fieldName));
        let correctHighConf = 0, correctLowConf = 0;
        let incorrectHighConf = 0, incorrectLowConf = 0;
        let correctConfidenceSum = 0, incorrectConfidenceSum = 0;
        let correctCount = 0, incorrectCount = 0;
        const confidenceThreshold = 0.7;
        for (const prediction of validPredictions) {
            const truth = truthMap.get(prediction.fieldName);
            const isCorrect = truth?.actualType === prediction.inferredType;
            const isHighConfidence = prediction.confidence >= confidenceThreshold;
            if (isCorrect) {
                correctCount++;
                correctConfidenceSum += prediction.confidence;
                if (isHighConfidence)
                    correctHighConf++;
                else
                    correctLowConf++;
            }
            else {
                incorrectCount++;
                incorrectConfidenceSum += prediction.confidence;
                if (isHighConfidence)
                    incorrectHighConf++;
                else
                    incorrectLowConf++;
            }
        }
        return {
            correctHighConfidence: correctHighConf,
            correctLowConfidence: correctLowConf,
            incorrectHighConfidence: incorrectHighConf,
            incorrectLowConfidence: incorrectLowConf,
            averageConfidenceCorrect: correctCount > 0 ? correctConfidenceSum / correctCount : 0,
            averageConfidenceIncorrect: incorrectCount > 0 ? incorrectConfidenceSum / incorrectCount : 0
        };
    }
    static buildConfusionMatrix(predictions, truthMap) {
        const allTypes = [
            'string', 'number', 'boolean', 'date', 'email', 'url', 'phone',
            'json', 'array', 'object', 'null', 'undefined', 'mixed'
        ];
        const matrix = {};
        for (const actualType of allTypes) {
            matrix[actualType] = {};
            for (const predictedType of allTypes) {
                matrix[actualType][predictedType] = 0;
            }
        }
        for (const prediction of predictions) {
            const truth = truthMap.get(prediction.fieldName);
            if (truth) {
                matrix[truth.actualType][prediction.inferredType]++;
            }
        }
        return {
            matrix,
            totalPredictions: predictions.length
        };
    }
    static calculateTypeSpecificMetrics(confusionMatrix) {
        const metrics = {};
        const { matrix } = confusionMatrix;
        for (const actualType of Object.keys(matrix)) {
            let truePositives = matrix[actualType][actualType] || 0;
            let falsePositives = 0;
            let falseNegatives = 0;
            for (const predictedType of Object.keys(matrix[actualType])) {
                if (predictedType !== actualType) {
                    falseNegatives += matrix[actualType][predictedType];
                }
            }
            for (const otherActualType of Object.keys(matrix)) {
                if (otherActualType !== actualType) {
                    falsePositives += matrix[otherActualType][actualType] || 0;
                }
            }
            const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
            const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
            const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
            metrics[actualType] = {
                truePositives,
                falsePositives,
                falseNegatives,
                precision,
                recall,
                f1Score
            };
        }
        return metrics;
    }
    static calculateOverallMetrics(typeMetrics) {
        const metrics = Object.values(typeMetrics);
        const totalTP = metrics.reduce((sum, m) => sum + m.truePositives, 0);
        const totalFP = metrics.reduce((sum, m) => sum + m.falsePositives, 0);
        const totalFN = metrics.reduce((sum, m) => sum + m.falseNegatives, 0);
        const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
        const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
        const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
        const accuracy = totalTP / (totalTP + totalFP + totalFN);
        return { precision, recall, f1Score, accuracy };
    }
}
exports.AccuracyEvaluator = AccuracyEvaluator;
//# sourceMappingURL=accuracy-evaluator.js.map