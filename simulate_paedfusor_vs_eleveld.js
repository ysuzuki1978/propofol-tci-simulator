#!/usr/bin/env node
/**
 * Paedfusor vs Eleveld PK Parameter Comparison
 * Demonstrates age-boundary discontinuities in Paedfusor model
 * vs smooth continuous functions in Eleveld 2018.
 *
 * Paedfusor: Absalom & Kenny (Paediatr Anaesth 2005; Br J Anaesth 2003)
 * Eleveld: Eleveld et al. (Br J Anaesth 2018;120:942-959)
 */

// ============================================================
// Eleveld Model (self-contained for Node.js)
// ============================================================
const SexType = { MALE: 0, FEMALE: 1 };
const OpioidType = { YES: 1, NO: 0 };

const theta = {
    1: 6.28, 2: 25.5, 3: 273, 4: 1.79, 5: 1.75, 6: 1.11,
    7: 0.191, 8: 42.3, 9: 9.06, 10: -0.0156, 11: -0.00286,
    12: 33.6, 13: -0.0138, 14: 68.3, 15: 2.10, 16: 1.30
};
const wgt_ref = 70, age_ref = 35;

function f_sigmoid(x, E50, lambda) {
    return Math.pow(x, lambda) / (Math.pow(x, lambda) + Math.pow(E50, lambda));
}
function f_ageing(x, age) { return Math.exp(x * (age - age_ref)); }
function f_opiates(x, age, opioid) { return opioid === OpioidType.YES ? Math.exp(x * age) : 1; }

function calcFFM(age, weight, height, sex) {
    const bmi = weight / Math.pow(height / 100, 2);
    if (age < 2) return weight * 0.82;
    if (sex === SexType.MALE) {
        const t1 = (0.88 * 9270 * weight) / (6680 + 216 * bmi);
        const t2 = (1 - 0.88) / (1 + Math.pow(age / 13.4, -12.7));
        const t3 = 1.11 * weight - 128 * Math.pow(weight / height, 2);
        return t1 + t2 * t3;
    } else {
        const t1 = (1.11 * 9270 * weight) / (8780 + 244 * bmi);
        const t2 = (1 - 1.11) / (1 + Math.pow(age / 7.1, -1.1));
        const t3 = 1.07 * weight - 148 * Math.pow(weight / height, 2);
        return t1 + t2 * t3;
    }
}

// Reference FFM (35y, 70kg, 170cm, male)
const bmi_ref = 70 / Math.pow(1.7, 2);
const ffm_ref = (() => {
    const t1 = (0.88 * 9270 * 70) / (6680 + 216 * bmi_ref);
    const t2 = (1 - 0.88) / (1 + Math.pow(35 / 13.4, -12.7));
    const t3 = 1.11 * 70 - 128 * Math.pow(70 / 170, 2);
    return t1 + t2 * t3;
})();

// ============================================================
// Paedfusor Model Implementation
// ============================================================
const PaedfusorModel = {
    // V1 = 0.458 L/kg (linear, continuous)
    V1_PER_KG: 0.458,

    // k10 lookup table by age (discrete steps)
    // Source: Absalom & Kenny, implemented in Graseby 3500 / Alaris PK
    k10_table: {
        1: 0.4720,
        2: 0.3580,
        3: 0.3170,
        4: 0.2680,
        5: 0.2680,
        6: 0.2440,
        7: 0.2440,
        8: 0.2440,
        9: 0.2440,
        10: 0.2440,
        11: 0.2440,
        12: 0.2440,
        13: 0.1527,
        14: 0.1527,
        15: 0.1527,
        16: 0.1527
    },

    // Fixed rate constants
    k12: 0.114,
    k13: 0.0419,
    k21: 0.055,
    k31: 0.0033,

    getK10(age) {
        const floorAge = Math.floor(age);
        if (floorAge < 1) return this.k10_table[1];
        if (floorAge > 16) return this.k10_table[16];
        return this.k10_table[floorAge];
    },

    calculatePK(age, weight) {
        const k10 = this.getK10(age);
        const V1 = this.V1_PER_KG * weight;
        const V2 = (this.k12 / this.k21) * V1;
        const V3 = (this.k13 / this.k31) * V1;
        const CL = k10 * V1;
        const Q2 = this.k12 * V1;
        const Q3 = this.k13 * V1;

        return { V1, V2, V3, CL, Q2, Q3, k10, k12: this.k12, k13: this.k13, k21: this.k21, k31: this.k31 };
    }
};

