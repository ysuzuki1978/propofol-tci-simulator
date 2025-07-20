/**
 * Advanced Protocol Engine for Remimazolam TCI TIVA V4.2
 * 高度Step-downプロトコール最適化エンジン
 * 
 * Features:
 * - Context7 Math.NET Numerics Enhanced Algorithm
 * - Sophisticated threshold-based step-down protocol
 * - Performance evaluation metrics (Target Accuracy, Stability Index, Convergence Time)
 * - Multiple optimization strategies with clinical validation
 * - Real-time adjustment recommendations
 */

class AdvancedProtocolEngine {
    constructor() {
        this.patient = null;
        this.pkParams = null;
        this.settings = {
            targetCe: 3.0,                 // Appropriate for propofol
            upperThresholdRatio: 1.2,      // 120% of target
            reductionFactor: 0.70,         // 70% of current rate (30% reduction)
            timeStep: 0.1,                 // 0.1 minute precision
            simulationDuration: 360,       // 6 hours extended simulation
            targetReachTime: 20,           // 20 minutes to target
            adjustmentInterval: 5.0,       // 5 minutes minimum between adjustments
            minimumRate: 0.1,              // Minimum infusion rate mg/hr
            convergenceThreshold: 0.05,    // ±5% for convergence detection
            
            // New multi-point maintenance protocol settings
            maintenancePoints: [30, 60, 90, 120], // Time points to maintain target (minutes)
            maxAdjustmentsPerHour: 3,      // Maximum 2-3 adjustments per hour
            maintenanceTolerance: 0.1,     // ±10% tolerance for maintenance
            evaluationWindow: 5.0          // 5-minute window around each maintenance point
        };
        this.lastResult = null;
        this.optimizationHistory = [];
    }

    setPatient(patient) {
        this.patient = patient;
        this.pkParams = this.calculatePKParameters(patient);
        // Set pkParams on patient object for unified access
        this.patient.pkParams = this.pkParams;
        this.patient.pdParams = this.pdParams;
        console.log('Advanced Protocol Engine: Patient set', patient.id);
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('Protocol settings updated:', this.settings);
    }

    calculatePKParameters(patient) {
        console.log('Calculating PK parameters for advanced protocol with Eleveld model');
        
        // Use the Eleveld PK-PD calculator
        const modelParams = EleveldPKPDCalculator.getModelParameters(patient);
        
        // Validate parameters
        const validation = EleveldPKPDCalculator.validateParameters(modelParams);
        if (!validation.isValid) {
            throw new Error('Invalid Eleveld model parameters: ' + validation.errors.join(', '));
        }
        
        // Store PD parameters for BIS calculation
        this.pdParams = modelParams.pd;
        
        console.log('Eleveld PK/PD parameters calculated successfully for advanced protocol');
        
        const pkParams = modelParams.pk;
        
        return {
            v1: pkParams.v1,
            v2: pkParams.v2,
            v3: pkParams.v3,
            cl: pkParams.cl,
            q2: pkParams.q2,
            q3: pkParams.q3,
            ke0: pkParams.ke0,
            k10: pkParams.k10,
            k12: pkParams.k12,
            k21: pkParams.k21,
            k13: pkParams.k13,
            k31: pkParams.k31
        };
    }

    /**
     * Context7 Math.NET Numerics Enhanced Bolus Optimization
     */
    optimizeBolusProtocol(targetCe, bolusDoseMg, targetReachTime = null) {
        if (!this.patient || !this.pkParams) {
            throw new Error('Patient and PK parameters must be set before optimization');
        }

        targetReachTime = targetReachTime || this.settings.targetReachTime;
        this.settings.targetCe = targetCe;
        
        console.log(`=== Advanced Step-Down Protocol Optimization ===`);
        console.log(`Target Ce: ${targetCe} μg/mL`);
        console.log(`Bolus dose: ${bolusDoseMg} mg`);
        console.log(`Target time: ${targetReachTime} minutes`);
        console.log(`Threshold ratio: ${(this.settings.upperThresholdRatio * 100).toFixed(0)}%`);
        console.log(`Reduction factor: ${(this.settings.reductionFactor * 100).toFixed(0)}%`);

        // Step 1: Optimize initial continuous infusion rate
        const optimizationResult = this.optimizeContinuousInfusionRate(
            bolusDoseMg, 
            targetCe, 
            targetReachTime
        );

        // Step 2: Generate complete step-down protocol
        const protocolResult = this.generateAdvancedStepDownProtocol(
            bolusDoseMg, 
            optimizationResult.optimalRate,
            targetCe
        );

        // Step 3: Evaluate performance metrics
        const performanceMetrics = this.evaluateAdvancedPerformance(
            protocolResult.timeSeriesData,
            protocolResult.dosageAdjustments,
            targetCe
        );

        // Generate schedule with accurate data from the new protocol
        const schedule = this.generateAccurateSchedule(bolusDoseMg, optimizationResult.optimalRate, protocolResult);

        this.lastResult = {
            optimization: optimizationResult,
            protocol: protocolResult,
            performance: performanceMetrics,
            schedule: schedule
        };

        // Store in optimization history
        this.optimizationHistory.push({
            timestamp: new Date(),
            targetCe: targetCe,
            bolusDose: bolusDoseMg,
            result: this.lastResult,
            settings: { ...this.settings }
        });

        console.log(`Optimization completed - Performance Score: ${performanceMetrics.overallScore.toFixed(1)}/100`);
        return this.lastResult;
    }

