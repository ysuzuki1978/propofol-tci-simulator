// Eleveld et al. 2018 Propofol PK-PD Model Implementation
// Based on: Eleveld et al., BJA 2018; doi: 10.1016/j.bja.2018.01.018

class EleveldPKPDCalculator {
    
    /**
     * Calculate Fat-Free Mass using Al-Sallami equation
     * Note: For very young children (<2 years), FFM approaches total body weight
     */
    static calculateFFM(patient) {
        const bmi = patient.bmi;
        const wgt = patient.weight;
        const age = patient.age;
        const sex = patient.sex;
        
        // For very young children (1-2 years), use simplified calculation
        if (age < 2) {
            // In very young children, FFM is approximately 80-85% of total body weight
            return wgt * 0.82;
        }
        
        if (sex === SexType.MALE) {
            // Male FFM calculation
            const term1 = (0.88 * 9270 * wgt) / (6680 + 216 * bmi);
            const term2 = (1 - 0.88) / (1 + Math.pow(age / 13.4, -12.7));
            const term3 = 1.11 * wgt - 128 * Math.pow(wgt / patient.height, 2);
            return term1 + term2 * term3;
        } else {
            // Female FFM calculation
            const term1 = (1.11 * 9270 * wgt) / (8780 + 244 * bmi);
            const term2 = (1 - 1.11) / (1 + Math.pow(age / 7.1, -1.1));
            const term3 = 1.07 * wgt - 148 * Math.pow(wgt / patient.height, 2);
            return term1 + term2 * term3;
        }
    }
    
    /**
     * Helper function: Sigmoid function for maturation
     */
    static f_sigmoid(x, E50, lambda) {
        return Math.pow(x, lambda) / (Math.pow(x, lambda) + Math.pow(E50, lambda));
    }
    
    /**
     * Helper function: Ageing function
     */
    static f_ageing(x, age, age_ref = 35) {
        return Math.exp(x * (age - age_ref));
    }
    
    /**
     * Helper function: Opioid effect function
     */
    static f_opiates(x, age, opioid_coadmin) {
        return opioid_coadmin === OpioidType.YES ? Math.exp(x * age) : 1;
    }
    
    /**
     * Calculate individual PK parameters based on Eleveld model
     */
    static calculatePKParameters(patient) {
        const theta = EleveldModelConstants.theta;
        const age = patient.age;
        const wgt = patient.weight;
        const sex = patient.sex;
        const pma = patient.pma;
        const opioid_coadmin = patient.opioidCoadmin;
        
        // Calculate FFM
        const ffm = this.calculateFFM(patient);
        const ffm_ref = patient.ffm_ref;
        
        // Reference values
        const wgt_ref = EleveldModelConstants.wgt_ref;
        const age_ref = EleveldModelConstants.age_ref;
        
        // Step 2.1: Helper functions
        const f_central_wgt = this.f_sigmoid(wgt, theta[12], 1);
        const f_central_wgt_ref = this.f_sigmoid(wgt_ref, theta[12], 1);
        
        // Step 2.2: Volume calculations
        const V1 = theta[1] * (f_central_wgt / f_central_wgt_ref);
        const V2 = theta[2] * (wgt / wgt_ref) * this.f_ageing(theta[10], age, age_ref);
        const V3 = theta[3] * (ffm / ffm_ref) * this.f_opiates(theta[13], age, opioid_coadmin);
        
        // Step 2.3: Clearance calculations
        const f_CLmaturation = this.f_sigmoid(pma, theta[8], theta[9]);
        const f_CLmaturation_ref = this.f_sigmoid((age_ref * 52) + 40, theta[8], theta[9]);
        
        // Base clearance (sex-dependent)
        const CL_base = sex === SexType.MALE ? theta[4] : theta[15];
        
        const CL = CL_base * Math.pow(wgt / wgt_ref, 0.75) * 
                   (f_CLmaturation / f_CLmaturation_ref) * 
                   this.f_opiates(theta[11], age, opioid_coadmin);
        
        // Q2 and Q3 calculations
        const f_Q3maturation = this.f_sigmoid(pma, theta[14], 1);
        const f_Q3maturation_ref = this.f_sigmoid((age_ref * 52) + 40, theta[14], 1);
        
        const Q2 = theta[5] * Math.pow(V2 / theta[2], 0.75) * 
                   (1 + theta[16] * (1 - f_Q3maturation));
        
        const Q3 = theta[6] * Math.pow(V3 / theta[3], 0.75) * 
                   (f_Q3maturation / f_Q3maturation_ref);
        
        return {
            V1: V1,
            V2: V2,
            V3: V3,
            CL: CL,
            Q2: Q2,
            Q3: Q3,
            FFM: ffm
        };
    }
    
