# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.1] - 2026-10-25

Cleanup release: dead code removed, one integrator, tests. The Ce shown by the protocol and monitoring steps changes (see Fixed); the induction step is unchanged.

### Removed
- `utils/lsoda.js` and `utils/vhac.js`, the commented-out LSODA branches, and every function that only they called. `vhac.js` was never loaded by `index.html`, so reviving the LSODA branch would have thrown `ReferenceError`
- Functions with no callers: `runCompleteOptimization`, `ProtocolEngine.getChartData`, `gridSearchOptimization`, `gridSearchOptimizationFullProtocol`, `simulateFullProtocolFinalCe`, `AdvancedProtocolEngine.simulateBolusAndContinuous`, `generateMultiPointSchedule`, `generateDetailedSchedule`, `getOptimizationHistory`, `removeUpdateCallback`, `calculateEffectSiteDiscrete`, and the three unused `calculateEffectSiteConcentration`
- The Euler paths (`updateSystemStateEuler` x4, the Euler fallback in the induction engine) and `MonitoringEngine.calculateEffectSiteConcentrationsRK4`
- About 1,850 lines in total (1,852 deleted, 153 added in `js/`, `utils/`, `index.html`, `sw.js`)

### Changed
- `js/integrator.js`: one RK4 step of the 3-compartment system with the effect site in the state, used by all four engines (it replaces four copies of `updateSystemStateRK4`)
- `js/pk-engine-base.js` and `EleveldPKPDCalculator.resolveParameters`: one place that derives and validates the PK/PD parameters. The four `calculatePKParameters` and three `setPatient` copies are gone. Engines no longer write `pkParams` / `pdParams` onto the `Patient`
- `ProtocolEngine.simulateBolusAndContinuousRK4` and `generateCompleteProtocolRK4` (RK4 in the name, Euler in the body) are `simulateBolusAndContinuous` and `generateCompleteProtocol`, and now use RK4
- `npm test` runs `test/` (Node, no dependencies)

### Fixed
- Fat-free mass now uses the Al-Sallami product form (maturation factor x Janmahasatian), as in the Triad simulator and the Eleveld 2018 PK table. The earlier code used an additive form with an extra term and a shortcut of 0.82 x weight below 2 years; the two copies in `models.js` and `eleveld-pk-pd.js` are now one. The reference individual (35 y, 70 kg, 170 cm) is unchanged. Effect on V3 / Q3 in the cases checked: 1.5 y 10 kg -0.7 / -0.5 %, 5 y 18 kg +0.9 / +0.7 %, 45 y 120 kg -0.8 / -0.6 %, 30 y 150 kg +2.0 / +1.5 %, 80 y 50 kg +1.7 / +1.3 %. V1, V2 and CL are unchanged. A test compares FFM with the Triad values
- Effect-site concentration in the protocol paths was integrated with forward Euler (dt = 0.1 min) and lagged the true value. Against the exact (matrix exponential) solution for 100 mg bolus + 300 mg/h, 40 y 70 kg male, Eleveld:
  - `simulateBolusAndContinuous`, Ce at 1 min: 1.62989 -> 1.56677 ug/mL (exact 1.56677); error +4.03 % -> 0.00 %. At 5 min +2.90 % -> 0.00 %, at 20 min +0.36 % -> 0.00 %
  - `generateCompleteProtocol`, Ce at 1 min: 1.52614 -> 1.56611 (+2.6 %, with the next fix 1.56533)
  - Advanced step-down, Ce at 1 min: 1.52648 -> 1.56677 (+2.6 %); maximum relative error over the 360 min run 2.66 % -> 0.00 %
  - Monitoring: maximum relative error 1.30 % -> 0.00 % (Ce is now integrated together with Cp instead of from interpolated Cp)
  - Induction: unchanged (it already integrated Ce with RK4)
  - Advanced-protocol optimal rate: 490 mg/h unchanged for the 40 y 70 kg male; 783.6 -> 784.6 mg/h for a 70 y 55 kg 155 cm female with opioid (after both fixes)
- A step-down rate was recorded and printed at time t but applied to the integration step one step later (0.1 min) in `generateCompleteProtocol` and `simulateAdvancedStepDownProtocol`. Replaying the recorded rates through the exact solution now matches (0.37 % -> 0.00 % maximum Ce error)

