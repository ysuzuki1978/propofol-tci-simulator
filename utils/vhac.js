/**
 * VHAC (Variable-step Hybrid Algorithm for Ce) Implementation
 * 効果部位濃度計算のための高精度ハイブリッドアルゴリズム
 * 
 * Based on Remimazolam Java Graph V3 implementation
 * Provides analytical solutions for effect-site concentration calculation
 */

/**
 * Calculate effect-site concentrations using VHAC method
 * 血漿濃度から効果部位濃度を高精度で計算
 * 
 * @param {number[]} plasmaConcentrations - Array of plasma concentrations (μg/mL)
 * @param {number[]} timePoints - Array of time points (minutes)
 * @param {number} ke0 - Effect-site equilibration rate constant (1/min)
 * @returns {number[]} Array of effect-site concentrations (μg/mL)
 */
function calculateEffectSiteHybrid(plasmaConcentrations, timePoints, ke0) {
    if (!plasmaConcentrations || !timePoints || plasmaConcentrations.length !== timePoints.length) {
        throw new Error('Invalid input: plasma concentrations and time points must be arrays of equal length');
    }
    
    if (ke0 <= 0) {
        throw new Error('Invalid ke0: must be positive');
    }
    
    const ceValues = new Array(timePoints.length).fill(0);
    ceValues[0] = 0.0; // Initial effect-site concentration is zero
    
    for (let i = 1; i < timePoints.length; i++) {
        const dt = timePoints[i] - timePoints[i-1];
        const cpCurrent = plasmaConcentrations[i];
        const cpPrev = plasmaConcentrations[i-1];
        const cePrev = ceValues[i-1];
        
        if (dt <= 0) {
            throw new Error(`Invalid time step at index ${i}: time must be monotonically increasing`);
        }
        
        // Scenario 1: Plasma concentration is essentially constant
        // 血漿濃度が定数の場合、解析解を使用
        if (Math.abs(cpCurrent - cpPrev) < 1e-6) {
            ceValues[i] = cpCurrent + (cePrev - cpCurrent) * Math.exp(-ke0 * dt);
        } else {
            // Scenario 2 & 3: Plasma concentration changes linearly
            // 血漿濃度が変化する場合、線形補間 + 解析解を使用
            const slope = (cpCurrent - cpPrev) / dt;
            
            // Scenario 2: Very small time step - use Taylor expansion for numerical stability
            // 非常に小さい時間ステップにはテイラー展開を使用
            if (Math.abs(ke0 * dt) < 0.001) {
                ceValues[i] = cePrev + dt * ke0 * (cpPrev - cePrev) + 
                             dt * dt * ke0 * slope / 2;
            } else {
                // Scenario 3: General analytical solution for linearly changing plasma concentration
                // 線形血漿濃度変化の一般的な解析解
                const expTerm = Math.exp(-ke0 * dt);
                ceValues[i] = cpCurrent + 
                             (cePrev - cpPrev + slope/ke0) * expTerm - 
                             slope/ke0;
            }
        }
        
        // Ensure non-negative concentration
        ceValues[i] = Math.max(0.0, ceValues[i]);
    }
    
    return ceValues;
}

/**
 * Calculate effect-site concentrations using simple first-order kinetics (fallback)
 * シンプルな1次反応による効果部位濃度計算（フォールバック）
 * 
 * @param {number[]} plasmaConcentrations - Array of plasma concentrations (μg/mL)
 * @param {number[]} timePoints - Array of time points (minutes)
 * @param {number} ke0 - Effect-site equilibration rate constant (1/min)
 * @returns {number[]} Array of effect-site concentrations (μg/mL)
 */
function calculateEffectSiteSimple(plasmaConcentrations, timePoints, ke0) {
    const ceValues = new Array(timePoints.length).fill(0);
    ceValues[0] = 0.0;
    
    for (let i = 1; i < timePoints.length; i++) {
        const dt = timePoints[i] - timePoints[i-1];
        const cpCurrent = plasmaConcentrations[i];
        const cePrev = ceValues[i-1];
        
        // Simple first-order differential equation: dCe/dt = ke0 * (Cp - Ce)
        // Euler integration
        const dCedt = ke0 * (cpCurrent - cePrev);
        ceValues[i] = Math.max(0.0, cePrev + dt * dCedt);
    }
    
    return ceValues;
}

