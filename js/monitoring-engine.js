/**
 * Monitoring Engine for Remimazolam TCI TIVA V4.1
 * 実投与量監視エンジン
 * 
 * Features:
 * - High-precision effect-site concentration calculation
 * - RK4 integration with high precision
 * - Real-time dose event management
 * - Advanced pharmacokinetic simulation
 */


class MonitoringEngine {
    constructor() {
        this.patient = null;
        this.pkParams = null;
        this.doseEvents = [];
        this.lastSimulationResult = null;
        this.calculationMethod = 'Unified RK4';
        this.precision = 0.1; // 0.1-minute time step
    }

    setPatient(patient) {
        this.patient = patient;
        this.pkParams = this.calculatePKParameters(patient);
        // Set pkParams on patient object for unified access
        this.patient.pkParams = this.pkParams;
        this.patient.pdParams = this.pdParams;
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

        console.log('Running monitoring simulation with RK4 engine');

        // Determine simulation duration
        const maxEventTime = Math.max(...this.doseEvents.map(event => event.timeInMinutes));
        const finalDuration = simulationDurationMin || (maxEventTime + 120.0);

        // Create time sequence
        const timeStep = this.precision;
        const numSteps = Math.round(finalDuration / timeStep);
        const times = [];
        for (let i = 0; i <= numSteps; i++) {
            times.push(i * timeStep);
        }

        // Plasma and effect-site concentrations from one RK4 integration
        const plasmaResult = this.calculatePlasmaConcentrationsAdvanced(times);
        const effectSiteConcentrations = plasmaResult.effectSite;

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
        
        // Initialize state with t=0 bolus as initial condition (unified bolus processing)
        let initialBolus = 0;
        const bolusEvents = [];
        const infusionEvents = [];
        
        for (const event of this.doseEvents) {
            const eventTime = event.timeInMinutes;
            
            if (event.bolusMg > 0) {
                if (eventTime === 0) {
                    // t=0 bolus becomes initial condition
                    initialBolus += event.bolusMg;
                } else {
                    // Non-zero time bolus events (future implementation)
                    bolusEvents.push({ time: eventTime, dose: event.bolusMg });
                }
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
        
        console.log('Using RK4 integration for monitoring simulation');
        console.log('Bolus events to process:', bolusEvents);
        console.log('Infusion events to process:', infusionEvents);
        return this.integrateConcentrations(times, bolusEvents, infusionEvents);
    }

    /**
     * RK4 integration of plasma and effect-site concentrations over the time grid
     */
    integrateConcentrations(times, bolusEvents, infusionEvents) {
        const timeStep = times.length > 1 ? times[1] - times[0] : this.precision;
        
        // Calculate initial bolus dose for t=0
        let initialBolus = 0;
        for (const event of this.doseEvents) {
            if (event.timeInMinutes === 0 && event.bolusMg > 0) {
                initialBolus += event.bolusMg;
            }
        }
        
        let state = { a1: initialBolus, a2: 0.0, a3: 0.0, ce: 0.0 }; // Initialize with bolus dose
        const plasmaConcentrations = [];
        const effectSiteConcentrations = [];
        
        console.log('RK4 starting with timeStep:', timeStep, 'initial bolus:', initialBolus, 'initial state:', state);
        
        let bolusIndex = 0;
        let infusionIndex = 0;
        let currentInfusionRate = 0.0;
        
        for (let index = 0; index < times.length; index++) {
            const currentTime = times[index];
            
            // Apply bolus doses - exclude t=0 boluses (already in initial condition)
            while (bolusIndex < bolusEvents.length && 
                   Math.abs(bolusEvents[bolusIndex].time - currentTime) < timeStep / 2) {
                if (bolusEvents[bolusIndex].time > 0) { // Only apply non-zero time boluses
                    state.a1 += bolusEvents[bolusIndex].dose;
                    console.log(`Applied bolus: ${bolusEvents[bolusIndex].dose}mg at time ${currentTime} (bolus time: ${bolusEvents[bolusIndex].time})`);
                }
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
            effectSiteConcentrations.push(state.ce);
            
            // Update state for next time step using RK4
            if (index < times.length - 1) {
                const infusionRateMgMin = currentInfusionRate / 60.0;
                state = PKIntegrator.rk4Step(state, this.pkParams, infusionRateMgMin, timeStep);
            }
        }
        
        console.log('RK4 simulation completed');
        console.log('RK4 result length:', plasmaConcentrations.length);
        console.log('First few concentrations:', plasmaConcentrations.slice(0, 5));
        console.log('Max concentration:', Math.max(...plasmaConcentrations));
        console.log('Final concentration:', plasmaConcentrations[plasmaConcentrations.length - 1]);
        
        return {
            concentrations: plasmaConcentrations,
            effectSite: effectSiteConcentrations,
            method: 'RK4'
        };
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

    exportToCSV(locCe = null) {
        if (!this.lastSimulationResult) {
            throw new Error('No simulation result available for export');
        }

        return this.lastSimulationResult.toCSV(locCe);
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MonitoringEngine };
}