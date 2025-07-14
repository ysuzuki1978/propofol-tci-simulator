/**
 * Monitoring Engine for Remimazolam TCI TIVA V4.1
 * 実投与量監視エンジン
 * 
 * Features:
 * - VHAC (Variable-step Hybrid Algorithm for Ce) effect-site calculation
 * - LSODA integration with high precision
 * - Multiple calculation methods for effect-site concentrations
 * - Real-time dose event management
 * - Advanced pharmacokinetic simulation
 */

// VHAC functions are now imported from utils/vhac.js

/**
 * Alternative effect-site concentration calculation using discrete time steps
 */
function calculateEffectSiteDiscrete(plasmaConcentrations, timePoints, ke0, dt = 0.1) {
    if (plasmaConcentrations.length !== timePoints.length) {
        throw new Error("Plasma concentrations and time points must have the same length");
    }
    
    if (ke0 <= 0) {
        throw new Error("ke0 must be positive");
    }
    
    const ceValues = new Array(timePoints.length).fill(0);
    ceValues[0] = 0.0; // Start with zero effect-site concentration
    
    for (let i = 1; i < timePoints.length; i++) {
        const timeDiff = timePoints[i] - timePoints[i-1];
        const cpStart = plasmaConcentrations[i-1];
        const cpEnd = plasmaConcentrations[i];
        const cePrev = ceValues[i-1];
        
        const numSubsteps = Math.max(1, Math.ceil(timeDiff / dt));
        const substepDt = timeDiff / numSubsteps;
        
        let ceCurrent = cePrev;
        
        for (let step = 1; step <= numSubsteps; step++) {
            const progress = (step - 0.5) / numSubsteps;
            const cpSubstep = cpStart + progress * (cpEnd - cpStart);
            
            const dce_dt = ke0 * (cpSubstep - ceCurrent);
            ceCurrent = ceCurrent + substepDt * dce_dt;
        }
        
        ceValues[i] = ceCurrent;
    }
    
    return ceValues;
}

class MonitoringEngine {
    constructor() {
        this.patient = null;
        this.pkParams = null;
        this.doseEvents = [];
        this.lastSimulationResult = null;
        this.calculationMethod = 'VHAC + RK4 Engine';
        this.precision = 0.01; // 0.01-minute precision
    }

    setPatient(patient) {
        this.patient = patient;
        this.pkParams = this.calculatePKParameters(patient);
        console.log('Patient set for monitoring engine:', patient.id);
    }

    addDoseEvent(doseEvent) {
        if (!doseEvent.validate().isValid) {
            throw new Error('Invalid dose event: ' + doseEvent.validate().errors.join(', '));
        }
        
        this.doseEvents.push(doseEvent);
        this.doseEvents.sort((a, b) => a.timeInMinutes - b.timeInMinutes);
        console.log('Dose event added:', doseEvent);
    }

    removeDoseEvent(index) {
        if (index >= 0 && index < this.doseEvents.length) {
            const removed = this.doseEvents.splice(index, 1)[0];
            console.log('Dose event removed:', removed);
            return removed;
        }
        return null;
    }

    getDoseEvents() {
        return [...this.doseEvents];
    }

    clearDoseEvents() {
        this.doseEvents = [];
        console.log('All dose events cleared');
    }

    calculatePKParameters(patient) {
        console.log('Calculating PK parameters for monitoring with Eleveld model');
        
        // Use the Eleveld PK-PD calculator
        const modelParams = EleveldPKPDCalculator.getModelParameters(patient);
        
        // Validate parameters
        const validation = EleveldPKPDCalculator.validateParameters(modelParams);
        if (!validation.isValid) {
            throw new Error('Invalid Eleveld model parameters: ' + validation.errors.join(', '));
        }
        
        // Store PD parameters for BIS calculation
        this.pdParams = modelParams.pd;
        
        console.log('Eleveld PK/PD parameters calculated successfully');
        if (window.DEBUG) {
            EleveldPKPDCalculator.printParameters(patient, modelParams);
        }
        
        return modelParams.pk;
    }