/**
 * Validate VHAC calculation parameters
 * VHAC計算パラメータの検証
 * 
 * @param {number[]} plasmaConcentrations - Plasma concentration array
 * @param {number[]} timePoints - Time points array
 * @param {number} ke0 - Effect-site rate constant
 * @returns {object} Validation result with isValid flag and error messages
 */
function validateVHACParameters(plasmaConcentrations, timePoints, ke0) {
    const errors = [];
    
    if (!Array.isArray(plasmaConcentrations)) {
        errors.push('Plasma concentrations must be an array');
    }
    
    if (!Array.isArray(timePoints)) {
        errors.push('Time points must be an array');
    }
    
    if (plasmaConcentrations && timePoints && plasmaConcentrations.length !== timePoints.length) {
        errors.push('Plasma concentrations and time points must have equal length');
    }
    
    if (typeof ke0 !== 'number' || ke0 <= 0) {
        errors.push('ke0 must be a positive number');
    }
    
    if (timePoints && timePoints.length < 2) {
        errors.push('At least 2 time points are required');
    }
    
    // Check for monotonically increasing time points
    if (timePoints) {
        for (let i = 1; i < timePoints.length; i++) {
            if (timePoints[i] <= timePoints[i-1]) {
                errors.push(`Time points must be monotonically increasing (violation at index ${i})`);
                break;
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Calculate effect-site concentrations with automatic method selection
 * 自動手法選択による効果部位濃度計算
 * 
 * @param {number[]} plasmaConcentrations - Array of plasma concentrations (μg/mL)
 * @param {number[]} timePoints - Array of time points (minutes)
 * @param {number} ke0 - Effect-site equilibration rate constant (1/min)
 * @param {boolean} useVHAC - Use VHAC method if true, simple method if false
 * @returns {object} Result object with concentrations and method used
 */
function calculateEffectSiteConcentrations(plasmaConcentrations, timePoints, ke0, useVHAC = true) {
    // Validate parameters
    const validation = validateVHACParameters(plasmaConcentrations, timePoints, ke0);
    if (!validation.isValid) {
        throw new Error('VHAC validation failed: ' + validation.errors.join(', '));
    }
    
    try {
        if (useVHAC) {
            const concentrations = calculateEffectSiteHybrid(plasmaConcentrations, timePoints, ke0);
            return {
                concentrations: concentrations,
                method: 'VHAC',
                success: true
            };
        } else {
            const concentrations = calculateEffectSiteSimple(plasmaConcentrations, timePoints, ke0);
            return {
                concentrations: concentrations,
                method: 'Simple',
                success: true
            };
        }
    } catch (error) {
        console.warn('VHAC calculation failed, falling back to simple method:', error);
        
        // Fallback to simple method
        try {
            const concentrations = calculateEffectSiteSimple(plasmaConcentrations, timePoints, ke0);
            return {
                concentrations: concentrations,
                method: 'Simple (fallback)',
                success: true
            };
        } catch (fallbackError) {
            console.error('Both VHAC and simple methods failed:', fallbackError);
            return {
                concentrations: new Array(timePoints.length).fill(0),
                method: 'Failed',
                success: false,
                error: fallbackError.message
            };
        }
    }
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    // Browser environment
    window.calculateEffectSiteHybrid = calculateEffectSiteHybrid;
    window.calculateEffectSiteSimple = calculateEffectSiteSimple;
    window.calculateEffectSiteConcentrations = calculateEffectSiteConcentrations;
    window.validateVHACParameters = validateVHACParameters;
}

if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        calculateEffectSiteHybrid,
        calculateEffectSiteSimple,
        calculateEffectSiteConcentrations,
        validateVHACParameters
    };
}