    /**
     * Advanced continuous infusion rate optimization with grid search
     * Now optimizes for final concentration after full step-down protocol
     */
    optimizeContinuousInfusionRate(bolusDoseMg, targetCe, targetTime) {
        console.log('Optimizing continuous infusion rate for multi-point target maintenance...');
        
        // New approach: Optimize for maintaining target at multiple time points
        const maintenancePoints = this.settings.maintenancePoints;
        console.log(`Maintenance points: ${maintenancePoints.join(', ')} minutes`);
        
        // Estimate required rate considering step-downs over 6 hours
        // With max 3 adjustments/hour × 6 hours = max 18 step-downs
        // But realistically 2-3 per hour = 12-18 total
        const hoursSimulated = this.settings.simulationDuration / 60;
        const expectedAdjustmentsTotal = hoursSimulated * this.settings.maxAdjustmentsPerHour;
        const estimatedStepDowns = Math.min(expectedAdjustmentsTotal * 0.7, 15); // 70% result in step-downs
        
        // Calculate compensation for cumulative step-downs
        const cumulativeReduction = Math.pow(this.settings.reductionFactor, estimatedStepDowns);
        const compensationFactor = 1 / cumulativeReduction;
        
        console.log(`Expected total adjustments: ${expectedAdjustmentsTotal.toFixed(1)}`);
        console.log(`Estimated step-downs: ${estimatedStepDowns.toFixed(1)}`);
        console.log(`Cumulative reduction: ${((1-cumulativeReduction)*100).toFixed(1)}%`);
        console.log(`Compensation factor: ${compensationFactor.toFixed(2)}x`);
        
        // Three-stage grid search optimizing for multiple maintenance points
        const baseMaxRate = targetCe <= 2.0 ? 800.0 : 1200.0;
        const maxRate = Math.min(2000.0, baseMaxRate * compensationFactor);
        const stepSize = targetCe <= 2.0 ? 30.0 : 40.0;
        
        console.log(`Search range: 100.0 - ${maxRate.toFixed(0)} mg/hr`);
        
        // Stage 1: Coarse search
        const coarseSearch = this.gridSearchOptimizationMultiPoint(bolusDoseMg, targetCe, stepSize, 100.0, maxRate);
        
        // Stage 2: Medium search
        const mediumRange = Math.max(150.0, coarseSearch.bestRate * 0.3);
        const mediumSearch = this.gridSearchOptimizationMultiPoint(
            bolusDoseMg, 
            targetCe, 
            10.0, 
            Math.max(50.0, coarseSearch.bestRate - mediumRange),
            Math.min(maxRate, coarseSearch.bestRate + mediumRange)
        );
        
        // Stage 3: Fine search
        const fineRange = Math.max(50.0, mediumSearch.bestRate * 0.1);
        const fineSearch = this.gridSearchOptimizationMultiPoint(
            bolusDoseMg, 
            targetCe, 
            2.0, 
            Math.max(20.0, mediumSearch.bestRate - fineRange),
            Math.min(maxRate, mediumSearch.bestRate + fineRange)
        );

        // Get performance metrics from multi-point simulation
        const performanceData = this.simulateMultiPointProtocol(bolusDoseMg, fineSearch.bestRate, targetCe);
        
        console.log(`Optimal rate: ${fineSearch.bestRate.toFixed(2)} mg/hr`);
        console.log(`Multi-point performance score: ${performanceData.score.toFixed(1)}/100`);
        
        return new ProtocolResult(
            fineSearch.bestRate,
            performanceData.averageConcentration,
            null, // Schedule will be generated later
            targetCe,
            targetTime
        );
    }

    /**
     * Grid search optimization with configurable precision (original method)
     */
    gridSearchOptimization(bolusDoseMg, targetCe, targetTime, step, minRate, maxRate) {
        let bestRate = 1.0;
        let bestError = Infinity;
        const results = [];

        for (let rate = minRate; rate <= maxRate; rate += step) {
            const ceAtTarget = this.simulateBolusAndContinuous(bolusDoseMg, rate, targetTime);
            const error = Math.abs(ceAtTarget - targetCe);

            results.push({
                rate: rate,
                ceAtTarget: ceAtTarget,
                error: error,
                relativeError: (error / targetCe) * 100
            });

            if (error < bestError) {
                bestError = error;
                bestRate = rate;
            }
        }

        return {
            bestRate: bestRate,
            bestError: bestError,
            results: results
        };
    }