// ============================================================
// Typical pediatric weight by age (CDC 50th percentile, Male)
// ============================================================
function typicalWeight(age) {
    // Approximate CDC 50th percentile for males
    const table = {
        1: 10.0, 2: 12.5, 3: 14.5, 4: 16.5, 5: 18.5,
        6: 20.5, 7: 23.0, 8: 25.5, 9: 28.5, 10: 32.0,
        11: 36.0, 12: 40.0, 13: 45.0, 14: 50.0, 15: 56.0,
        16: 61.0, 17: 65.0, 18: 68.0
    };
    const floor = Math.floor(age);
    const ceil = Math.ceil(age);
    if (floor === ceil || ceil > 18) return table[Math.min(floor, 18)] || 70;
    const frac = age - floor;
    return table[floor] * (1 - frac) + table[ceil] * frac;
}

function typicalHeight(age) {
    const table = {
        1: 76, 2: 88, 3: 96, 4: 103, 5: 110,
        6: 116, 7: 122, 8: 128, 9: 133, 10: 138,
        11: 143, 12: 149, 13: 156, 14: 163, 15: 170,
        16: 174, 17: 176, 18: 177
    };
    const floor = Math.floor(age);
    const ceil = Math.ceil(age);
    if (floor === ceil || ceil > 18) return table[Math.min(floor, 18)] || 177;
    const frac = age - floor;
    return table[floor] * (1 - frac) + table[ceil] * frac;
}

// ============================================================
// Eleveld PK calculation wrapper
// ============================================================
function eleveldPK(age, weight, height, sex = SexType.MALE) {
    const pma = age * 52 + 40;
    const ffm = calcFFM(age, weight, height, sex);
    const opioid = OpioidType.YES;

    const f_cw = f_sigmoid(weight, theta[12], 1);
    const f_cw_ref = f_sigmoid(wgt_ref, theta[12], 1);

    const V1 = theta[1] * (f_cw / f_cw_ref);
    const V2 = theta[2] * (weight / wgt_ref) * f_ageing(theta[10], age);
    const V3 = theta[3] * (ffm / ffm_ref) * f_opiates(theta[13], age, opioid);

    const f_CLmat = f_sigmoid(pma, theta[8], theta[9]);
    const f_CLmat_ref = f_sigmoid(age_ref * 52 + 40, theta[8], theta[9]);
    const CL_base = sex === SexType.MALE ? theta[4] : theta[15];
    const CL = CL_base * Math.pow(weight / wgt_ref, 0.75) *
               (f_CLmat / f_CLmat_ref) * f_opiates(theta[11], age, opioid);

    const f_Q3mat = f_sigmoid(pma, theta[14], 1);
    const f_Q3mat_ref = f_sigmoid(age_ref * 52 + 40, theta[14], 1);
    const Q2 = theta[5] * Math.pow(V2 / theta[2], 0.75) * (1 + theta[16] * (1 - f_Q3mat));
    const Q3 = theta[6] * Math.pow(V3 / theta[3], 0.75) * (f_Q3mat / f_Q3mat_ref);

    const k10 = CL / V1, k12 = Q2 / V1, k21 = Q2 / V2, k13 = Q3 / V1, k31 = Q3 / V3;
    return { V1, V2, V3, CL, Q2, Q3, k10, k12, k21, k13, k31 };
}

// ============================================================
// Part 1: Age sweep (5-18 years) with typical weight
// ============================================================
console.log('================================================================');
console.log('Paedfusor vs Eleveld: PK Parameter Comparison');
console.log('================================================================');
console.log('Male, typical weight/height for age (CDC 50th percentile)');
console.log('Opioid co-administration: Yes (Eleveld)');
console.log('');

console.log('--- Part 1: Age sweep (5-18 years, 0.5-year steps) ---');
console.log('');
console.log('Age(y) | Wt(kg) | Paedfusor CL | Eleveld CL | Ratio | Paedfusor k10 | Eleveld k10');
console.log('-------|--------|-------------|------------|-------|--------------|------------');

