# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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