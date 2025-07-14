// Data Models and Constants for Propofol TCI TIVA
// Based on Eleveld et al. (2018) BJA Model

// Enums
const SexType = {
    MALE: 0,
    FEMALE: 1,
    
    displayName(value) {
        return value === this.MALE ? "Male" : "Female";
    }
};

const AsapsType = {
    CLASS_1_2: 0,
    CLASS_3_4: 1,
    
    displayName(value) {
        return value === this.CLASS_1_2 ? "ASA I-II" : "ASA III-IV";
    }
};

const OpioidType = {
    YES: 1,
    NO: 0,
    
    displayName(value) {
        return value === this.YES ? "Yes" : "No";
    }
};

// Constants from Eleveld et al. 2018 Model
const EleveldModelConstants = {
    // PK Model Parameters (Table 2)
    theta: {
        1: 6.28,    // V1_ref (L)
        2: 25.5,    // V2_ref (L)
        3: 273,     // V3_ref (L)
        4: 1.79,    // CL_ref (male) (L/min)
        5: 1.83,    // Q2_ref (L/min)
        6: 1.11,    // Q3_ref (L/min)
        7: 0.191,   // Typical residual error
        8: 42.3,    // CL maturation E50 (weeks)
        9: 9.06,    // CL maturation slope
        10: -0.0156, // Smaller V2 with age
        11: -0.00286,// Lower CL with age (with opioids)
        12: 33.6,    // Weight for 50% of maximal V1 (kg)
        13: -0.0138, // Smaller V3 with age (with opioids)
        14: 68.3,    // Maturation of Q3 (weeks)
        15: 2.10,    // CL_ref (female) (L/min)
        16: 1.30,    // Higher Q2 for maturation of Q3
        17: 1.42,    // V1 venous samples (children) modifier
        18: 0.68     // Higher Q2 venous samples modifier
    },
    
    // PD Model Parameters (Table 3)
    pd_theta: {
        1: 3.08,    // Ce50_ref (ug/mL)
        2: 0.146,   // ke0 for arterial samples (min^-1)
        3: 93.0,    // Baseline BIS value
        4: 1.47,    // PD sigmoid slope (Ce > Ce50)
        5: 8.03,    // Residual error (BIS)
        6: 0.0517,  // Increase in delay with age
        7: -0.00635,// Decrease in Ce50 with age
        8: 1.24,    // ke0 for venous samples (min^-1)
        9: 1.89     // PD sigmoid slope (Ce < Ce50)
    },
    
    // Reference values
    wgt_ref: 70,    // kg
    age_ref: 35,    // years
    
    // FFM calculation constants (Al-Sallami equation)
    ffm_male: {
        num1: 0.88,
        num2: 9270,
        den1: 6680,
        den2: 216,
        num3: 1.11,
        num4: 128,
        exp1: 13.4,
        exp2: 12.7
    },
    ffm_female: {
        num1: 1.11,
        num2: 9270,
        den1: 8780,
        den2: 244,
        num3: 1.07,
        num4: 148,
        exp1: 7.1,
        exp2: 1.1
    }
};

// Validation Limits
const ValidationLimits = {
    Patient: {
        minimumAge: 1,      // Changed from 18 to 1 for pediatric support
        maximumAge: 100,
        minimumWeight: 3.0, // Lowered for pediatric patients (1-year-old ~10kg)
        maximumWeight: 200.0,
        minimumHeight: 70.0, // Lowered for pediatric patients (1-year-old ~75cm)
        maximumHeight: 220.0,
        minimumBMI: 10.0,   // Adjusted for pediatric range
        maximumBMI: 50.0
    },
    
    Dosing: {
        minimumTime: 0,
        maximumTime: 1440,
        minimumBolus: 0.0,
        maximumBolus: 1000.0,  // Higher for propofol
        minimumContinuous: 0.0,
        maximumContinuous: 500.0,  // mg/hr for propofol
        minimumTargetConcentration: 0.1,
        maximumTargetConcentration: 10.0  // Higher for propofol
    },
    
    Induction: {
        minimumBolusRange: 10.0,     // Propofol typical range
        maximumBolusRange: 200.0,
        minimumContinuousRange: 0.0,
        maximumContinuousRange: 500.0  // mg/hr for propofol
    }
};

// Patient Class
class Patient {
    constructor(id, age, weight, height, sex, asaPS, opioidCoadmin = OpioidType.YES, anesthesiaStartTime = null) {
        this.id = id;
        this.age = age;
        this.weight = weight;
        this.height = height;
        this.sex = sex;
        this.asaPS = asaPS;
        this.opioidCoadmin = opioidCoadmin;
        this.anesthesiaStartTime = anesthesiaStartTime || new Date();
    }
    