    /**
     * Grid search optimization for full protocol final concentration
     */
    gridSearchOptimizationFullProtocol(bolusDoseMg, targetCe, step, minRate, maxRate) {
        let bestRate = 1.0;
        let bestError = Infinity;
        const results = [];

        for (let rate = minRate; rate <= maxRate; rate += step) {
            const finalCe = this.simulateFullProtocolFinalCe(bolusDoseMg, rate, targetCe);
            const error = Math.abs(finalCe - targetCe);

            results.push({
                rate: rate,
                finalCe: finalCe,
                error: error,
                relativeError: (error / targetCe) * 100
            });

            if (error < bestError) {
                bestError = error;
                bestRate = rate;
            }
        }

        return {
            bestRate: bestRate,
            bestError: bestError,
            results: results
        };
    }

    /**
     * Grid search optimization for multi-point target maintenance
     */
    gridSearchOptimizationMultiPoint(bolusDoseMg, targetCe, step, minRate, maxRate) {
        let bestRate = 100.0;
        let bestScore = 0;
        const results = [];

        for (let rate = minRate; rate <= maxRate; rate += step) {
            const performanceData = this.simulateMultiPointProtocol(bolusDoseMg, rate, targetCe);
            const score = performanceData.score;

            results.push({
                rate: rate,
                score: score,
                averageError: performanceData.averageError,
                maintenancePoints: performanceData.maintenancePoints
            });

            if (score > bestScore) {
                bestScore = score;
                bestRate = rate;
            }
        }

        return {
            bestRate: bestRate,
            bestScore: bestScore,
            results: results
        };
    }

    /**
     * Simulate multi-point protocol and return performance metrics
     */
    simulateMultiPointProtocol(bolusDoseMg, initialContinuousRate, targetCe) {
        const maintenancePoints = this.settings.maintenancePoints;
        const tolerance = this.settings.maintenanceTolerance;
        const evaluationWindow = this.settings.evaluationWindow;
        
        // Run full simulation
        const simulationData = this.simulateAdvancedStepDownProtocol(bolusDoseMg, initialContinuousRate, targetCe);
        
        // Evaluate performance at each maintenance point
        const pointPerformances = [];
        let totalScore = 0;
        let totalError = 0;
        
        for (const timePoint of maintenancePoints) {
            // Find concentrations within evaluation window
            const windowStart = timePoint - evaluationWindow / 2;
            const windowEnd = timePoint + evaluationWindow / 2;
            
            const windowData = simulationData.filter(point => 
                point.time >= windowStart && point.time <= windowEnd
            );
            
            if (windowData.length > 0) {
                const avgCe = windowData.reduce((sum, point) => sum + point.ce, 0) / windowData.length;
                const error = Math.abs(avgCe - targetCe);
                const relativeError = error / targetCe;
                const withinTolerance = relativeError <= tolerance;
                
                // Score: 100 points if within tolerance, decreasing with error
                const pointScore = withinTolerance ? 100 : Math.max(0, 100 - (relativeError * 500));
                
                pointPerformances.push({
                    timePoint: timePoint,
                    averageConcentration: avgCe,
                    error: error,
                    relativeError: relativeError,
                    score: pointScore,
                    withinTolerance: withinTolerance
                });
                
                totalScore += pointScore;
                totalError += error;
            }
        }
        
        const averageScore = totalScore / maintenancePoints.length;
        const averageError = totalError / maintenancePoints.length;
        const overallConcentration = pointPerformances.reduce((sum, p) => sum + p.averageConcentration, 0) / pointPerformances.length;
        
        return {
            score: averageScore,
            averageError: averageError,
            averageConcentration: overallConcentration,
            maintenancePoints: pointPerformances,
            simulationData: simulationData
        };
    }

