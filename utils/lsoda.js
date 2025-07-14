// LSODA (Livermore Solver for Ordinary Differential Equations with Automatic method switching)
// JavaScript implementation for pharmacokinetic calculations
// Based on the FORTRAN LSODA by Hindmarsh & Petzold

class LSODA {
    constructor() {
        // LSODA parameters
        this.mxstep = 500;  // Maximum number of steps
        this.mxhnil = 10;   // Maximum number of messages for t + h = t
        this.mxordn = 12;   // Maximum order for non-stiff methods
        this.mxords = 5;    // Maximum order for stiff methods
        
        // Tolerances
        this.rtol = 1e-6;   // Relative tolerance
        this.atol = 1e-12;  // Absolute tolerance
        
        // Current state
        this.method = 1;    // 1 = non-stiff (Adams), 2 = stiff (BDF)
        this.order = 1;     // Current order
        this.h = 0.0;      // Current step size
        this.tn = 0.0;     // Current time
        this.jstart = 0;   // Start indicator
        
        // Coefficients for Adams methods
        this.elco = this.initElco();
        this.tesco = this.initTesco();
    }
    
    initElco() {
        const elco = Array(13).fill(null).map(() => Array(14).fill(0));
        
        // Adams-Bashforth coefficients
        elco[1][1] = 1.0;
        elco[1][2] = 1.0;
        
        elco[2][1] = 2.0/3.0;
        elco[2][2] = 3.0/2.0;
        elco[2][3] = -1.0/2.0;
        
        elco[3][1] = 3.0/4.0;
        elco[3][2] = 23.0/12.0;
        elco[3][3] = -4.0/3.0;
        elco[3][4] = 5.0/12.0;
        
        // Additional orders can be computed dynamically
        for (let i = 4; i <= 12; i++) {
            this.computeElcoRow(elco, i);
        }
        
        return elco;
    }
    
    computeElcoRow(elco, nq) {
        const agamq = this.computeGamma(nq);
        const fnq = nq;
        const pint = 1.0;
        
        elco[nq][1] = pint / agamq;
        
        for (let i = 2; i <= nq; i++) {
            elco[nq][i] = elco[nq-1][i-1] * fnq / (fnq - i + 1);
        }
        
        elco[nq][nq+1] = -elco[nq-1][nq] * fnq / (fnq + 1);
    }
    
    computeGamma(n) {
        let gamma = 1.0;
        for (let i = 2; i <= n; i++) {
            gamma *= i;
        }
        return gamma;
    }
    
    initTesco() {
        const tesco = Array(13).fill(null).map(() => Array(4).fill(0));
        
        // Error coefficients
        tesco[1][1] = 0.0;
        tesco[1][2] = 2.0;
        tesco[2][1] = -1.0/2.0;
        tesco[2][2] = -1.0/12.0;
        tesco[3][1] = -1.0/12.0;
        tesco[3][2] = -1.0/24.0;
        
        return tesco;
    }
    