    get bmi() {
        return this.weight / Math.pow(this.height / 100, 2);
    }
    
    get pma() {
        // Post-menstrual age in weeks (for adults: age * 52 + 40)
        return (this.age * 52) + 40;
    }
    
    get ffm() {
        // Fat-Free Mass using Al-Sallami equation
        const bmi = this.bmi;
        const wgt = this.weight;
        const hgt_m = this.height / 100;
        const age = this.age;
        const sex = this.sex;
        
        if (sex === SexType.MALE) {
            const c = EleveldModelConstants.ffm_male;
            const term1 = (c.num1 * c.num2 * wgt) / (c.den1 + c.den2 * bmi);
            const term2 = (1 - c.num1) / (1 + Math.pow(age / c.exp1, -c.exp2));
            const term3 = c.num3 * wgt - c.num4 * Math.pow(wgt / this.height, 2);
            return term1 + term2 * term3;
        } else {
            const c = EleveldModelConstants.ffm_female;
            const term1 = (c.num1 * c.num2 * wgt) / (c.den1 + c.den2 * bmi);
            const term2 = (1 - c.num1) / (1 + Math.pow(age / c.exp1, -c.exp2));
            const term3 = c.num3 * wgt - c.num4 * Math.pow(wgt / this.height, 2);
            return term1 + term2 * term3;
        }
    }
    
    get ffm_ref() {
        // FFM for reference individual (35 years, 70 kg, 170 cm, male)
        const bmi_ref = 70 / Math.pow(1.7, 2);
        const c = EleveldModelConstants.ffm_male;
        const term1 = (c.num1 * c.num2 * 70) / (c.den1 + c.den2 * bmi_ref);
        const term2 = (1 - c.num1) / (1 + Math.pow(35 / c.exp1, -c.exp2));
        const term3 = c.num3 * 70 - c.num4 * Math.pow(70 / 170, 2);
        return term1 + term2 * term3;
    }
    
    minutesToClockTime(minutesFromStart) {
        return new Date(this.anesthesiaStartTime.getTime() + minutesFromStart * 60000);
    }
    
    clockTimeToMinutes(clockTime) {
        let minutesDiff = (clockTime.getTime() - this.anesthesiaStartTime.getTime()) / 60000;
        return minutesDiff;
    }
    