    /**
     * Simulate advanced step-down protocol with enhanced step-down logic
     */
    simulateAdvancedStepDownProtocol(bolusDoseMg, initialContinuousRate, targetCe) {
        const upperThreshold = targetCe * this.settings.upperThresholdRatio;
        
        const bolusState = this.calculateBolusInitialConcentration(bolusDoseMg);
        let state = { a1: bolusState.a1, a2: bolusState.a2, a3: bolusState.a3 };
        let currentCe = bolusState.effectSiteConc;
        let currentRate = initialContinuousRate;
        
        const timeSeriesData = [];
        let lastAdjustmentTime = -this.settings.adjustmentInterval;
        let adjustmentCount = 0;
        let adjustmentsThisHour = 0;
        let currentHour = 0;
        
        const numSteps = Math.floor(this.settings.simulationDuration / this.settings.timeStep) + 1;
        
        for (let i = 0; i < numSteps; i++) {
            const currentTime = i * this.settings.timeStep;
            const infusionRateMgMin = (currentRate) / 60.0;
            
            // Track adjustments per hour
            const hour = Math.floor(currentTime / 60);
            if (hour > currentHour) {
                currentHour = hour;
                adjustmentsThisHour = 0;
            }
            
            // Calculate plasma concentration
            const plasmaConc = state.a1 / this.pkParams.v1;
            
            // Update effect site concentration
            if (i > 0) {
                const dCedt = this.pkParams.ke0 * (plasmaConc - currentCe);
                currentCe = currentCe + this.settings.timeStep * dCedt;
            }
            
            // Enhanced step-down logic with hourly limits
            if (currentCe >= upperThreshold && 
                currentTime - lastAdjustmentTime >= this.settings.adjustmentInterval &&
                adjustmentsThisHour < this.settings.maxAdjustmentsPerHour &&
                currentRate > this.settings.minimumRate) {
                
                const oldRate = currentRate;
                currentRate = Math.max(this.settings.minimumRate, currentRate * this.settings.reductionFactor);
                
                adjustmentCount++;
                adjustmentsThisHour++;
                lastAdjustmentTime = currentTime;
            }
            
            // Record data point
            timeSeriesData.push({
                time: parseFloat(currentTime.toFixed(1)),
                ce: currentCe,
                plasma: plasmaConc,
                infusionRate: currentRate,
                targetCe: targetCe,
                upperThreshold: upperThreshold,
                adjustmentNumber: adjustmentCount,
                isBolus: i === 0
            });
            
            // Update system state using RK4
            if (i < numSteps - 1) {
                state = this.updateSystemStateRK4(state, infusionRateMgMin, this.settings.timeStep);
            }
        }
        
        return timeSeriesData;
    }

    /**
     * Simulate full step-down protocol and return final concentration (legacy method)
     */
    simulateFullProtocolFinalCe(bolusDoseMg, initialContinuousRate, targetCe) {
        const upperThreshold = targetCe * this.settings.upperThresholdRatio;
        
        const bolusState = this.calculateBolusInitialConcentration(bolusDoseMg);
        let state = { a1: bolusState.a1, a2: bolusState.a2, a3: bolusState.a3 };
        let currentCe = bolusState.effectSiteConc;
        let currentRate = initialContinuousRate;
        
        let lastAdjustmentTime = -this.settings.adjustmentInterval;
        
        const numSteps = Math.floor(this.settings.simulationDuration / this.settings.timeStep) + 1;
        
        for (let i = 0; i < numSteps; i++) {
            const currentTime = i * this.settings.timeStep;
            const infusionRateMgMin = (currentRate) / 60.0;
            
            // Calculate plasma concentration
            const plasmaConc = state.a1 / this.pkParams.v1;
            
            // Update effect site concentration
            if (i > 0) {
                const dCedt = this.pkParams.ke0 * (plasmaConc - currentCe);
                currentCe = currentCe + this.settings.timeStep * dCedt;
            }
            
            // Step-down logic
            if (currentCe >= upperThreshold && 
                currentTime - lastAdjustmentTime >= this.settings.adjustmentInterval &&
                currentRate > this.settings.minimumRate) {
                
                currentRate = Math.max(this.settings.minimumRate, currentRate * this.settings.reductionFactor);
                lastAdjustmentTime = currentTime;
            }
            
            // Update system state using RK4
            if (i < numSteps - 1) {
                state = this.updateSystemStateRK4(state, infusionRateMgMin, this.settings.timeStep);
            }
        }
        
        return currentCe;
    }

    /**
     * Generate advanced step-down protocol with threshold-based adjustments
     */
    generateAdvancedStepDownProtocol(bolusDoseMg, initialContinuousRate, targetCe) {
        console.log('Generating multi-point maintenance protocol...');
        
        // Use the new advanced simulation
        const timeSeriesData = this.simulateAdvancedStepDownProtocol(bolusDoseMg, initialContinuousRate, targetCe);
        
        // Extract dosage adjustments from time series data
        const dosageAdjustments = [];
        let lastAdjustmentNumber = 0;
        
        for (let i = 1; i < timeSeriesData.length; i++) {
            const current = timeSeriesData[i];
            const previous = timeSeriesData[i - 1];
            
            // Detect rate change (step-down)
            if (Math.abs(current.infusionRate - previous.infusionRate) > 0.1) {
                const reductionPercent = ((previous.infusionRate - current.infusionRate) / previous.infusionRate) * 100;
                
                dosageAdjustments.push({
                    time: current.time,
                    type: 'threshold_reduction',
                    oldRate: previous.infusionRate,
                    newRate: current.infusionRate,
                    ceAtEvent: current.ce,
                    reductionPercent: reductionPercent,
                    adjustmentNumber: ++lastAdjustmentNumber,
                    thresholdRatio: current.ce / targetCe
                });
                
                console.log(`${current.time.toFixed(1)}min: Step-down #${lastAdjustmentNumber} - Ce=${current.ce.toFixed(3)} → Rate ${previous.infusionRate.toFixed(2)} → ${current.infusionRate.toFixed(2)} mg/hr (-${reductionPercent.toFixed(1)}%)`);
            }
        }
        
        console.log(`Multi-point protocol generated: ${dosageAdjustments.length} step-down adjustments over ${this.settings.simulationDuration} minutes`);
        
        // Maintenance point summary
        const maintenancePoints = this.settings.maintenancePoints;
        console.log('Maintenance point targets:');
        for (const timePoint of maintenancePoints) {
            const pointData = timeSeriesData.find(point => Math.abs(point.time - timePoint) < 0.5);
            if (pointData) {
                console.log(`  ${timePoint}min: Ce=${pointData.ce.toFixed(3)} μg/mL (target: ${targetCe} μg/mL)`);
            }
        }
        
        return {
            timeSeriesData: timeSeriesData,
            dosageAdjustments: dosageAdjustments,
            bolusDose: bolusDoseMg,
            initialContinuousRate: initialContinuousRate,
            finalRate: timeSeriesData[timeSeriesData.length - 1].infusionRate,
            upperThreshold: targetCe * this.settings.upperThresholdRatio
        };
    }

