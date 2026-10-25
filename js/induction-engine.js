/**
 * Induction Engine for Remimazolam TCI TIVA V4.1
 * リアルタイム導入予測エンジン
 * 
 * Features:
 * - Real-time plasma and effect-site concentration calculation
 * - RK4 integration (shared PKIntegrator)
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
        this.updateCallbacks = [];
        this.bisValue = 100.0;  // Initialize BIS value
    }

    addUpdateCallback(callback) {
        this.updateCallbacks.push(callback);
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
        
        // One RK4 step of the 3-compartment + effect-site system (0.01 min)
        const infusionMgPerMin = this.continuousDose / 60.0;
        this.state = PKIntegrator.rk4Step(this.state, this.pkParams, infusionMgPerMin, 0.01);
        
        // Calculate BIS value from effect-site concentration
        this.updateBISValue();
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
        return 'RK4';
    }

    getIntegrationStats() {
        return {
            method: 'RK4',
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
     * Get current effect-site concentration from state (calculated by RK4 integration)
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