    get formattedStartTime() {
        return this.anesthesiaStartTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    validate() {
        const errors = [];
        
        if (!this.id || this.id.trim().length === 0) {
            errors.push("Patient ID is required");
        }
        
        if (this.age < ValidationLimits.Patient.minimumAge || this.age > ValidationLimits.Patient.maximumAge) {
            errors.push("Age must be between 1 and 100 years");
        }
        
        if (this.weight < ValidationLimits.Patient.minimumWeight || this.weight > ValidationLimits.Patient.maximumWeight) {
            errors.push("Weight must be between 3 kg and 200 kg");
        }
        
        if (this.height < ValidationLimits.Patient.minimumHeight || this.height > ValidationLimits.Patient.maximumHeight) {
            errors.push("Height must be between 70 cm and 220 cm");
        }
        
        if (this.bmi < ValidationLimits.Patient.minimumBMI || this.bmi > ValidationLimits.Patient.maximumBMI) {
            errors.push(`BMI value is extreme (calculated: ${this.bmi.toFixed(1)})`);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

// Dose Event Class
class DoseEvent {
    constructor(timeInMinutes, bolusMg, continuousMgHr) {
        this.timeInMinutes = timeInMinutes;
        this.bolusMg = bolusMg;
        this.continuousMgHr = continuousMgHr; // Changed from mg/kg/hr to mg/hr
    }
    
    continuousRateMgMin(patient) {
        return this.continuousMgHr / 60.0; // Direct conversion from mg/hr to mg/min
    }
    
    // For backward compatibility and display purposes
    get continuousMgKgHr() {
        // This getter can be used for calculations that still expect mg/kg/hr
        // but should be avoided in new code
        return this.continuousMgHr;
    }
    
    formattedClockTime(patient) {
        const clockTime = patient.minutesToClockTime(this.timeInMinutes);
        return clockTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    validate() {
        const errors = [];
        
        if (this.bolusMg < ValidationLimits.Dosing.minimumBolus || this.bolusMg > ValidationLimits.Dosing.maximumBolus) {
            errors.push("Bolus dose must be between 0 mg and 1000 mg");
        }
        
        if (this.continuousMgHr < ValidationLimits.Dosing.minimumContinuous || this.continuousMgHr > ValidationLimits.Dosing.maximumContinuous) {
            errors.push("Continuous infusion rate must be between 0 mg/hr and 500 mg/hr");
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

// PK Parameters Class
class PKParameters {
    constructor(v1, v2, v3, cl, q2, q3, ke0) {
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;
        this.cl = cl;
        this.q2 = q2;
        this.q3 = q3;
        this.ke0 = ke0;
    }
    
    get k10() {
        return this.cl / this.v1;
    }
    
    get k12() {
        return this.q2 / this.v1;
    }
    
    get k21() {
        return this.q2 / this.v2;
    }
    
    get k13() {
        return this.q3 / this.v1;
    }
    
    get k31() {
        return this.q3 / this.v3;
    }
}

// PD Parameters Class
class PDParameters {
    constructor(ce50, ke0, bis_baseline, gamma_low, gamma_high) {
        this.ce50 = ce50;
        this.ke0 = ke0;
        this.bis_baseline = bis_baseline;
        this.gamma_low = gamma_low;
        this.gamma_high = gamma_high;
    }
    
    calculateBIS(ce) {
        // BIS calculation using Eleveld model
        const gamma = ce <= this.ce50 ? this.gamma_low : this.gamma_high;
        const e_drug = Math.pow(ce, gamma) / (Math.pow(this.ce50, gamma) + Math.pow(ce, gamma));
        return this.bis_baseline * (1 - e_drug);
    }
}

// System State Class
class SystemState {
    constructor(a1 = 0.0, a2 = 0.0, a3 = 0.0, ce = 0.0) {
        this.a1 = a1;
        this.a2 = a2;
        this.a3 = a3;
        this.ce = ce;
    }
    
    toVector() {
        return [this.a1, this.a2, this.a3, this.ce];
    }
    
    static fromVector(vector) {
        return new SystemState(vector[0], vector[1], vector[2], vector[3]);
    }
}

// Time Point Class
class TimePoint {
    constructor(timeInMinutes, doseEvent, plasmaConcentration, effectSiteConcentration, bisValue = null) {
        this.timeInMinutes = timeInMinutes;
        this.doseEvent = doseEvent;
        this.plasmaConcentration = plasmaConcentration;
        this.effectSiteConcentration = effectSiteConcentration;
        this.bisValue = bisValue;
    }
    
    get plasmaConcentrationString() {
        return this.plasmaConcentration.toFixed(3);
    }
    
    get effectSiteConcentrationString() {
        return this.effectSiteConcentration.toFixed(3);
    }
    
    get bisValueString() {
        return this.bisValue !== null ? this.bisValue.toFixed(1) : "N/A";
    }
    
    formattedClockTime(patient) {
        const clockTime = patient.minutesToClockTime(this.timeInMinutes);
        return clockTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
}

// Simulation Result Class
class SimulationResult {
    constructor(timePoints, patient = null, doseEvents = null, calculationMethod = "Eleveld Model + VHAC", 
                calculatedAt = null, plasmaConcentrations = [], effectSiteConcentrations = [], timeVector = [], bisValues = []) {
        this.timePoints = timePoints;
        this.patient = patient;
        this.doseEvents = doseEvents;
        this.calculationMethod = calculationMethod;
        this.calculatedAt = calculatedAt || new Date();
        this.plasmaConcentrations = plasmaConcentrations;
        this.effectSiteConcentrations = effectSiteConcentrations;
        this.timeVector = timeVector;
        this.bisValues = bisValues;
    }
    
    get maxPlasmaConcentration() {
        if (this.plasmaConcentrations.length > 0) {
            return Math.max(...this.plasmaConcentrations);
        }
        return Math.max(...this.timePoints.map(tp => tp.plasmaConcentration));
    }
    
    get maxEffectSiteConcentration() {
        if (this.effectSiteConcentrations.length > 0) {
            return Math.max(...this.effectSiteConcentrations);
        }
        return Math.max(...this.timePoints.map(tp => tp.effectSiteConcentration));
    }
    
    get minBISValue() {
        if (this.bisValues.length > 0) {
            return Math.min(...this.bisValues.filter(bis => bis !== null && !isNaN(bis)));
        }
        const validBIS = this.timePoints
            .map(tp => tp.bisValue)
            .filter(bis => bis !== null && !isNaN(bis));
        return validBIS.length > 0 ? Math.min(...validBIS) : EleveldModelConstants.pd_theta[3];
    }
    
    get simulationDurationMinutes() {
        return this.timePoints.length > 0 ? this.timePoints[this.timePoints.length - 1].timeInMinutes : 0;
    }
    
    toCSV() {
        const csvLines = [];
        
        if (this.patient) {
            const patientInfo = `Patient ID:${this.patient.id},Age:${this.patient.age} years,Weight:${this.patient.weight} kg,Height:${this.patient.height} cm,Sex:${SexType.displayName(this.patient.sex)},ASA-PS:${AsapsType.displayName(this.patient.asaPS)},Opioid Co-admin:${OpioidType.displayName(this.patient.opioidCoadmin)},Anesthesia Start:${this.patient.formattedStartTime}`;
            csvLines.push(patientInfo);
            
            csvLines.push("Time,Predicted Plasma Conc.(µg/mL),Predicted Effect-site Conc.(µg/mL),Predicted BIS Value");
            
            for (const tp of this.timePoints) {
                const clockTime = tp.formattedClockTime(this.patient);
                const line = `${clockTime},${tp.plasmaConcentration.toFixed(3)},${tp.effectSiteConcentration.toFixed(3)},${tp.bisValueString}`;
                csvLines.push(line);
            }
        } else {
            csvLines.push("Time(min),Predicted Plasma Conc.(µg/mL),Predicted Effect-site Conc.(µg/mL),Predicted BIS Value");
            
            for (const tp of this.timePoints) {
                const line = `${tp.timeInMinutes},${tp.plasmaConcentration.toFixed(3)},${tp.effectSiteConcentration.toFixed(3)},${tp.bisValueString}`;
                csvLines.push(line);
            }
        }
        
        return csvLines.join("\n");
    }
}

// Induction Snapshot Class (for App 1)
class InductionSnapshot {
    constructor(timestamp, plasmaConcentration, effectSiteConcentration, elapsedTime, dose, bisValue = null) {
        this.timestamp = timestamp;
        this.plasmaConcentration = plasmaConcentration;
        this.effectSiteConcentration = effectSiteConcentration;
        this.elapsedTime = elapsedTime;
        this.dose = dose;
        this.bisValue = bisValue;
    }
    
    get formattedTime() {
        const hours = Math.floor(this.elapsedTime / 3600);
        const minutes = Math.floor((this.elapsedTime % 3600) / 60);
        const seconds = Math.floor(this.elapsedTime % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    get bisValueString() {
        return this.bisValue !== null ? this.bisValue.toFixed(1) : "N/A";
    }
}

// Protocol Optimization Result Class (for App 2)
class ProtocolResult {
    constructor(optimalRate, predictedConcentration, protocolSchedule, targetConcentration, timeToTarget) {
        this.optimalRate = optimalRate;
        this.predictedConcentration = predictedConcentration;
        this.protocolSchedule = protocolSchedule;
        this.targetConcentration = targetConcentration;
        this.timeToTarget = timeToTarget;
    }
}

// Global Application State
class AppState {
    constructor() {
        this.patient = null;
        this.isInductionRunning = false;
        this.inductionStartTime = null;
        this.inductionSnapshots = [];
        this.currentInductionState = null;
        this.protocolResult = null;
        this.monitoringEvents = [];
        this.simulationResult = null;
    }
    
    reset() {
        this.patient = null;
        this.isInductionRunning = false;
        this.inductionStartTime = null;
        this.inductionSnapshots = [];
        this.currentInductionState = null;
        this.protocolResult = null;
        this.monitoringEvents = [];
        this.simulationResult = null;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.SexType = SexType;
    window.AsapsType = AsapsType;
    window.OpioidType = OpioidType;
    window.EleveldModelConstants = EleveldModelConstants;
    window.ValidationLimits = ValidationLimits;
    window.Patient = Patient;
    window.DoseEvent = DoseEvent;
    window.PKParameters = PKParameters;
    window.PDParameters = PDParameters;
    window.SystemState = SystemState;
    window.TimePoint = TimePoint;
    window.SimulationResult = SimulationResult;
    window.InductionSnapshot = InductionSnapshot;
    window.ProtocolResult = ProtocolResult;
    window.AppState = AppState;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SexType,
        AsapsType,
        OpioidType,
        EleveldModelConstants,
        ValidationLimits,
        Patient,
        DoseEvent,
        PKParameters,
        PDParameters,
        SystemState,
        TimePoint,
        SimulationResult,
        InductionSnapshot,
        ProtocolResult,
        AppState
    };
}