# Propofol TCI TIVA V1.0.0

**Effect-site Concentration Target Controlled Infusion Integrated System**

## Overview

A Progressive Web Application (PWA) for propofol target-controlled infusion (TCI) anesthesia management based on the Eleveld et al. (2018) pharmacokinetic-pharmacodynamic model. This integrated system provides real-time plasma and effect-site concentration predictions with BIS monitoring capabilities for clinical education and research.

## Quick Access

**🌐 Live Application**: [https://ysuzuki1978.github.io/propofol-tci-simulator/](https://ysuzuki1978.github.io/propofol-tci-simulator/)

This application is immediately available online without installation. Access the live version directly through your web browser for instant use.

## ⚠️ Disclaimer

**This application is intended for educational and research purposes only. Do not use for clinical diagnosis or treatment decisions. All clinical judgments must be made by qualified healthcare professionals. The authors assume no responsibility for consequences arising from clinical use of this software.**

## Features

### Core Applications
1. **Real-time Induction Prediction** - Live plasma and effect-site concentration monitoring during anesthesia induction
2. **Advanced Protocol Optimization** - Optimal bolus and infusion rate calculation with step-down protocols  
3. **Dose Monitoring** - High-precision concentration calculations from actual dosing records

### Technical Specifications
- **Model**: Eleveld et al. (2018) propofol PK-PD model with BIS integration
- **Algorithm**: Variable-step Hybrid Algorithm for Ce (VHAC) with analytical solutions
- **Integration**: 4th-order Runge-Kutta and LSODA numerical methods
- **Platform**: Progressive Web App compatible with modern browsers
- **Precision**: 0.01-minute resolution (0.6-second accuracy)

## Installation

No installation required. This PWA runs directly in modern web browsers including Chrome, Firefox, Safari, and Edge.

### Quick Start
```bash
# Clone repository
git clone [repository-url]
cd propofol_TCI_TIVA_V1_0_0

# Serve locally (recommended)
python -m http.server 8000
# or
npx serve .

# Open in browser
open http://localhost:8000
```

## Directory Structure

```
propofol_TCI_TIVA_V1_0_0/
├── LICENSE                           # MIT License
├── README.md                         # This file
├── index.html                        # Main application interface
├── manifest.json                     # PWA configuration
├── sw.js                            # Service Worker for offline functionality
├── css/
│   └── main.css                     # Application styles
├── js/
│   ├── main.js                      # Main application controller
│   ├── models.js                    # Data models (Patient, DoseEvent)
│   ├── eleveld-pk-pd.js            # Eleveld 2018 PK-PD model implementation
│   ├── induction-engine.js          # Real-time induction prediction engine
│   ├── protocol-engine.js           # Protocol optimization engine
│   ├── advanced-protocol-engine.js  # Advanced step-down protocol engine
│   ├── monitoring-engine.js         # Dose monitoring engine
│   ├── realtime-chart.js           # Real-time visualization
│   └── remimazolam-pk-pd.js        # Remimazolam model (auxiliary)
├── utils/
│   ├── vhac.js                      # Variable-step Hybrid Algorithm for Ce
│   ├── lsoda.js                     # LSODA ODE solver
│   └── masui-ke0-calculator.js      # Masui ke0 calculation utilities
└── images/
    ├── icon-32.png                  # PWA icons
    ├── icon-192.png
    └── icon-512.png
```

## Mathematical Implementation

### Eleveld 2018 PK-PD Model

#### Three-Compartment Model
```
dA1/dt = R(t) - (k10 + k12 + k13)×A1 + k21×A2 + k31×A3
dA2/dt = k12×A1 - k21×A2
dA3/dt = k13×A1 - k31×A3
dCe/dt = ke0×(Cp - Ce)
```

#### Key Parameters
- **V1**: 6.28 L (reference individual: 35y, 170cm, 70kg male)
- **V2**: 25.5 L  
- **V3**: 273 L
- **CL**: 1.79 L/min (male), 2.10 L/min (female)
- **Q2**: 1.83 L/min
- **Q3**: 1.11 L/min
- **ke0**: 0.146 min⁻¹

#### Pharmacodynamic Model
```
Drug_effect = Ce^γ / (Ce50^γ + Ce^γ)
BIS = BIS_baseline × (1 - Drug_effect)
```
- **Ce50**: 3.08 μg/mL
- **BIS_baseline**: 93.0
- **γ**: 1.47 (Ce > Ce50), 1.89 (Ce < Ce50)

### Numerical Methods

#### VHAC Algorithm
Variable-step hybrid algorithm providing analytical solutions for:
1. **Constant plasma concentration**: Exponential decay solution
2. **Small time steps**: Taylor series expansion for stability
3. **Linear concentration changes**: Closed-form analytical solution

#### Integration Methods
- **Primary**: 4th-order Runge-Kutta with 0.01-minute steps
- **Advanced**: LSODA adaptive step-size ODE solver
- **Fallback**: Euler integration for stability

## Clinical Usage

### Target Populations
- **Age range**: 27 weeks PMA to 88 years
- **Weight range**: 0.68 to 160 kg
- **Demographics**: Pediatric maturation functions, sex-specific parameters, opioid co-administration effects

### Clinical Targets
- **Anesthesia**: Ce50 targeting → 50% drug effect → BIS ≈ 47
- **Sedation**: Ce10 targeting → 10% drug effect → BIS ≈ 84

### Workflow
1. **Patient Setup**: Enter demographics (age, weight, height, sex, ASA-PS)
2. **Target Selection**: Choose effect-site concentration (0.5-8.0 μg/mL)
3. **Protocol Generation**: Calculate optimal bolus and infusion rates
4. **Real-time Monitoring**: Track plasma/effect-site concentrations and BIS

## Validation

### Computational Accuracy
- **Parameter verification**: Exact match with published Eleveld values
- **Mathematical equations**: Verified against original paper formulations
- **Numerical precision**: RK4 integration with 1e-6 relative error
- **VHAC algorithm**: Analytical solutions provide superior accuracy

### Clinical Validation
- **Model population**: Validated on Eleveld study demographics
- **Covariate functions**: Proper age, weight, and maturation adjustments
- **Safety margins**: Built-in overdose prevention mechanisms

## Version History

- **V1.0.0**: Initial release with complete PWA implementation, enhanced VHAC algorithm and BIS integration
- **Beta versions**: Development versions with basic TCI calculations and protocol optimization

## Technical Requirements

### Browser Compatibility
- **Chrome**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Edge**: Version 90+

### Performance
- **Memory usage**: <50MB typical
- **CPU requirements**: Modern processor recommended for real-time calculations
- **Network**: Offline capability after initial load

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary
Permission is granted to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software under the following conditions:
- Include copyright notice and license in all copies
- Software provided "AS IS" without warranty
- Authors not liable for any damages arising from use

**Medical Software Disclaimer**: This software is intended for educational and research purposes only. It should not be used for clinical diagnosis or treatment decisions. All clinical judgments must be made by qualified medical professionals.

## Developer Information

**Yasuyuki Suzuki, MD, PhD**

Affiliations:
1. Department of Anaesthesiology, Saiseikai Matsuyama Hospital, Matsuyama City, Ehime, Japan
2. Department of Pharmacology, Ehime University Graduate School of Medicine, Toon City, Ehime, Japan  
3. Research Division, Saiseikai Research Institute of Health Care and Welfare, Tokyo, Japan

## References

1. Eleveld DJ, Colin P, Absalom AR, Struys MMRF. Pharmacokinetic-pharmacodynamic model for propofol for broad application in anaesthesia and sedation. *Br J Anaesth*. 2018;120(5):942-959. doi:10.1016/j.bja.2018.01.018

2. Al-Sallami HS, Goulding A, Grant A, Taylor R, Holford N, Duffull SB. Prediction of fat-free mass in children. *Clin Pharmacokinet*. 2015;54(11):1169-1178.

3. Shafer SL, Varvel JR. Pharmacokinetics, pharmacodynamics, and rational opioid selection. *Anesthesiology*. 1991;74(1):53-63.

## Publication Status

Manuscript describing the mathematical validation and clinical applications of this system is currently under review for publication in a peer-reviewed journal.

## Acknowledgments

This project was developed with technical assistance from Claude Code (Anthropic) for algorithm optimization and validation procedures.

---

**⚠️ Important: Use this system for research and educational purposes only. Appropriate validation and approval must be obtained before any clinical use.**