    /**
     * Calculate individual PD parameters based on Eleveld model
     */
    static calculatePDParameters(patient) {
        const pd_theta = EleveldModelConstants.pd_theta;
        const age = patient.age;
        const wgt = patient.weight;
        
        // Ce50 calculation (with age effect)
        const Ce50 = pd_theta[1] * Math.exp(pd_theta[7] * (age - 35));
        
        // ke0 calculation (with weight effect)
        const ke0 = pd_theta[2] * Math.pow(wgt / 70, -0.25);
        
        // Baseline BIS
        const BIS_baseline = pd_theta[3];
        
        // Gamma values (slope parameters)
        const gamma_low = pd_theta[9];   // Ce < Ce50
        const gamma_high = pd_theta[4];  // Ce >= Ce50
        
        return new PDParameters(Ce50, ke0, BIS_baseline, gamma_low, gamma_high);
    }
    
    /**
     * Calculate BIS value from effect-site concentration
     */
    static calculateBIS(ce, pdParams) {
        if (ce <= 0) {
            return pdParams.bis_baseline;
        }
        
        const gamma = ce <= pdParams.ce50 ? pdParams.gamma_low : pdParams.gamma_high;
        const ce_gamma = Math.pow(ce, gamma);
        const ce50_gamma = Math.pow(pdParams.ce50, gamma);
        
        const E_drug = ce_gamma / (ce50_gamma + ce_gamma);
        const bis = pdParams.bis_baseline * (1 - E_drug);
        
        return Math.max(0, bis);  // BIS cannot be negative
    }
    
    /**
     * Get combined PK/PD parameters for simulation
     */
    static getModelParameters(patient) {
        const pk = this.calculatePKParameters(patient);
        const pd = this.calculatePDParameters(patient);
        
        return {
            pk: new PKParameters(pk.V1, pk.V2, pk.V3, pk.CL, pk.Q2, pk.Q3, pd.ke0),
            pd: pd,
            ffm: pk.FFM
        };
    }
    
    /**
     * Validate calculated parameters
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
        
        // Check parameter ranges (clinical validity)
        if (params.pk.ke0 < 0.05 || params.pk.ke0 > 1.0) {
            errors.push(`ke0 value (${params.pk.ke0.toFixed(3)}) outside typical range (0.05-1.0)`);
        }
        
        if (params.pd.ce50 < 0.5 || params.pd.ce50 > 10.0) {
            errors.push(`Ce50 value (${params.pd.ce50.toFixed(3)}) outside typical range (0.5-10.0)`);
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
        console.log("=== Eleveld Model Parameters ===");
        console.log(`Patient: ${patient.age}y, ${patient.weight}kg, ${patient.height}cm, ${SexType.displayName(patient.sex)}`);
        console.log(`FFM: ${params.ffm.toFixed(3)} kg`);
        console.log(`Opioid coadministration: ${OpioidType.displayName(patient.opioidCoadmin)}`);
        
        // Debug: Show opioid parameter effects
        const theta = EleveldModelConstants.theta;
        const age = patient.age;
        const opioid_coadmin = patient.opioidCoadmin;
        
        const opioidFactorCL = this.f_opiates(theta[11], age, opioid_coadmin);
        const opioidFactorV3 = this.f_opiates(theta[13], age, opioid_coadmin);
        console.log(`Opioid effects - CL factor: ${opioidFactorCL.toFixed(3)} (${((opioidFactorCL-1)*100).toFixed(1)}%), V3 factor: ${opioidFactorV3.toFixed(3)} (${((opioidFactorV3-1)*100).toFixed(1)}%)`);
        
        // Log significant parameter changes
        if (opioid_coadmin === OpioidType.YES) {
            console.log(`With opioids: CL reduced by ${((1-opioidFactorCL)*100).toFixed(1)}%, V3 reduced by ${((1-opioidFactorV3)*100).toFixed(1)}%`);
        }
        console.log("");
        console.log("PK Parameters:");
        console.log(`  V1: ${params.pk.v1.toFixed(3)} L`);
        console.log(`  V2: ${params.pk.v2.toFixed(3)} L`);
        console.log(`  V3: ${params.pk.v3.toFixed(3)} L`);
        console.log(`  CL: ${params.pk.cl.toFixed(3)} L/min`);
        console.log(`  Q2: ${params.pk.q2.toFixed(3)} L/min`);
        console.log(`  Q3: ${params.pk.q3.toFixed(3)} L/min`);
        console.log(`  ke0: ${params.pk.ke0.toFixed(3)} min⁻¹`);
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