    /**
     * Evaluate advanced performance metrics
     */
    evaluateAdvancedPerformance(timeSeriesData, dosageAdjustments, targetCe) {
        // Multi-point maintenance protocol evaluation
        const maintenancePoints = this.settings.maintenancePoints;
        const tolerance = this.settings.maintenanceTolerance;
        const evaluationWindow = this.settings.evaluationWindow;
        
        if (timeSeriesData.length === 0) {
            return this.getDefaultPerformanceMetrics();
        }

        // Basic metrics
        const finalCe = timeSeriesData[timeSeriesData.length - 1].ce;
        const maxCe = Math.max(...timeSeriesData.map(point => point.ce));
        
        // Multi-point target accuracy
        let totalPointScore = 0;
        let pointsEvaluated = 0;
        
        for (const timePoint of maintenancePoints) {
            const windowStart = timePoint - evaluationWindow / 2;
            const windowEnd = timePoint + evaluationWindow / 2;
            
            const windowData = timeSeriesData.filter(point => 
                point.time >= windowStart && point.time <= windowEnd
            );
            
            if (windowData.length > 0) {
                const avgCe = windowData.reduce((sum, point) => sum + point.ce, 0) / windowData.length;
                const error = Math.abs(avgCe - targetCe);
                const relativeError = error / targetCe;
                const withinTolerance = relativeError <= tolerance;
                
                const pointScore = withinTolerance ? 100 : Math.max(0, 100 - (relativeError * 500));
                totalPointScore += pointScore;
                pointsEvaluated++;
                
                console.log(`  ${timePoint}min point: Ce=${avgCe.toFixed(3)} μg/mL, Error=${(relativeError*100).toFixed(1)}%, Score=${pointScore.toFixed(1)}`);
            }
        }
        
        const targetAccuracy = pointsEvaluated > 0 ? totalPointScore / pointsEvaluated : 0;
        
        // Overall stability analysis (full duration)
        const allDeviations = timeSeriesData.map(point => Math.abs(point.ce - targetCe));
        const avgDeviation = allDeviations.reduce((sum, dev) => sum + dev, 0) / allDeviations.length;
        
        // Stability index (measures concentration variation)
        let totalVariation = 0;
        for (let i = 1; i < timeSeriesData.length; i++) {
            totalVariation += Math.abs(timeSeriesData[i].ce - timeSeriesData[i-1].ce);
        }
        const avgVariation = totalVariation / (timeSeriesData.length - 1);
        const stabilityIndex = Math.max(0, 100 - (avgVariation * 1000));
        
        // Convergence time (time to reach within ±5% of target)
        const convergenceThreshold = targetCe * this.settings.convergenceThreshold;
        let convergenceTime = Infinity;
        for (const point of timeSeriesData) {
            if (Math.abs(point.ce - targetCe) <= convergenceThreshold) {
                convergenceTime = point.time;
                break;
            }
        }
        
        // Overshoot analysis
        const overshootPoints = timeSeriesData.filter(point => point.ce > targetCe * 1.1);
        const maxOvershoot = overshootPoints.length > 0 ? 
            Math.max(...overshootPoints.map(point => point.ce)) : targetCe;
        const overshootPercent = ((maxOvershoot - targetCe) / targetCe) * 100;
        
        // Time distribution analysis
        const timeInTarget = (timeSeriesData.filter(p => Math.abs(p.ce - targetCe) <= targetCe * 0.1).length / timeSeriesData.length) * 100;
        const timeAboveTarget = (timeSeriesData.filter(p => p.ce > targetCe * 1.1).length / timeSeriesData.length) * 100;
        const timeBelowTarget = (timeSeriesData.filter(p => p.ce < targetCe * 0.9).length / timeSeriesData.length) * 100;
        
        // Overall performance score (0-100) - weighted for multi-point performance
        const multiPointScore = targetAccuracy;
        const stabilityScore = stabilityIndex;
        const convergenceScore = convergenceTime < 30 ? 100 : Math.max(0, 100 - (convergenceTime - 30) * 2);
        const overshootPenalty = Math.max(0, overshootPercent - 10) * 1.5;
        
        const overallScore = Math.max(0, 
            (multiPointScore * 0.5 + stabilityScore * 0.25 + convergenceScore * 0.25) - overshootPenalty
        );
        
        const metrics = {
            finalCe: finalCe,
            maxCe: maxCe,
            avgDeviation: avgDeviation,
            targetAccuracy: targetAccuracy, // Now represents multi-point accuracy
            stabilityIndex: stabilityIndex,
            convergenceTime: convergenceTime,
            totalAdjustments: dosageAdjustments.length,
            overshootPercent: overshootPercent,
            undershootPercent: timeBelowTarget,
            overallScore: overallScore,
            
            // Detailed scores
            accuracyScore: multiPointScore,
            stabilityScore: stabilityScore,
            convergenceScore: convergenceScore,
            
            // Clinical indicators
            timeInTarget: timeInTarget,
            timeAboveTarget: timeAboveTarget,
            timeBelowTarget: timeBelowTarget,
            
            // Multi-point specific metrics
            maintenancePointScore: targetAccuracy,
            pointsEvaluated: pointsEvaluated
        };
        
        console.log('Multi-Point Performance Evaluation:');
        console.log(`  Maintenance Points Score: ${targetAccuracy.toFixed(1)}/100`);
        console.log(`  Overall Time in Target: ${timeInTarget.toFixed(1)}%`);
        console.log(`  Stability Index: ${stabilityIndex.toFixed(1)}/100`);
        console.log(`  Convergence Time: ${convergenceTime === Infinity ? '∞' : convergenceTime.toFixed(1)} min`);
        console.log(`  Overall Score: ${overallScore.toFixed(1)}/100`);
        
        return metrics;
    }

