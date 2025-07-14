# Verification of Propofol PK-PD Model Implementation

**Date:** 2025-07-11
**Status:** Verified

## 1. Introduction

This document presents a formal verification of the computational logic implemented in the propofol Target-Controlled Infusion (TCI) application, specifically within the `eleveld-pk-pd.js` file. The objective is to confirm that the implementation accurately reflects the pharmacokinetic-pharmacodynamic (PK-PD) model for propofol as published by Eleveld et al. in the *British Journal of Anaesthesia* (2018).

**Reference Publication:**
Eleveld, D. J., Colin, P., Absalom, A. R., & Struys, M. M. R. F. (2018). Pharmacokinetic-pharmacodynamic model for propofol for broad application in anaesthesia and sedation. *British Journal of Anaesthesia*, 120(5), 942-959. doi:10.1016/j.bja.2018.01.018.

**Cited Formula Reference:**
Al-Sallami, H. S., Goulding, A., Grant, A., Taylor, R., Holford, N., & Duffull, S. B. (2015). Prediction of fat-free mass in children. *Clinical pharmacokinetics*, 54(11), 1169-1178.

## 2. Methodology

The verification was conducted by a direct comparison of the mathematical equations and parameter values presented in the Eleveld et al. paper, and its cited sources, against the corresponding JavaScript code in `eleveld-pk-pd.js`. The analysis focused on the core components of the model: PK parameter calculations, PD parameter calculations, and the influence of patient-specific covariates.

## 3. Results

### 3.1. Pharmacokinetic (PK) Model Verification

The core PK parameter calculations for a three-compartment model (V1, V2, V3, CL, Q2, Q3) were assessed.

- **Fat-Free Mass (FFM) Calculation:**
    - **Status:** VERIFIED
    - **Verification:** The `calculateFFM` function in the JavaScript code is a correct and precise implementation of the original Al-Sallami et al. (2015) equation, which the Eleveld et al. (2018) paper cites. The mathematical structure and constants for both male and female calculations exactly match the published source formula. The Eleveld paper's presentation of this formula is abbreviated and ambiguous; the application correctly implements the full, original equation.

- **Parameter Equations:**
    - **Status:** VERIFIED
    - **Verification:** The JavaScript implementation of the equations for calculating central and peripheral volumes (V1, V2, V3) and clearances (CL, Q2, Q3) is consistent with the formulas provided in the Eleveld et al. publication (Table 2 and page 948).

- **Covariate Implementation:**
    - **Status:** VERIFIED
    - **Verification:** The model correctly incorporates the influence of all specified patient covariates (Weight, Age, PMA, Sex, Opioid Co-administration) as described in the paper.

### 3.2. Pharmacodynamic (PD) Model Verification

The PD component, which links propofol concentration to the Bispectral Index (BIS), was also assessed.

- **Parameter Equations & BIS Calculation:**
    - **Status:** VERIFIED
    - **Verification:** The calculations for Ce50 and ke0, including age- and weight-based adjustments, are consistent with the reference paper. The sigmoidal Emax model, including the use of an asymmetric gamma for calculating the final BIS value, is correctly implemented.

## 4. Conclusion

The computational logic within `eleveld-pk-pd.js` is a **faithful and accurate implementation** of the Eleveld et al. (2018) propofol PK-PD model. All components, including the complex FFM calculation derived from the original Al-Sallami et al. (2015) paper, and all subsequent PK and PD calculations and covariate adjustments, have been verified to be correct.

The application's computational engine can be considered a valid and reliable tool for predicting propofol concentration based on the specified model.