    /**
     * Perform high-precision pharmacokinetic simulation
     */
    runSimulation(simulationDurationMin = null) {
        if (!this.patient || !this.pkParams) {
            throw new Error('Patient and PK parameters must be set before simulation');
        }

        if (!this.doseEvents || this.doseEvents.length === 0) {
            throw new Error('At least one dose event is required for simulation');
        }

        console.log('Running monitoring simulation with VHAC + RK4 engine');

        // Determine simulation duration
        const maxEventTime = Math.max(...this.doseEvents.map(event => event.timeInMinutes));
        const finalDuration = simulationDurationMin || (maxEventTime + 120.0);

        // Create high-precision time sequence
        const timeStep = this.precision;
        const times = [];
        for (let t = 0; t <= finalDuration; t += timeStep) {
            times.push(t);
        }

        // Calculate plasma concentrations using advanced methods
        const plasmaResult = this.calculatePlasmaConcentrationsAdvanced(times);

        // Calculate effect-site concentrations using VHAC method
        const effectSiteResult = calculateEffectSiteConcentrations(
            plasmaResult.concentrations,
            times,
            this.pkParams.ke0,
            true  // Use VHAC method
        );
        
        const effectSiteConcentrations = effectSiteResult.concentrations;

        // Calculate BIS values using PD parameters
        const bisValues = effectSiteConcentrations.map(ce => {
            if (this.pdParams) {
                return EleveldPKPDCalculator.calculateBIS(ce, this.pdParams);
            }
            return null;
        });

        // Create time points (sample every 1 minute for display)
        const timePoints = [];
        const sampleInterval = Math.round(1.0 / timeStep);

        for (let i = 0; i < times.length; i += sampleInterval) {
            if (i >= times.length) break;

            const currentTime = times[i];
            const plasma = plasmaResult.concentrations[i];
            const effectSite = effectSiteConcentrations[i];
            const bis = bisValues[i];

            // Find corresponding dose event
            const doseEvent = this.doseEvents.find(event => 
                Math.abs(event.timeInMinutes - currentTime) < 0.5);

            const timePoint = new TimePoint(
                Math.round(currentTime),
                doseEvent || null,
                plasma,
                effectSite,
                bis
            );
            timePoints.push(timePoint);
        }

        this.lastSimulationResult = new SimulationResult(
            timePoints,
            this.patient,
            this.doseEvents,
            this.calculationMethod + " (Eleveld Model)",
            new Date(),
            plasmaResult.concentrations,
            effectSiteConcentrations,
            times,
            bisValues
        );

        console.log('Monitoring simulation completed');
        console.log(`Max plasma concentration: ${this.lastSimulationResult.maxPlasmaConcentration.toFixed(3)} μg/mL`);
        console.log(`Max effect site concentration: ${this.lastSimulationResult.maxEffectSiteConcentration.toFixed(3)} μg/mL`);
        console.log(`Min BIS value: ${this.lastSimulationResult.minBISValue.toFixed(1)}`);

        return this.lastSimulationResult;
    }