    getDefaultPerformanceMetrics() {
        return {
            finalCe: 0,
            maxCe: 0,
            avgDeviation: Infinity,
            targetAccuracy: 0,
            stabilityIndex: 0,
            convergenceTime: Infinity,
            totalAdjustments: 0,
            overshootPercent: 0,
            undershootPercent: 100,
            overallScore: 0,
            accuracyScore: 0,
            stabilityScore: 0,
            convergenceScore: 0,
            timeInTarget: 0,
            timeAboveTarget: 0,
            timeBelowTarget: 100
        };
    }

    /**
     * Simulate bolus + continuous infusion for specific time
     */
    simulateBolusAndContinuous(bolusDoseMg, continuousRate, targetTime) {
        const bolusState = this.calculateBolusInitialConcentration(bolusDoseMg);
        let state = { a1: bolusState.a1, a2: bolusState.a2, a3: bolusState.a3 };
        let currentCe = bolusState.effectSiteConc;
        
        const infusionRateMgMin = (continuousRate ) / 60.0;
        const numSteps = Math.floor(targetTime / this.settings.timeStep);
        
        
        for (let i = 0; i < numSteps; i++) {
            const plasmaConc = state.a1 / this.pkParams.v1;
            
            // Update effect site concentration
            const dCedt = this.pkParams.ke0 * (plasmaConc - currentCe);
            currentCe = currentCe + this.settings.timeStep * dCedt;
            
            // Update system state
            state = this.updateSystemStateRK4(state, infusionRateMgMin, this.settings.timeStep);
        }
        
        
        return currentCe;
    }

    /**
     * Calculate initial state after bolus administration
     */
    calculateBolusInitialConcentration(bolusDoseMg) {
        const initialPlasmaConc = bolusDoseMg / this.pkParams.v1;
        return {
            a1: bolusDoseMg,
            a2: 0.0,
            a3: 0.0,
            plasmaConc: initialPlasmaConc,
            effectSiteConc: 0.0
        };
    }

    /**
     * 4th order Runge-Kutta integration (Context7 Math.NET style)
     */
    updateSystemStateRK4(state, infusionRateMgMin, dt) {
        const { k10, k12, k21, k13, k31 } = this.patient.pkParams;
        
        const derivatives = (s) => ({
            da1dt: infusionRateMgMin - (k10 + k12 + k13) * s.a1 + k21 * s.a2 + k31 * s.a3,
            da2dt: k12 * s.a1 - k21 * s.a2,
            da3dt: k13 * s.a1 - k31 * s.a3
        });
        
        const k1 = derivatives(state);
        const k2 = derivatives({
            a1: state.a1 + 0.5 * dt * k1.da1dt,
            a2: state.a2 + 0.5 * dt * k1.da2dt,
            a3: state.a3 + 0.5 * dt * k1.da3dt
        });
        const k3 = derivatives({
            a1: state.a1 + 0.5 * dt * k2.da1dt,
            a2: state.a2 + 0.5 * dt * k2.da2dt,
            a3: state.a3 + 0.5 * dt * k2.da3dt
        });
        const k4 = derivatives({
            a1: state.a1 + dt * k3.da1dt,
            a2: state.a2 + dt * k3.da2dt,
            a3: state.a3 + dt * k3.da3dt
        });
        
        return {
            a1: state.a1 + (dt / 6.0) * (k1.da1dt + 2*k2.da1dt + 2*k3.da1dt + k4.da1dt),
            a2: state.a2 + (dt / 6.0) * (k1.da2dt + 2*k2.da2dt + 2*k3.da2dt + k4.da2dt),
            a3: state.a3 + (dt / 6.0) * (k1.da3dt + 2*k2.da3dt + 2*k3.da3dt + k4.da3dt)
        };
    }