const ageData = [];
for (let age = 5; age <= 18; age += 0.5) {
    const wt = typicalWeight(age);
    const ht = typicalHeight(age);

    const paed = PaedfusorModel.calculatePK(age, wt);
    const elev = eleveldPK(age, wt, ht);

    const ratio = paed.CL / elev.CL;
    ageData.push({ age, wt, paedCL: paed.CL, elevCL: elev.CL, ratio, paedK10: paed.k10, elevK10: elev.k10 });

    const marker = (age === 13 || age === 12.5) ? ' ← DISCONTINUITY' : '';
    console.log(
        `${age.toFixed(1).padStart(5)}  | ${wt.toFixed(1).padStart(5)}  | ` +
        `${paed.CL.toFixed(3).padStart(11)} | ${elev.CL.toFixed(3).padStart(10)} | ` +
        `${ratio.toFixed(2).padStart(5)} | ${paed.k10.toFixed(4).padStart(12)} | ` +
        `${elev.k10.toFixed(4).padStart(10)}${marker}`
    );
}

// ============================================================
// Part 2: Highlight the 12→13 year discontinuity
// ============================================================
console.log('');
console.log('================================================================');
console.log('Part 2: 12→13 year boundary — the critical discontinuity');
console.log('================================================================');
console.log('');

for (let age = 11.5; age <= 14.0; age += 0.25) {
    const wt = typicalWeight(age);
    const ht = typicalHeight(age);
    const paed = PaedfusorModel.calculatePK(age, wt);
    const elev = eleveldPK(age, wt, ht);

    const marker = (Math.floor(age) === 12 && Math.floor(age + 0.25) === 13) ? ' *** STEP ***' : '';
    console.log(
        `Age ${age.toFixed(2)}: ` +
        `Paed k10=${paed.k10.toFixed(4)}, CL=${paed.CL.toFixed(3)} L/min | ` +
        `Elev k10=${elev.k10.toFixed(4)}, CL=${elev.CL.toFixed(3)} L/min` +
        marker
    );
}

// ============================================================
// Part 3: Same weight, different age (isolating age effect)
// ============================================================
console.log('');
console.log('================================================================');
console.log('Part 3: Fixed weight (40 kg), age 5-18 — isolating age effect');
console.log('================================================================');
console.log('');

const fixedWt = 40;
const fixedHt = 149; // ~12yo height

console.log('Age(y) | Paedfusor CL | Eleveld CL | Paed/Elev | ΔCL at boundary');
console.log('-------|-------------|------------|-----------|----------------');

let prevPaedCL = null;
let prevElevCL = null;
for (let age = 5; age <= 18; age += 1) {
    const paed = PaedfusorModel.calculatePK(age, fixedWt);
    const elev = eleveldPK(age, fixedWt, fixedHt);

    let delta = '';
    if (prevPaedCL !== null) {
        const paedChange = ((paed.CL - prevPaedCL) / prevPaedCL * 100);
        const elevChange = ((elev.CL - prevElevCL) / prevElevCL * 100);
        if (Math.abs(paedChange) > 5) {
            delta = `Paed: ${paedChange > 0 ? '+' : ''}${paedChange.toFixed(1)}%, Elev: ${elevChange > 0 ? '+' : ''}${elevChange.toFixed(1)}%`;
        }
    }

    console.log(
        `${age.toString().padStart(5)}  | ` +
        `${paed.CL.toFixed(3).padStart(11)} | ` +
        `${elev.CL.toFixed(3).padStart(10)} | ` +
        `${(paed.CL / elev.CL).toFixed(2).padStart(9)} | ` +
        delta
    );

    prevPaedCL = paed.CL;
    prevElevCL = elev.CL;
}

// ============================================================
// Part 4: Clinical impact — TCI infusion rate for Cp target 3 μg/mL
// ============================================================
console.log('');
console.log('================================================================');
console.log('Part 4: Clinical impact — steady-state infusion rate');
console.log('  Target Cp = 3.0 μg/mL (maintenance)');
console.log('  Steady-state rate = CL × Cp_target (mg/min)');
console.log('================================================================');
console.log('');

const targetCp = 3.0; // μg/mL = mg/L

console.log('Age(y) | Wt(kg) | Paed rate(mg/h) | Elev rate(mg/h) | Difference');
console.log('-------|--------|----------------|----------------|----------');