    /**
     * Calculate plasma concentrations using 3-compartment model with high precision
     */
    calculatePlasmaConcentrationsAdvanced(times) {
        const timeStep = times.length > 1 ? times[1] - times[0] : this.precision;
        
        let state = new SystemState();
        const plasmaConcentrations = [];
        
        // Process events into bolus and infusion schedules
        const bolusEvents = [];
        const infusionEvents = [];
        
        for (const event of this.doseEvents) {
            const eventTime = event.timeInMinutes;
            
            if (event.bolusMg > 0) {
                bolusEvents.push({ time: eventTime, dose: event.bolusMg });
            }
            
            // Add infusion rate changes (including rate = 0 for stopping infusion)
            const newRate = event.continuousMgHr;
            if (infusionEvents.length === 0 || 
                newRate !== infusionEvents[infusionEvents.length - 1].rate) {
                infusionEvents.push({ time: eventTime, rate: newRate });
            }
        }
        
        // Sort events
        bolusEvents.sort((a, b) => a.time - b.time);
        infusionEvents.sort((a, b) => a.time - b.time);
        
        // Add initial zero infusion if needed
        if (infusionEvents.length === 0 || infusionEvents[0].time > 0) {
            infusionEvents.unshift({ time: 0.0, rate: 0.0 });
        }
        
        let bolusIndex = 0;
        let infusionIndex = 0;
        let currentInfusionRate = 0.0;
        
        // Use RK4 for now due to LSODA stability issues
        // TODO: Fix LSODA implementation in future version
        console.log('Using RK4 integration for monitoring simulation');
        console.log('Bolus events to process:', bolusEvents);
        console.log('Infusion events to process:', infusionEvents);
        return this.calculatePlasmaConcentrationsRK4(times, bolusEvents, infusionEvents);
        
        // LSODA implementation commented out temporarily
        /*
        if (typeof LSODA !== 'undefined') {
            return this.calculatePlasmaConcentrationsLSODA(times, bolusEvents, infusionEvents);
        } else {
            return this.calculatePlasmaConcentrationsRK4(times, bolusEvents, infusionEvents);
        }
        */
    }

    /**
     * LSODA-based plasma concentration calculation
     */
    calculatePlasmaConcentrationsLSODA(times, bolusEvents, infusionEvents) {
        const solver = new PKLSODASolver();
        const pkParams = {
            k10: this.pkParams.k10,
            k12: this.pkParams.k12,
            k21: this.pkParams.k21,
            k13: this.pkParams.k13,
            k31: this.pkParams.k31
        };

        // Prepare infusion rates array
        const infusionRates = times.map(t => {
            const currentEvent = infusionEvents.slice().reverse().find(event => t >= event.time);
            const rate = currentEvent ? currentEvent.rate : 0.0;
            return rate / 60.0; // Convert from mg/hr to mg/min
        });

        try {
            // Convert bolus events to proper format for LSODA
            const bolusDoses = bolusEvents.map(event => ({
                time: event.time,
                amount: event.dose
            }));
            
            console.log('Debug LSODA inputs:');
            console.log('Times length:', times.length, 'First/Last:', times[0], times[times.length-1]);
            console.log('Infusion rates length:', infusionRates.length, 'First few:', infusionRates.slice(0, 3));
            console.log('Bolus doses:', bolusDoses);
            console.log('PK params:', pkParams);
            
            const result = solver.solve3Compartment(
                pkParams,
                times,
                infusionRates,
                bolusDoses,
                [0, 0, 0]
            );

            const concentrations = result.y.map(state => 
                Math.max(0.0, state[0] / this.pkParams.v1)
            );

            console.log('LSODA simulation completed successfully');
            console.log('LSODA result length:', result.y.length);
            console.log('First few states:', result.y.slice(0, 3));
            console.log('First few concentrations:', concentrations.slice(0, 3));
            console.log('Max concentration:', Math.max(...concentrations));
            return {
                concentrations: concentrations,
                method: 'LSODA'
            };
        } catch (error) {
            console.warn('LSODA failed, falling back to RK4:', error);
            return this.calculatePlasmaConcentrationsRK4(times, bolusEvents, infusionEvents);
        }
    }