    /**
     * Unified Euler method for fallback
     */
    updateSystemStateEuler(state, infusionRateMgMin, dt) {
        const { k10, k12, k21, k13, k31 } = this.patient.pkParams;
        
        const da1dt = infusionRateMgMin - (k10 + k12 + k13) * state.a1 + k21 * state.a2 + k31 * state.a3;
        const da2dt = k12 * state.a1 - k21 * state.a2;
        const da3dt = k13 * state.a1 - k31 * state.a3;
        
        return {
            a1: state.a1 + dt * da1dt,
            a2: state.a2 + dt * da2dt,
            a3: state.a3 + dt * da3dt
        };
    }

    /**
     * Unified effect-site concentration calculation as per numerical-unification-guide.yml
     * Corrected formula: dCe/dt = ke0 * (Cp - Ce)
     */
    calculateEffectSiteConcentration(plasmaConc, timeMin) {
        if (timeMin <= 0 || plasmaConc <= 0) return 0;
        
        const ke0 = this.patient.pkParams.ke0;
        // For step input (bolus), Ce approaches Cp * (1 - exp(-ke0 * t))
        const buildup = 1.0 - Math.exp(-ke0 * timeMin);
        const effectSite = plasmaConc * buildup;
        
        return Math.max(0, effectSite);
    }

    /**
     * Generate accurate schedule from protocol result
     */
    generateAccurateSchedule(bolusDoseMg, continuousRate, protocolResult) {
        const schedule = [];
        const adjustments = protocolResult.dosageAdjustments;
        
        // Bolus dose
        schedule.push({
            time: 0,
            action: 'Bolus Administration',
            dose: `${bolusDoseMg.toFixed(1)} mg`,
            rate: '-',
            comment: 'Initial bolus administration',
            type: 'bolus'
        });
        
        // Initial continuous infusion
        schedule.push({
            time: 0,
            action: 'Start Continuous Infusion',
            dose: '-',
            rate: `${continuousRate.toFixed(2)} mg/hr`,
            comment: 'Initial continuous infusion rate',
            type: 'start_continuous'
        });
        
        // Step-down adjustments with verified Ce values from time series data
        adjustments.forEach((adj, index) => {
            // Find the exact data point from time series to get accurate Ce
            const timeSeriesData = protocolResult.timeSeriesData;
            const adjustmentPoint = timeSeriesData.find(point => 
                Math.abs(point.time - adj.time) < 0.1
            );
            
            const actualCe = adjustmentPoint ? adjustmentPoint.ce : adj.ceAtEvent;
            
            schedule.push({
                time: Math.round(adj.time),
                action: `Step-down #${adj.adjustmentNumber}`,
                dose: '-',
                rate: `${adj.newRate.toFixed(2)} mg/hr`,
                comment: `Threshold reached, dose reduced (Ce: ${actualCe.toFixed(2)} μg/mL, -${adj.reductionPercent.toFixed(1)}%)`,
                type: 'step_down',
                ceAtEvent: actualCe,
                reductionPercent: adj.reductionPercent
            });
        });
        
        // Add maintenance point summaries
        const maintenancePoints = this.settings.maintenancePoints;
        const timeSeriesData = protocolResult.timeSeriesData;
        
        if (timeSeriesData && timeSeriesData.length > 0) {
            schedule.push({
                time: '',
                action: '=== Maintenance Point Evaluation ===',
                dose: '',
                rate: '',
                comment: '',
                type: 'separator'
            });
            
            maintenancePoints.forEach(timePoint => {
                const pointData = timeSeriesData.find(point => Math.abs(point.time - timePoint) < 0.5);
                if (pointData) {
                    const targetCe = this.settings.targetCe;
                    const error = Math.abs(pointData.ce - targetCe);
                    const errorPercent = (error / targetCe) * 100;
                    schedule.push({
                        time: timePoint,
                        action: `Maintenance Point`,
                        dose: '-',
                        rate: '-',
                        comment: `Ce: ${pointData.ce.toFixed(3)} μg/mL (Error: ${errorPercent.toFixed(1)}%)`,
                        type: 'maintenance_point'
                    });
                }
            });
        }
        
        return schedule;
    }