for (let age = 7; age <= 16; age += 1) {
    const wt = typicalWeight(age);
    const ht = typicalHeight(age);
    const paed = PaedfusorModel.calculatePK(age, wt);
    const elev = eleveldPK(age, wt, ht);

    // Steady-state: Rate = CL × Cp (L/min × mg/L = mg/min)
    const paedRate = paed.CL * targetCp * 60; // mg/h
    const elevRate = elev.CL * targetCp * 60; // mg/h
    const diff = paedRate - elevRate;
    const marker = age === 13 ? ' ← k10 drops 37%' : '';

    console.log(
        `${age.toString().padStart(5)}  | ${wt.toFixed(1).padStart(5)}  | ` +
        `${paedRate.toFixed(1).padStart(14)} | ${elevRate.toFixed(1).padStart(14)} | ` +
        `${(diff > 0 ? '+' : '')}${diff.toFixed(1)} mg/h${marker}`
    );
}

// ============================================================
// Part 5: Paedfusor upper boundary (16→adult transition)
// ============================================================
console.log('');
console.log('================================================================');
console.log('Part 5: Paedfusor→Adult model transition at age 16');
console.log('  Paedfusor: age 1-16 only');
console.log('  Marsh adult: k10=0.119, k12=0.112, k13=0.042, k21=0.055, k31=0.0033');
console.log('  V1 = 0.228 L/kg (Marsh) vs 0.458 L/kg (Paedfusor)');
console.log('================================================================');
console.log('');

const marshAdult = {
    V1_PER_KG: 0.228,
    k10: 0.119,
    k12: 0.112,
    k13: 0.042,
    k21: 0.055,
    k31: 0.0033
};

for (let age = 15; age <= 18; age += 0.5) {
    const wt = typicalWeight(age);
    const ht = typicalHeight(age);

    let model, modelName;
    if (age <= 16) {
        const paed = PaedfusorModel.calculatePK(age, wt);
        model = paed;
        modelName = 'Paedfusor';
    } else {
        const V1 = marshAdult.V1_PER_KG * wt;
        model = {
            V1, CL: marshAdult.k10 * V1,
            k10: marshAdult.k10
        };
        modelName = 'Marsh    ';
    }

    const elev = eleveldPK(age, wt, ht);

    const marker = (age === 16.5) ? ' ← MODEL SWITCH' : '';
    console.log(
        `Age ${age.toFixed(1)}: [${modelName}] V1=${model.V1.toFixed(2)} L, CL=${model.CL.toFixed(3)} L/min, k10=${model.k10.toFixed(4)} | ` +
        `[Eleveld] V1=${elev.V1.toFixed(2)} L, CL=${elev.CL.toFixed(3)} L/min, k10=${elev.k10.toFixed(4)}${marker}`
    );
}

// ============================================================
// Part 6: CSV output for plotting
// ============================================================
console.log('');
console.log('================================================================');
console.log('CSV: Age vs CL (for plotting)');
console.log('================================================================');
console.log('Age,Weight,Paedfusor_CL,Eleveld_CL,Paedfusor_k10,Eleveld_k10');
for (let age = 5; age <= 18; age += 0.25) {
    const wt = typicalWeight(age);
    const ht = typicalHeight(age);
    const paed = PaedfusorModel.calculatePK(age, wt);
    const elev = eleveldPK(age, wt, ht);
    console.log(`${age.toFixed(2)},${wt.toFixed(1)},${paed.CL.toFixed(4)},${elev.CL.toFixed(4)},${paed.k10.toFixed(4)},${elev.k10.toFixed(4)}`);
}

console.log('');
console.log('================================================================');
console.log('CONCLUSION');
console.log('================================================================');
console.log('');
console.log('Paedfusor uses a discrete k10 lookup table by integer age.');
console.log('The largest discontinuity occurs at age 12→13:');
console.log('  k10 drops from 0.2440 to 0.1527 (−37.4%).');
console.log('  For a 40 kg patient, CL drops from 4.48 to 2.80 L/min overnight.');
console.log('');
console.log('Eleveld uses continuous sigmoid maturation + allometric scaling,');
console.log('producing smooth parameter transitions at all ages.');
console.log('');
console.log('Additional discontinuity: Paedfusor→Marsh switch at age 16');
console.log('  V1 halves (0.458→0.228 L/kg), requiring model changeover.');
console.log('  Eleveld handles this transition seamlessly.');