    /**
     * Main LSODA integration function
     * @param {Function} f - Derivative function f(t, y) returns dy/dt
     * @param {Array} y0 - Initial conditions
     * @param {Array} t - Time points
     * @param {Object} options - Integration options
     */
    integrate(f, y0, t, options = {}) {
        const neq = y0.length;
        const ntout = t.length;
        
        // Initialize
        this.rtol = options.rtol || 1e-6;
        this.atol = options.atol || 1e-12;
        this.mxstep = options.mxstep || 500;
        
        let y = [...y0];
        const solution = [y0.slice()];
        
        this.tn = t[0];
        // Improved initial step size calculation
        const dt_max = Math.abs(t[1] - t[0]);
        this.h = Math.min(dt_max * 0.1, 0.1); // More conservative initial step
        this.jstart = 0;
        this.method = 1; // Start with non-stiff
        this.order = 1;
        
        // Nordsieck history array
        const yh = Array(neq).fill(null).map(() => Array(14).fill(0));
        for (let i = 0; i < neq; i++) {
            yh[i][1] = y[i];
        }
        
        // Main integration loop
        for (let iout = 1; iout < ntout; iout++) {
            const tout = t[iout];
            
            while (this.tn < tout - 1e-12) { // Add small tolerance to avoid numerical issues
                // Check if we can reach tout in one step
                const remaining = tout - this.tn;
                if (Math.abs(this.h) > remaining) {
                    this.h = remaining;
                }
                
                // Attempt a step
                const result = this.step(f, y, yh, neq);
                
                if (!result.success) {
                    throw new Error(`LSODA failed at t = ${this.tn}: ${result.message}`);
                }
                
                y = result.y;
            }
            
            // Ensure we're exactly at tout
            this.tn = tout;
            solution.push(y.slice());
        }
        
        return {
            t: t.slice(),
            y: solution,
            stats: {
                nsteps: this.nsteps || 0,
                nfe: this.nfe || 0,
                method: this.method
            }
        };
    }
    
    /**
     * Single integration step
     */
    step(f, y, yh, neq) {
        const hmin = 1e-12; // More reasonable minimum step size
        let nsteps = 0;
        const maxsteps = this.mxstep;
        
        while (nsteps < maxsteps) {
            nsteps++;
            
            // Predict
            this.predict(yh, neq);
            
            // Evaluate derivative
            const t_pred = this.tn + this.h;
            const y_pred = yh.map(row => row[1]);
            
            // Add safety check for y_pred values
            const y_safe = y_pred.map(val => isFinite(val) ? Math.max(0, val) : 0);
            
            const dydt = f(t_pred, y_safe);
            
            // Safety check for derivatives
            if (!dydt || dydt.some(val => !isFinite(val))) {
                this.h *= 0.5;
                if (Math.abs(this.h) < hmin) {
                    return {
                        success: false,
                        message: `Invalid derivatives at t = ${t_pred}`
                    };
                }
                continue;
            }
            
            // Correct
            const corrResult = this.correct(yh, dydt, neq);
            
            if (corrResult.success) {
                // Accept step
                this.tn += this.h;
                
                // Update solution
                for (let i = 0; i < neq; i++) {
                    y[i] = Math.max(0, yh[i][1]); // Ensure non-negative values
                }
                
                // Choose next step size and order
                this.selectStepAndOrder(corrResult.error);
                
                return {
                    success: true,
                    y: y.slice(),
                    h: this.h
                };
            } else {
                // Reduce step size and retry
                this.h *= 0.5; // Less aggressive reduction
                if (Math.abs(this.h) < hmin) {
                    return {
                        success: false,
                        message: `Step size too small: ${this.h}`
                    };
                }
            }
        }
        
        return {
            success: false,
            message: `Maximum steps (${maxsteps}) exceeded`
        };
    }
    
    predict(yh, neq) {
        for (let j = this.order; j >= 1; j--) {
            for (let i = 0; i < neq; i++) {
                yh[i][j] += yh[i][j+1];
            }
        }
    }
    
    correct(yh, dydt, neq) {
        const el = this.elco[this.order];
        const el0 = el[1];
        
        let errmax = 0.0;
        
        for (let i = 0; i < neq; i++) {
            const acor = this.h * dydt[i] - yh[i][2];
            yh[i][1] += el0 * acor;
            yh[i][2] = acor;
            
            // Estimate error
            const err = Math.abs(acor) / (this.atol + this.rtol * Math.abs(yh[i][1]));
            errmax = Math.max(errmax, err);
        }
        
        const success = errmax <= 1.0;
        
        return {
            success,
            error: errmax,
            dydt
        };
    }
    
    selectStepAndOrder(errmax) {
        const factor = Math.max(0.1, Math.min(5.0, Math.pow(2.0 / errmax, 1.0 / (this.order + 1))));
        this.h *= 0.9 * factor;
        
        // Order selection logic (simplified)
        if (errmax < 0.1 && this.order < this.mxordn) {
            this.order++;
        } else if (errmax > 0.5 && this.order > 1) {
            this.order--;
        }
    }
}

