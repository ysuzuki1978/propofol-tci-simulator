/**
 * Remimazolam PK-PD Calculator - Adapter for Masui Model
 * レミマゾラム薬物動態・薬力学計算アダプター
 * 
 * Features:
 * - Masui ke0 model integration
 * - Eleveld interface compatibility
 * - Appropriate remimazolam-specific defaults
 * - Clinical safety parameters
 */

class RemimazolamPKPDCalculator {
    
    /**
     * Get combined PK/PD parameters for remimazolam using Masui model
     */
    static getModelParameters(patient) {
        console.log('Calculating remimazolam PK/PD parameters using Masui model');
        
        try {
            // Convert patient data to Masui model format
            const age = patient.age;
            const TBW = patient.weight;
            const height = patient.height;
            const sex = patient.sex === SexType.MALE ? 0 : 1; // Masui uses 0=male, 1=female
            const ASAPS = patient.asaPS === AsapsType.CLASS_1_2 ? 1 : 3; // Convert to numeric
            
            // Calculate using Masui model
            const masuiResults = MasuiKe0Calculator.calculateKe0Complete(age, TBW, height, sex, ASAPS);
            
            if (!masuiResults.success) {
                throw new Error('Masui model calculation failed: ' + masuiResults.error);
            }
            
            // Extract PK parameters and convert to standard format
            const pkParams = masuiResults.pkParameters;
            const rateConstants = masuiResults.rateConstants;
            const ke0 = masuiResults.ke0_numerical || masuiResults.ke0_regression;
            
            // Create PKParameters object compatible with existing code
            const pk = new PKParameters(
                pkParams.V1,    // L
                pkParams.V2,    // L
                pkParams.V3,    // L
                pkParams.CL,    // L/min
                pkParams.Q2,    // L/min
                pkParams.Q3,    // L/min
                ke0             // min^-1
            );
            
            // Note: Rate constants (k10, k12, k21, k13, k31) are automatically calculated
            // as getter properties in PKParameters class based on CL, Q2, Q3, V1, V2, V3
            
            // Create PDParameters with remimazolam-specific defaults
            // Note: Masui model focuses on PK; PD parameters are clinical estimates
            const pd = new PDParameters(
                1.0,  // ce50: Appropriate target for remimazolam (μg/mL)
                ke0,  // ke0: Use calculated value from Masui model
                95,   // bis_baseline: Typical awake BIS value
                1.4,  // gamma_low: Slope parameter for low concentrations
                1.4   // gamma_high: Slope parameter for high concentrations
            );
            
            console.log('Remimazolam PK/PD parameters calculated successfully');
            console.log('PK parameters:', {
                V1: pk.v1.toFixed(3),
                V2: pk.v2.toFixed(3),
                V3: pk.v3.toFixed(3),
                CL: pk.cl.toFixed(3),
                Q2: pk.q2.toFixed(3),
                Q3: pk.q3.toFixed(3),
                ke0: pk.ke0.toFixed(4)
            });
            
            return {
                pk: pk,
                pd: pd,
                masuiResults: masuiResults // Include original results for debugging
            };
            
        } catch (error) {
            console.error('Remimazolam PK/PD calculation failed:', error);
            throw error;
        }
    }
    
    /**
     * Calculate BIS value from effect-site concentration
     * Simple sigmoid model for remimazolam
     */
    static calculateBIS(ce, pdParams) {
        if (ce <= 0) {
            return pdParams.bis_baseline;
        }
        
        // Use appropriate gamma for concentration range
        const gamma = ce <= pdParams.ce50 ? pdParams.gamma_low : pdParams.gamma_high;
        const ce_gamma = Math.pow(ce, gamma);
        const ce50_gamma = Math.pow(pdParams.ce50, gamma);
        
        const E_drug = ce_gamma / (ce50_gamma + ce_gamma);
        const bis = pdParams.bis_baseline * (1 - E_drug);
        
        return Math.max(0, bis);  // BIS cannot be negative
    }
    
    /**
     * Validate calculated parameters for remimazolam
     */
    static validateParameters(params) {
        const errors = [];
        
        // Check PK parameters
        if (params.pk.v1 <= 0) errors.push("V1 must be positive");
        if (params.pk.v2 <= 0) errors.push("V2 must be positive");
        if (params.pk.v3 <= 0) errors.push("V3 must be positive");
        if (params.pk.cl <= 0) errors.push("CL must be positive");
        if (params.pk.q2 <= 0) errors.push("Q2 must be positive");
        if (params.pk.q3 <= 0) errors.push("Q3 must be positive");
        if (params.pk.ke0 <= 0) errors.push("ke0 must be positive");
        
        // Check PD parameters
        if (params.pd.ce50 <= 0) errors.push("Ce50 must be positive");
        if (params.pd.bis_baseline <= 0) errors.push("BIS baseline must be positive");
        if (params.pd.gamma_low <= 0) errors.push("Gamma low must be positive");
        if (params.pd.gamma_high <= 0) errors.push("Gamma high must be positive");
        
        // Check parameter ranges for remimazolam (more restrictive than propofol)
        if (params.pk.ke0 < 0.15 || params.pk.ke0 > 0.30) {
            errors.push(`ke0 value (${params.pk.ke0.toFixed(4)}) outside typical remimazolam range (0.15-0.30)`);
        }
        
        if (params.pd.ce50 < 0.3 || params.pd.ce50 > 2.0) {
            errors.push(`Ce50 value (${params.pd.ce50.toFixed(3)}) outside typical remimazolam range (0.3-2.0)`);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Print calculated parameters for debugging
     */
    static printParameters(patient, params) {
        console.log("=== Remimazolam Masui Model Parameters ===");
        console.log(`Patient: ${patient.age}y, ${patient.weight}kg, ${patient.height}cm, ${SexType.displayName(patient.sex)}`);
        console.log(`ASA-PS: ${AsapsType.displayName(patient.asaPS)}`);
        console.log("");
        console.log("PK Parameters:");
        console.log(`  V1: ${params.pk.v1.toFixed(3)} L`);
        console.log(`  V2: ${params.pk.v2.toFixed(3)} L`);
        console.log(`  V3: ${params.pk.v3.toFixed(3)} L`);
        console.log(`  CL: ${params.pk.cl.toFixed(3)} L/min`);
        console.log(`  Q2: ${params.pk.q2.toFixed(3)} L/min`);
        console.log(`  Q3: ${params.pk.q3.toFixed(3)} L/min`);
        console.log(`  ke0: ${params.pk.ke0.toFixed(4)} min⁻¹`);
        console.log("");
        console.log("PD Parameters:");
        console.log(`  Ce50: ${params.pd.ce50.toFixed(3)} µg/mL`);
        console.log(`  BIS baseline: ${params.pd.bis_baseline.toFixed(1)}`);
        console.log(`  Gamma (Ce < Ce50): ${params.pd.gamma_low.toFixed(3)}`);
        console.log(`  Gamma (Ce ≥ Ce50): ${params.pd.gamma_high.toFixed(3)}`);
        
        // Validation
        const validation = this.validateParameters(params);
        if (!validation.isValid) {
            console.warn("Parameter validation warnings:");
            validation.errors.forEach(error => console.warn(`  - ${error}`));
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.RemimazolamPKPDCalculator = RemimazolamPKPDCalculator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RemimazolamPKPDCalculator };
}