### Tests
- 12 tests: the four engines against the exact solution at <1e-6 relative (bolus, infusion, rate change, later bolus, stop), the engines against each other, the Eleveld 2018 reference individual (V1 6.28, V2 25.5, V3 273, CL 1.79, Q3 1.11), and a negative control (a rate in mg/h taken as mg/min is flagged). The exact-solution code is adapted from anesthesia-triad-simulator v0.8.6 (`validation/lib/exact.js`)
- Not changed: the fat-free-mass formula in `eleveld-pk-pd.js` (see the Triad repository's comparison; under review)

## [2.6.0] - 2026-10-23

### Added
- Bottom tab bar for Induction / Protocol / Monitoring, with a fixed strip of Ce, LOC Ce and target Ce above every step
- Pinch zoom, pan, double-tap reset and zoom buttons on the three charts (`js/chart-interaction.js`); legend chips show the values at the cursor
- `Now` button beside the anesthesia start time in the patient settings

### Changed
- Chart.js 3.9.1 and the date-fns adapter are bundled in `js/vendor/` instead of loaded from a CDN
- Version strings (package, manifest, service worker, title, header, saved sessions) are all V2.6.0

### Fixed
- Elapsed time in the real-time induction stayed at `00:00` (minutes were formatted as seconds)

## [2.0.0] - 2026-03-14

### Added
- **Seamless 3-Step Wizard Workflow**: Unified Induction -> Protocol -> Monitoring pipeline
  - Step 1 (Induction): Real-time Ce/Cp prediction with LOC (Loss of Consciousness) Ce recording
  - Step 2 (Protocol): Auto-receives LOC Ce from Step 1, configurable safety margin (default +1.5 µg/mL), auto-calculates target Ce
  - Step 3 (Monitoring): Auto-imports protocol dosing schedule (bolus + step-down adjustments)
- **LOC Button**: One-tap recording of sleep onset effect-site concentration during induction
- **Safety Margin Setting**: Adjustable margin above LOC Ce to prevent intraoperative awareness (default +1.5 µg/mL for propofol)
- **Swipe Navigation**: Left/right swipe gesture to navigate between workflow steps
- **Step Progress Bar**: Visual step indicator with completed/active state tracking
- **Data Transfer Banners**: Visual confirmation when data flows between steps

### Changed
- **Complete UI Redesign**: Mobile-first 3-step wizard replacing stacked panel layout
  - Compact header with patient summary
  - Tab-based step navigation replacing scroll-based panel access
  - Bottom-sheet style modals for iOS-native feel
- **iPhone Optimization**:
  - Safe area support (notch, home indicator) via `env(safe-area-inset-*)`
  - 48px+ touch targets on all stepper buttons
  - `font-size: max(16px, 1rem)` on inputs to prevent iOS auto-zoom
  - `viewport-fit=cover` for full-screen PWA experience
  - `touch-action: manipulation` to prevent double-tap zoom
- **Stepper Controls**: Unified stepper with long-press acceleration, floating-point display fix
- **Chart.js Touch Optimization**: Tap-to-show tooltips, `intersect: false` for finger-friendly interaction
- **Protocol Parameters**: Advanced settings collapsed by default, reducing initial cognitive load
- **Version**: V1.2.1 -> V2.0.0
- **PWA Manifest**: Updated orientation to `any`, theme color maintained #2196F3

### Fixed
- **Floating Point Display**: Stepper values now display with correct decimal precision

## [Unreleased]

## [1.2.1] - 2025-07-20

### Fixed
- **Real-time Display**: Fixed time display issue where elapsed time remained at 00:00:00 due to unit conversion error
- **Effect-Site Consistency**: Resolved discrepancy in effect-site concentration rise time between Real-time Induction and Dose Monitoring engines
- **Bolus Processing**: Unified bolus dose handling as initial conditions across all calculation engines
- **Time Unit Management**: Corrected time unit handling (minutes vs seconds) in display functions

### Improved
- **RK4 Integration**: Enhanced 4th-order Runge-Kutta implementation for 4-dimensional system (a1, a2, a3, Ce)
- **Numerical Accuracy**: Improved effect-site concentration calculation using proper differential equation integration
- **Calculation Consistency**: Ensured identical pharmacokinetic calculations across real-time and monitoring engines
- **Code Reliability**: Streamlined codebase by removing unstable LSODA and complex VHAC implementations

### Technical Benefits of RK4 Implementation
- **Higher Accuracy**: 4th-order accuracy vs 1st-order (Euler method) provides significantly better precision
- **Numerical Stability**: More stable integration for stiff differential equations in pharmacokinetics
- **Consistent Time Steps**: Unified 0.01-minute time steps across all engines for reliable comparisons
- **Reduced Error Propagation**: Lower cumulative errors in long-term simulations
- **Professional Standard**: Industry-standard numerical method for pharmacokinetic modeling

## [1.1.0] - 2025-07-20

### Changed
- **Numerical Unification**: Unified all calculation engines with standardized RK4 integration
- **Bolus Processing**: Changed from delta function approximation to initial state setting for consistency
- **Time Synchronization**: Fixed real-time calculation to use fixed simulation time increments
- **Effect-Site Calculation**: Standardized effect-site concentration calculation across all engines
- **Parameter References**: Unified PK parameter access to `this.patient.pkParams` format

### Removed
- **UI Simplification**: Removed calculation method selection from user interface
- **Export Methods**: Removed multi-method comparison functionality
- **LSODA Integration**: Removed LSODA implementation due to stability issues
- **VHAC Complexity**: Simplified effect-site calculation to use first-order kinetics for consistency

### Fixed
- **Time Management**: Fixed induction engine time calculation inconsistencies
- **Parameter Access**: Corrected PKParam reference errors across engines
- **Effect-Site Formula**: Removed incorrect decay term from effect-site concentration calculation
- **Design Preservation**: Maintained original design approach with simplified algorithms and 0.01-minute precision

### Technical Improvements
- Implemented unified `updateSystemStateRK4` and `updateSystemStateEuler` methods
- Simplified effect-site concentration calculation using unified first-order kinetics
- Maintained original 0.01-minute resolution (0.6-second accuracy) 
- Corrected effect-site concentration formula while respecting original design
- Improved numerical stability and calculation consistency
- Removed LSODA solver due to stability issues in real-time simulation
- Streamlined codebase by removing complex VHAC implementation

## [1.0.0] - 2025-07-13

### Added
- Initial release of Propofol TCI TIVA integrated system
- Real-time induction prediction with live plasma and effect-site concentration monitoring
- Advanced protocol optimization with optimal bolus and infusion rate calculation
- Dose monitoring with high-precision concentration calculations
- Eleveld et al. (2018) propofol PK-PD model implementation
- Variable-step Hybrid Algorithm for Ce (VHAC) with analytical solutions
- BIS monitoring integration and prediction
- Progressive Web App (PWA) functionality with offline capability
- Service Worker implementation for offline use
- 4th-order Runge-Kutta numerical integration
- LSODA adaptive step-size ODE solver support
- Real-time visualization with interactive charts
- Patient demographic input (age, weight, height, sex, ASA-PS)
- Target effect-site concentration selection (0.5-8.0 μg/mL)
- Multi-language support foundation
- MIT License
- Comprehensive documentation

### Technical Features
- **Mathematical Models**: Complete Eleveld 2018 PK-PD model
- **Numerical Methods**: RK4, LSODA, VHAC algorithms
- **Precision**: 0.01-minute resolution (0.6-second accuracy)
- **Platform**: Cross-browser PWA compatibility
- **Performance**: <50MB memory usage, real-time calculations
- **Safety**: Built-in overdose prevention mechanisms

### Medical Applications
- **Educational**: Clinical pharmacology teaching
- **Research**: Anesthesia protocol optimization studies
- **Training**: TCI technique simulation
- **Validation**: Mathematical model verification

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Development Notes

### Version Numbering
This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes or fundamental model changes
- **MINOR**: New functionality added in a backwards-compatible manner
- **PATCH**: Backwards-compatible bug fixes

### Medical Software Disclaimer
⚠️ **Important**: This software is intended for educational and research purposes only. It should not be used for clinical diagnosis or treatment decisions. All clinical judgments must be made by qualified medical professionals.

---

[Unreleased]: https://github.com/ysuzuki1978/propofol-tci-simulator/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ysuzuki1978/propofol-tci-simulator/releases/tag/v1.0.0