    /**
     * RK4-based plasma concentration calculation (fallback)
     */
    calculatePlasmaConcentrationsRK4(times, bolusEvents, infusionEvents) {
        const timeStep = times.length > 1 ? times[1] - times[0] : this.precision;
        let state = new SystemState(0.0, 0.0, 0.0); // Explicit initialization
        const plasmaConcentrations = [];
        
        console.log('RK4 starting with timeStep:', timeStep, 'initial state:', state);
        
        let bolusIndex = 0;
        let infusionIndex = 0;
        let currentInfusionRate = 0.0;
        
        for (let index = 0; index < times.length; index++) {
            const currentTime = times[index];
            
            // Apply bolus doses - same logic as original app
            while (bolusIndex < bolusEvents.length && 
                   Math.abs(bolusEvents[bolusIndex].time - currentTime) < timeStep / 2) {
                state.a1 += bolusEvents[bolusIndex].dose;
                console.log(`Applied bolus: ${bolusEvents[bolusIndex].dose}mg at time ${currentTime} (bolus time: ${bolusEvents[bolusIndex].time})`);
                bolusIndex++;
            }
            
            // Update infusion rate
            while (infusionIndex < infusionEvents.length && 
                   currentTime >= infusionEvents[infusionIndex].time) {
                currentInfusionRate = infusionEvents[infusionIndex].rate;
                infusionIndex++;
            }
            
            // Calculate plasma concentration
            const plasmaConc = Math.max(0.0, state.a1 / this.pkParams.v1);
            plasmaConcentrations.push(plasmaConc);
            
            // Update state for next time step using RK4
            if (index < times.length - 1) {
                const infusionRateMgMin = currentInfusionRate / 60.0;
                state = this.updateStateRK4(state, infusionRateMgMin, timeStep);
            }
        }
        
        console.log('RK4 simulation completed');
        console.log('RK4 result length:', plasmaConcentrations.length);
        console.log('First few concentrations:', plasmaConcentrations.slice(0, 5));
        console.log('Max concentration:', Math.max(...plasmaConcentrations));
        console.log('Final concentration:', plasmaConcentrations[plasmaConcentrations.length - 1]);
        
        return {
            concentrations: plasmaConcentrations,
            method: 'RK4'
        };
    }

    /**
     * 4th order Runge-Kutta integration for state update
     */
    updateStateRK4(state, infusionRateMgMin, dt) {
        const { k10, k12, k21, k13, k31 } = this.pkParams;
        
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
        
        return new SystemState(
            state.a1 + (dt / 6.0) * (k1.da1dt + 2*k2.da1dt + 2*k3.da1dt + k4.da1dt),
            state.a2 + (dt / 6.0) * (k1.da2dt + 2*k2.da2dt + 2*k3.da2dt + k4.da2dt),
            state.a3 + (dt / 6.0) * (k1.da3dt + 2*k2.da3dt + 2*k3.da3dt + k4.da3dt)
        );
    }

    getLastResult() {
        return this.lastSimulationResult;
    }

    getChartData() {
        if (!this.lastSimulationResult) return null;
        
        const timePoints = this.lastSimulationResult.timePoints;
        
        return {
            labels: timePoints.map(tp => tp.formattedClockTime(this.patient)),
            plasmaData: timePoints.map(tp => tp.plasmaConcentration),
            effectData: timePoints.map(tp => tp.effectSiteConcentration),
            bisData: timePoints.map(tp => tp.bisValue),
            doseEvents: this.doseEvents.map(event => ({
                time: event.timeInMinutes,
                clockTime: event.formattedClockTime(this.patient),
                bolus: event.bolusMg,
                continuous: event.continuousMgHr
            }))
        };
    }

    exportToCSV() {
        if (!this.lastSimulationResult) {
            throw new Error('No simulation result available for export');
        }
        
        return this.lastSimulationResult.toCSV();
    }

    reset() {
        this.doseEvents = [];
        this.lastSimulationResult = null;
        console.log('Monitoring engine reset');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.MonitoringEngine = MonitoringEngine;
    // calculateEffectSiteHybrid is imported from vhac.js, don't redefine it
    window.calculateEffectSiteDiscrete = calculateEffectSiteDiscrete;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        MonitoringEngine, 
        calculateEffectSiteDiscrete 
    };
}