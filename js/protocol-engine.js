/**
 * Protocol Engine for Remimazolam TCI TIVA V4.1
 * プロトコール最適化エンジン
 * 
 * Features:
 * - Bolus + continuous infusion optimization
 * - Target concentration-based protocol generation
 * - Step-down protocol with threshold management
 * - Runge-Kutta integration for accurate simulation
 */

class ProtocolEngine {
    constructor() {
        this.patient = null;
        this.pkParams = null;
        this.settings = {
            targetCe: 3.0,                 // Appropriate for propofol
            upperThreshold: 1.2,           // 120% of target
            reductionFactor: 0.70,         // 70% of current rate (30% reduction)
            timeStep: 0.1,
            simulationDuration: 120,
            targetReachTime: 20,
            adjustmentInterval: 5.0        // 5 minutes minimum between adjustments
        };
        this.lastResult = null;
    }

    setPatient(patient) {
        this.patient = patient;
        this.pkParams = this.calculatePKParameters(patient);
        // Set pkParams on patient object for unified access
        this.patient.pkParams = this.pkParams;
        this.patient.pdParams = this.pdParams;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    calculatePKParameters(patient) {
        console.log('Calculating PK parameters for protocol optimization with Eleveld model');
        
        // Use the Eleveld PK-PD calculator
        const modelParams = EleveldPKPDCalculator.getModelParameters(patient);
        
        // Validate parameters
        const validation = EleveldPKPDCalculator.validateParameters(modelParams);
        if (!validation.isValid) {
            throw new Error('Invalid Eleveld model parameters: ' + validation.errors.join(', '));
        }
        
        // Store PD parameters for BIS calculation
        this.pdParams = modelParams.pd;
        
        console.log('Eleveld PK/PD parameters calculated successfully for protocol optimization');
        
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
     * Optimize continuous infusion rate for given bolus and target concentration
     */
    optimizeContinuousInfusionRate(bolusDoseMg, targetCe, timeToTarget = null) {
        if (!this.patient || !this.pkParams) {
            throw new Error('Patient and PK parameters must be set before optimization');
        }

        timeToTarget = timeToTarget || this.settings.targetReachTime;
        
        console.log(`=== Protocol Optimization ===`);
        console.log(`Bolus dose: ${bolusDoseMg} mg`);
        console.log(`Target concentration: ${targetCe} μg/mL`);
        console.log(`Target time: ${timeToTarget} minutes`);

        // Test range of continuous infusion rates
        const testRates = [];
        for (let rate = 0.1; rate <= 6.0; rate += 0.05) {
            testRates.push(rate);
        }

        let bestRate = 1.0;
        let bestError = Infinity;
        const results = [];

        for (const testRate of testRates) {
            const ceAtTarget = this.simulateBolusAndContinuous(bolusDoseMg, testRate, timeToTarget);
            const error = Math.abs(ceAtTarget - targetCe);

            results.push({
                rate: testRate,
                ceAtTarget: ceAtTarget,
                error: error,
                relativeError: (error / targetCe) * 100
            });

            if (error < bestError) {
                bestError = error;
                bestRate = testRate;
            }
        }

        const predictedCe = this.simulateBolusAndContinuous(bolusDoseMg, bestRate, timeToTarget);
        
        console.log(`Optimal continuous rate: ${bestRate.toFixed(2)} mg/hr`);
        console.log(`Predicted concentration: ${predictedCe.toFixed(3)} μg/mL`);
        console.log(`Error: ${bestError.toFixed(4)} μg/mL (${(bestError/targetCe*100).toFixed(2)}%)`);

        return new ProtocolResult(
            bestRate,
            predictedCe,
            this.generateProtocolSchedule(bolusDoseMg, bestRate),
            targetCe,
            timeToTarget
        );
    }

    /**
     * Generate complete protocol schedule with step-down adjustments
     */
    generateCompleteProtocol(bolusDoseMg, initialContinuousRate) {
        if (!this.patient || !this.pkParams) {
            throw new Error('Patient and PK parameters must be set before protocol generation');
        }

        console.log(`=== Complete Protocol Generation ===`);
        
        return this.generateCompleteProtocolRK4(bolusDoseMg, initialContinuousRate);
    }

    /**
     * Generate complete protocol using RK4 (fallback method)
     */
    generateCompleteProtocolRK4(bolusDoseMg, initialContinuousRate) {
        const bolusState = this.calculateBolusInitialConcentration(bolusDoseMg);
        let state = { a1: bolusState.a1, a2: bolusState.a2, a3: bolusState.a3 };
        let currentCe = bolusState.effectSiteConc;
        let currentRate = initialContinuousRate;
        
        const timeSeriesData = [];
        const dosageAdjustments = [];
        let lastAdjustmentTime = -5; // Allow first adjustment
        let adjustmentCount = 0;
        
        const numSteps = Math.floor(this.settings.simulationDuration / this.settings.timeStep) + 1;
        
        for (let i = 0; i < numSteps; i++) {
            const currentTime = i * this.settings.timeStep;
            const infusionRateMgMin = currentRate / 60.0;
            
            // Calculate plasma concentration
            const plasmaConc = state.a1 / this.pkParams.v1;
            
            // Update effect site concentration
            if (i > 0) {
                const dCedt = this.pkParams.ke0 * (plasmaConc - currentCe);
                currentCe = currentCe + this.settings.timeStep * dCedt;
            }
            
            // Check threshold and adjust dosage
            if (currentCe >= this.settings.upperThreshold && 
                currentTime - lastAdjustmentTime >= this.settings.adjustmentInterval && 
                currentRate > 0.1) {
                
                const oldRate = currentRate;
                currentRate = Math.max(0.1, currentRate * this.settings.reductionFactor);
                
                dosageAdjustments.push({
                    time: currentTime,
                    type: 'threshold_reduction',
                    oldRate: oldRate,
                    newRate: currentRate,
                    ceAtEvent: currentCe,
                    adjustmentNumber: ++adjustmentCount
                });
                
                lastAdjustmentTime = currentTime;
                console.log(`${currentTime.toFixed(1)}min: Threshold reached Ce=${currentCe.toFixed(3)} → Rate ${oldRate.toFixed(2)} → ${currentRate.toFixed(2)} mg/hr`);
            }
            
            // Record data
            timeSeriesData.push({
                time: parseFloat(currentTime.toFixed(1)),
                ce: currentCe,
                plasma: plasmaConc,
                infusionRate: currentRate,
                targetCe: this.settings.targetCe,
                upperThreshold: this.settings.upperThreshold,
                adjustmentNumber: adjustmentCount,
                isBolus: i === 0
            });
            
            // Update system state
            if (i < numSteps - 1) {
                state = this.updateSystemStateRK4(state, infusionRateMgMin, this.settings.timeStep);
            }
        }
        
        // Evaluate performance
        const performance = this.evaluateProtocolPerformance(timeSeriesData, dosageAdjustments);
        
        console.log("");
        console.log("=== Performance Evaluation (RK4) ===");
        console.log(`Final effect site concentration: ${performance.finalCe.toFixed(3)} μg/mL`);
        console.log(`Average deviation: ${performance.avgDeviation.toFixed(4)} μg/mL`);
        console.log(`Target accuracy: ${performance.targetAccuracy.toFixed(1)}%`);
        console.log(`Total adjustments: ${performance.totalAdjustments}`);
        console.log(`Maximum concentration: ${performance.maxCe.toFixed(3)} μg/mL`);
        
        return {
            timeSeriesData: timeSeriesData,
            dosageAdjustments: dosageAdjustments,
            performance: performance,
            bolusDose: bolusDoseMg,
            initialContinuousRate: initialContinuousRate,
            calculationMethod: 'Unified RK4'
        };
    }

    /**
     * Simulate bolus + continuous infusion for specific time
     */
    simulateBolusAndContinuous(bolusDoseMg, continuousRate, targetTime) {
        return this.simulateBolusAndContinuousRK4(bolusDoseMg, continuousRate, targetTime);
    }

    /**
     * Simulate bolus + continuous infusion using RK4 (fallback method)
     */
    simulateBolusAndContinuousRK4(bolusDoseMg, continuousRate, targetTime) {
        const bolusState = this.calculateBolusInitialConcentration(bolusDoseMg);
        let state = { a1: bolusState.a1, a2: bolusState.a2, a3: bolusState.a3 };
        let currentCe = bolusState.effectSiteConc;
        
        const infusionRateMgMin = continuousRate / 60.0;
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
        // Bolus is instantly distributed in V1
        const initialPlasmaConc = bolusDoseMg / this.pkParams.v1;
        return {
            a1: bolusDoseMg, // mg
            a2: 0.0,
            a3: 0.0,
            plasmaConc: initialPlasmaConc, // μg/mL
            effectSiteConc: 0.0 // Effect site takes time to reach equilibrium
        };
    }

    /**
     * 4th order Runge-Kutta integration for 3-compartment PK system
     * Note: Effect-site concentration is calculated separately in protocol engine
     */
    updateSystemStateRK4(state, infusionRateMgMin, dt) {
        const { k10, k12, k21, k13, k31 } = this.patient.pkParams;
        
        const derivatives = (s) => ({
            da1dt: infusionRateMgMin - (k10 + k12 + k13) * s.a1 + k21 * s.a2 + k31 * s.a3,
            da2dt: k12 * s.a1 - k21 * s.a2,
            da3dt: k13 * s.a1 - k31 * s.a3
        });
        
        // 4th order Runge-Kutta integration
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
     * Calculate effect-site concentration using VHAC when possible
     * Falls back to simple calculation for individual points
     */
    calculateEffectSiteConcentration(plasmaConc, timeMin) {
        if (timeMin <= 0 || plasmaConc <= 0) return 0;
        
        const ke0 = this.patient.pkParams.ke0;
        // Simple first-order calculation for protocol optimization
        // For precise simulations, use VHAC in monitoring engine
        const buildup = 1.0 - Math.exp(-ke0 * timeMin);
        const effectSite = plasmaConc * buildup;
        
        return Math.max(0, effectSite);
    }

    /**
     * Evaluate protocol performance
     */
    evaluateProtocolPerformance(timeSeriesData, dosageAdjustments) {
        // Evaluate maintenance period data (after 60 minutes)
        const maintenanceData = timeSeriesData.filter(point => point.time >= 60);
        
        if (maintenanceData.length === 0) {
            return {
                finalCe: 0,
                avgDeviation: Infinity,
                targetAccuracy: 0,
                totalAdjustments: dosageAdjustments.length,
                maxCe: 0
            };
        }
        
        // Final concentration
        const finalCe = timeSeriesData[timeSeriesData.length - 1].ce;
        
        // Maximum concentration
        const maxCe = Math.max(...timeSeriesData.map(point => point.ce));
        
        // Average deviation
        const deviations = maintenanceData.map(point => Math.abs(point.ce - this.settings.targetCe));
        const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
        
        // Target accuracy (percentage of time within ±10%)
        const tolerance = this.settings.targetCe * 0.1;
        const withinTolerance = maintenanceData.filter(point => 
            Math.abs(point.ce - this.settings.targetCe) <= tolerance
        ).length;
        const targetAccuracy = (withinTolerance / maintenanceData.length) * 100;
        
        return {
            finalCe: finalCe,
            avgDeviation: avgDeviation,
            targetAccuracy: targetAccuracy,
            totalAdjustments: dosageAdjustments.length,
            maxCe: maxCe
        };
    }

    /**
     * Generate protocol schedule table
     */
    generateProtocolSchedule(bolusDoseMg, continuousRate) {
        const schedule = [];
        
        // Bolus dose
        schedule.push({
            time: 0,
            action: 'Bolus',
            dose: `${bolusDoseMg.toFixed(1)} mg`,
            rate: '-',
            comment: 'Initial bolus administration'
        });
        
        // Continuous infusion
        schedule.push({
            time: 0,
            action: 'Start Continuous',
            dose: '-',
            rate: `${continuousRate.toFixed(0)} mg/hr`,
            comment: 'Begin continuous infusion'
        });
        
        // Add potential adjustments based on protocol simulation
        if (this.lastResult) {
            this.lastResult.dosageAdjustments.forEach(adj => {
                schedule.push({
                    time: Math.round(adj.time),
                    action: 'Rate Adjustment',
                    dose: '-',
                    rate: `${adj.newRate.toFixed(0)} mg/hr`,
                    comment: `Reduce rate (Ce: ${adj.ceAtEvent.toFixed(2)} μg/mL)`
                });
            });
        }
        
        return schedule;
    }

}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ProtocolEngine = ProtocolEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProtocolEngine };
}