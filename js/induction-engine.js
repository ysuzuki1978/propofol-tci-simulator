/**
 * Induction Engine for Remimazolam TCI TIVA V4.1
 * リアルタイム導入予測エンジン
 * 
 * Features:
 * - Real-time plasma and effect-site concentration calculation
 * - RK4 and Euler integration methods
 * - Snapshot recording functionality
 * - Continuous and bolus dosing support
 */

class InductionEngine {
    constructor() {
        this.isRunning = false;
        this.startTime = null;
        this.elapsedTime = 0;
        this.patient = null;
        this.pkParams = null;
        this.pdParams = null;  // BIS calculation parameters
        this.state = { a1: 0, a2: 0, a3: 0, ce: 0 };
        this.bolusDose = 0;
        this.continuousDose = 0;
        this.snapshots = [];
        this.timer = null;
        this.useRK4 = true; // Use RK4 as primary method
        this.updateCallbacks = [];
        this.bisValue = 100.0;  // Initialize BIS value
    }

    addUpdateCallback(callback) {
        this.updateCallbacks.push(callback);
    }

    removeUpdateCallback(callback) {
        const index = this.updateCallbacks.indexOf(callback);
        if (index > -1) {
            this.updateCallbacks.splice(index, 1);
        }
    }

    notifyCallbacks() {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(this.getState());
            } catch (error) {
                console.error('Error in update callback:', error);
            }
        });
    }

    start(patient, bolusDose, continuousDose) {
        if (this.isRunning) {
            console.warn('Induction already running');
            return false;
        }

        if (!patient) {
            throw new Error('Patient is required');
        }

        console.log('Starting induction simulation:', { bolusDose, continuousDose });

        this.patient = patient;
        this.pkParams = this.calculatePKParameters(patient);
        // Set pkParams on patient object for unified access
        this.patient.pkParams = this.pkParams;
        this.patient.pdParams = this.pdParams;
        this.bolusDose = bolusDose;
        this.continuousDose = continuousDose;
        this.state = { a1: bolusDose, a2: 0, a3: 0, ce: 0 };
        this.startTime = new Date();
        this.elapsedTime = 0;
        this.snapshots = [];
        this.isRunning = true;

        // Use RK4 as primary integration method with Euler fallback
        console.log('Using RK4 integration method with Euler fallback');

        this.timer = setInterval(() => {
            this.updateSimulation();
            this.notifyCallbacks();
        }, 600);

        this.notifyCallbacks();
        return true;
    }

    stop() {
        if (!this.isRunning) return false;

        console.log('Stopping induction simulation');
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        this.notifyCallbacks();
        return true;
    }

    takeSnapshot() {
        if (!this.isRunning) return null;

        const snapshot = new InductionSnapshot(
            new Date(),
            this.getPlasmaConcentration(),
            this.getEffectSiteConcentration(),
            this.elapsedTime,
            { bolus: this.bolusDose, continuous: this.continuousDose }
        );
        
        this.snapshots.unshift(snapshot);
        
        // Limit to 10 snapshots
        if (this.snapshots.length > 10) {
            this.snapshots = this.snapshots.slice(0, 10);
        }
        
        console.log('Snapshot taken:', snapshot);
        return snapshot;
    }

    updateSimulation() {
        if (!this.isRunning || !this.startTime) return;

        this.elapsedTime += 0.01; // Fixed simulation time increment (0.01 min = 0.6s precision)
        
        // Use RK4 for accurate integration
        this.updateSimulationRK4();
        
        // Calculate BIS value from effect-site concentration
        this.updateBISValue();
    }

    updateSimulationRK4() {
        try {
            const dt = 0.01; // 0.01 minute time step
            const infusionRateMgMin = this.continuousDose / 60.0; // Convert mg/hr to mg/min
            
            // Update system state using RK4 (includes effect-site concentration)
            this.state = this.updateSystemStateRK4(this.state, infusionRateMgMin, dt);
            
        } catch (error) {
            console.warn('RK4 integration failed, falling back to Euler method:', error);
            this.updateSimulationEuler();
        }
    }

    updateSimulationEuler() {
        const dt = 0.01; // Use same 0.01 minute time step as RK4
        const infusionRateMgMin = this.continuousDose / 60.0;
        
        // Update state using unified Euler method
        this.state = this.updateSystemStateEuler(this.state, infusionRateMgMin, dt);
        
        // Ensure non-negative values
        this.state.a1 = Math.max(0, this.state.a1);
        this.state.a2 = Math.max(0, this.state.a2);
        this.state.a3 = Math.max(0, this.state.a3);
        this.state.ce = Math.max(0, this.state.ce);
    }



    calculatePKParameters(patient) {
        console.log('Calculating PK parameters for induction with Eleveld model');
        
        // Use the Eleveld PK-PD calculator
        const modelParams = EleveldPKPDCalculator.getModelParameters(patient);
        
        // Validate parameters
        const validation = EleveldPKPDCalculator.validateParameters(modelParams);
        if (!validation.isValid) {
            throw new Error('Invalid Eleveld model parameters: ' + validation.errors.join(', '));
        }
        
        // Store PD parameters for BIS calculation
        this.pdParams = modelParams.pd;
        
        console.log('Eleveld PK/PD parameters calculated successfully for induction');
        
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

    getPlasmaConcentration() {
        return this.state.a1 / this.pkParams.v1;
    }

    getEffectSiteConcentration() {
        return this.state.ce;
    }

    updateBISValue() {
        if (this.pdParams) {
            const effectSiteConc = this.getEffectSiteConcentration();
            this.bisValue = EleveldPKPDCalculator.calculateBIS(effectSiteConc, this.pdParams);
        }
    }

    getBISValue() {
        return this.bisValue;
    }

    getElapsedTimeString() {
        // elapsedTime is in minutes, convert to seconds for display
        const totalSeconds = this.elapsedTime * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getIntegrationMethod() {
        return this.useRK4 ? 'RK4 (with Euler fallback)' : 'Euler';
    }

    getIntegrationStats() {
        return {
            method: this.useRK4 ? 'RK4' : 'Euler',
            timeStep: 0.01,
            precision: 'minute'
        };
    }

    getState() {
        return {
            isRunning: this.isRunning,
            elapsedTime: this.elapsedTime,
            elapsedTimeString: this.getElapsedTimeString(),
            plasmaConcentration: this.getPlasmaConcentration(),
            effectSiteConcentration: this.getEffectSiteConcentration(),
            bisValue: this.getBISValue(),
            integrationMethod: this.getIntegrationMethod(),
            integrationStats: this.getIntegrationStats(),
            snapshots: [...this.snapshots],
            patient: this.patient,
            dose: {
                bolus: this.bolusDose,
                continuous: this.continuousDose
            }
        };
    }

    updateDose(bolusDose, continuousDose) {
        if (!this.isRunning) return false;
        
        console.log('Updating dose:', { bolusDose, continuousDose });
        this.bolusDose = bolusDose;
        this.continuousDose = continuousDose;
        this.notifyCallbacks();
        return true;
    }

    reset() {
        this.stop();
        this.patient = null;
        this.pkParams = null;
        this.pdParams = null;
        this.state = { a1: 0, a2: 0, a3: 0, ce: 0 };
        this.bolusDose = 0;
        this.continuousDose = 0;
        this.snapshots = [];
        this.elapsedTime = 0;
        this.bisValue = 100.0;
        this.notifyCallbacks();
    }

    /**
     * Unified RK4 method as per numerical-unification-guide.yml
     * Includes 4-compartment system: a1, a2, a3, and effect-site concentration
     */
    updateSystemStateRK4(state, infusionRateMgMin, dt) {
        const { k10, k12, k21, k13, k31, ke0, v1 } = this.patient.pkParams;
        
        const derivatives = (s) => {
            const plasmaConc = s.a1 / v1;
            return {
                da1dt: infusionRateMgMin - (k10 + k12 + k13) * s.a1 + k21 * s.a2 + k31 * s.a3,
                da2dt: k12 * s.a1 - k21 * s.a2,
                da3dt: k13 * s.a1 - k31 * s.a3,
                dcedt: ke0 * (plasmaConc - s.ce)
            };
        };
        
        const k1 = derivatives(state);
        const k2 = derivatives({
            a1: state.a1 + 0.5 * dt * k1.da1dt,
            a2: state.a2 + 0.5 * dt * k1.da2dt,
            a3: state.a3 + 0.5 * dt * k1.da3dt,
            ce: state.ce + 0.5 * dt * k1.dcedt
        });
        const k3 = derivatives({
            a1: state.a1 + 0.5 * dt * k2.da1dt,
            a2: state.a2 + 0.5 * dt * k2.da2dt,
            a3: state.a3 + 0.5 * dt * k2.da3dt,
            ce: state.ce + 0.5 * dt * k2.dcedt
        });
        const k4 = derivatives({
            a1: state.a1 + dt * k3.da1dt,
            a2: state.a2 + dt * k3.da2dt,
            a3: state.a3 + dt * k3.da3dt,
            ce: state.ce + dt * k3.dcedt
        });
        
        return {
            a1: state.a1 + (dt / 6.0) * (k1.da1dt + 2*k2.da1dt + 2*k3.da1dt + k4.da1dt),
            a2: state.a2 + (dt / 6.0) * (k1.da2dt + 2*k2.da2dt + 2*k3.da2dt + k4.da2dt),
            a3: state.a3 + (dt / 6.0) * (k1.da3dt + 2*k2.da3dt + 2*k3.da3dt + k4.da3dt),
            ce: state.ce + (dt / 6.0) * (k1.dcedt + 2*k2.dcedt + 2*k3.dcedt + k4.dcedt)
        };
    }

    /**
     * Unified Euler method for fallback
     * Includes 4-compartment system: a1, a2, a3, and effect-site concentration
     */
    updateSystemStateEuler(state, infusionRateMgMin, dt) {
        const { k10, k12, k21, k13, k31, ke0, v1 } = this.patient.pkParams;
        
        const plasmaConc = state.a1 / v1;
        
        const da1dt = infusionRateMgMin - (k10 + k12 + k13) * state.a1 + k21 * state.a2 + k31 * state.a3;
        const da2dt = k12 * state.a1 - k21 * state.a2;
        const da3dt = k13 * state.a1 - k31 * state.a3;
        const dcedt = ke0 * (plasmaConc - state.ce);
        
        return {
            a1: state.a1 + dt * da1dt,
            a2: state.a2 + dt * da2dt,
            a3: state.a3 + dt * da3dt,
            ce: state.ce + dt * dcedt
        };
    }

    /**
     * Get current effect-site concentration from state (calculated by RK4/Euler integration)
     */
    getEffectSiteConcentration() {
        return Math.max(0, this.state.ce);
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.InductionEngine = InductionEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InductionEngine };
}