    /**
     * Generate multi-point maintenance schedule (new method)
     */
    generateMultiPointSchedule(bolusDoseMg, continuousRate, adjustments) {
        const schedule = [];
        
        // Bolus dose
        schedule.push({
            time: 0,
            action: 'Bolus Administration',
            dose: `${bolusDoseMg.toFixed(1)} mg`,
            rate: '-',
            comment: 'Initial bolus administration',
            type: 'bolus'
        });
        
        // Initial continuous infusion
        schedule.push({
            time: 0,
            action: 'Start Continuous Infusion',
            dose: '-',
            rate: `${continuousRate.toFixed(2)} mg/hr`,
            comment: 'Initial continuous infusion rate',
            type: 'start_continuous'
        });
        
        // Step-down adjustments with corrected Ce values
        adjustments.forEach((adj, index) => {
            schedule.push({
                time: Math.round(adj.time),
                action: `Step-down #${adj.adjustmentNumber}`,
                dose: '-',
                rate: `${adj.newRate.toFixed(2)} mg/hr`,
                comment: `Threshold reached, dose reduced (Ce: ${adj.ceAtEvent.toFixed(2)} μg/mL, -${adj.reductionPercent.toFixed(1)}%)`,
                type: 'step_down',
                ceAtEvent: adj.ceAtEvent,
                reductionPercent: adj.reductionPercent
            });
        });
        
        // Add maintenance point summaries
        const maintenancePoints = this.settings.maintenancePoints;
        if (this.lastResult && this.lastResult.protocol && this.lastResult.protocol.timeSeriesData) {
            const timeSeriesData = this.lastResult.protocol.timeSeriesData;
            
            schedule.push({
                time: '',
                action: '=== Maintenance Point Evaluation ===',
                dose: '',
                rate: '',
                comment: '',
                type: 'separator'
            });
            
            maintenancePoints.forEach(timePoint => {
                const pointData = timeSeriesData.find(point => Math.abs(point.time - timePoint) < 0.5);
                if (pointData) {
                    const error = Math.abs(pointData.ce - this.settings.targetCe);
                    const errorPercent = (error / this.settings.targetCe) * 100;
                    schedule.push({
                        time: timePoint,
                        action: `Maintenance Point`,
                        dose: '-',
                        rate: '-',
                        comment: `Ce: ${pointData.ce.toFixed(3)} μg/mL (Error: ${errorPercent.toFixed(1)}%)`,
                        type: 'maintenance_point'
                    });
                }
            });
        }
        
        return schedule;
    }

    /**
     * Generate detailed clinical schedule (legacy method)
     */
    generateDetailedSchedule(bolusDoseMg, continuousRate, adjustments) {
        const schedule = [];
        
        // Bolus dose
        schedule.push({
            time: 0,
            action: 'Bolus Administration',
            dose: `${bolusDoseMg.toFixed(1)} mg`,
            rate: '-',
            comment: 'Initial bolus administration',
            type: 'bolus'
        });
        
        // Initial continuous infusion
        schedule.push({
            time: 0,
            action: 'Start Continuous Infusion',
            dose: '-',
            rate: `${continuousRate.toFixed(2)} mg/hr`,
            comment: 'Initial continuous infusion rate',
            type: 'start_continuous'
        });
        
        // Step-down adjustments
        adjustments.forEach((adj, index) => {
            schedule.push({
                time: Math.round(adj.time),
                action: `Step-down #${adj.adjustmentNumber}`,
                dose: '-',
                rate: `${adj.newRate.toFixed(2)} mg/hr`,
                comment: `Threshold reached, dose reduced (Ce: ${adj.ceAtEvent.toFixed(2)} μg/mL, -${adj.reductionPercent.toFixed(1)}%)`,
                type: 'step_down',
                ceAtEvent: adj.ceAtEvent,
                reductionPercent: adj.reductionPercent
            });
        });
        
        return schedule;
    }

    /**
     * Get chart data for visualization
     */
    getChartData() {
        if (!this.lastResult) return null;
        
        const data = this.lastResult.protocol.timeSeriesData;
        const adjustments = this.lastResult.protocol.dosageAdjustments;
        
        return {
            times: data.map(d => d.time),
            plasmaConcentrations: data.map(d => d.plasma),
            effectSiteConcentrations: data.map(d => d.ce),
            infusionRates: data.map(d => d.infusionRate),
            targetLine: data.map(d => d.targetCe),
            upperThresholdLine: data.map(d => d.upperThreshold),
            adjustmentTimes: adjustments.map(a => a.time),
            adjustmentLabels: adjustments.map(a => `#${a.adjustmentNumber}`)
        };
    }

    getLastResult() {
        return this.lastResult;
    }

    getOptimizationHistory() {
        return this.optimizationHistory;
    }

    reset() {
        this.lastResult = null;
        console.log('Advanced Protocol Engine reset');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AdvancedProtocolEngine = AdvancedProtocolEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedProtocolEngine };
}