// Specialized LSODA for pharmacokinetic systems
class PKLSODASolver {
    constructor() {
        this.lsoda = new LSODA();
    }
    
    /**
     * Solve 3-compartment PK model with continuous infusion
     * @param {Object} pkParams - PK parameters {k10, k12, k21, k13, k31}
     * @param {Array} times - Time points
     * @param {Array} infusionRates - Infusion rates at each time point
     * @param {Array} bolusEvents - Bolus events [{time, amount}]
     * @param {Array} y0 - Initial conditions [a1, a2, a3]
     */
    solve3Compartment(pkParams, times, infusionRates, bolusEvents = [], y0 = [0, 0, 0]) {
        const {k10, k12, k21, k13, k31} = pkParams;
        
        // Create interpolation function for infusion rates
        const getInfusionRate = (t) => {
            const index = Math.min(Math.floor(t / (times[1] - times[0])), infusionRates.length - 1);
            return infusionRates[index] || 0;
        };
        
        // Check for bolus events
        const getBolus = (t) => {
            const bolus = bolusEvents.find(event => Math.abs(event.time - t) < 1e-6);
            return bolus ? bolus.amount : 0;
        };
        
        // Define the ODE system
        const odeSystem = (t, y) => {
            const [a1, a2, a3] = y;
            const infusionRate = getInfusionRate(t);
            
            const da1dt = infusionRate - k10 * a1 - k12 * a1 + k21 * a2 - k13 * a1 + k31 * a3;
            const da2dt = k12 * a1 - k21 * a2;
            const da3dt = k13 * a1 - k31 * a3;
            
            return [da1dt, da2dt, da3dt];
        };
        
        // Handle bolus events by splitting integration
        const solution = {t: [], y: []};
        let currentY = [...y0];
        let startTime = times[0];
        
        for (let i = 1; i < times.length; i++) {
            const endTime = times[i];
            const timeSpan = [startTime, endTime];
            
            // Check for bolus events in this interval
            const bolusInInterval = bolusEvents.filter(event => 
                event.time > startTime && event.time <= endTime
            );
            
            if (bolusInInterval.length > 0) {
                // Split integration at bolus events
                for (const bolus of bolusInInterval) {
                    if (bolus.time > startTime) {
                        // Integrate to bolus time
                        const partialSpan = [startTime, bolus.time];
                        const partialResult = this.lsoda.integrate(odeSystem, currentY, partialSpan, {
                            rtol: 1e-8,
                            atol: 1e-12
                        });
                        
                        // Add results (excluding last point to avoid duplication)
                        for (let j = solution.t.length === 0 ? 0 : 1; j < partialResult.t.length - 1; j++) {
                            solution.t.push(partialResult.t[j]);
                            solution.y.push(partialResult.y[j]);
                        }
                        
                        currentY = partialResult.y[partialResult.y.length - 1];
                    }
                    
                    // Apply bolus
                    currentY[0] += bolus.amount;
                    startTime = bolus.time;
                }
            }
            
            // Integrate remaining interval
            if (startTime < endTime) {
                const finalSpan = [startTime, endTime];
                const finalResult = this.lsoda.integrate(odeSystem, currentY, finalSpan, {
                    rtol: 1e-8,
                    atol: 1e-12
                });
                
                // Add results
                for (let j = solution.t.length === 0 ? 0 : 1; j < finalResult.t.length; j++) {
                    solution.t.push(finalResult.t[j]);
                    solution.y.push(finalResult.y[j]);
                }
                
                currentY = finalResult.y[finalResult.y.length - 1];
            }
            
            startTime = endTime;
        }
        
        return solution;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LSODA, PKLSODASolver };
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.LSODA = LSODA;
    window.PKLSODASolver = PKLSODASolver;
}