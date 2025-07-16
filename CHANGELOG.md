# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-01-16

### Added
- **🆕 Mobile-Optimized Digital Picker Components**: Complete replacement of slider inputs with touch-friendly digital pickers
  - Enhanced +/- buttons with visual feedback and disabled states
  - Long-press support for rapid value adjustment (0.5s delay, 0.1s intervals)
  - Direct keyboard input with natural typing experience
  - Touch-friendly design with 44px+ touch targets for mobile devices
- **Propofol-Specific Input Ranges**: Optimized for clinical propofol dosing
  - Bolus Dose: 10-200mg (5mg increments)
  - Continuous Infusion: 0-500mg/hr (10mg increments for induction, 5mg for dosing)
  - Patient Height: 50-200cm (expanded range)
- **Real-time BMI Calculation**: Automatic updates during patient data entry with live calculation
- **Enhanced Accessibility Features**: Complete accessibility support
  - High contrast mode support for better visibility
  - Reduced motion support for users with motion sensitivity
  - Mobile-responsive design adjustments

### Changed
- **Patient Information Modal**: Replaced all slider inputs with digital picker components
  - Age picker: 1-100 years (integer values)
  - Weight picker: 5-150 kg (1 decimal place)
  - Height picker: 50-200 cm (integer values)
- **Induction Panel Controls**: Updated dose input interfaces for propofol-specific ranges
  - Bolus dose picker: 10-200mg (5mg increments, integer display)
  - Continuous infusion picker: 0-500mg/hr (10mg increments, integer display)
- **Dose Event Modal**: Enhanced dose input controls
  - Administration bolus: 0-200mg (1mg increments, integer display)
  - Administration continuous: 0-500mg/hr (5mg increments, integer display)

### Fixed
- **Keyboard Input Issues**: Resolved problem where typing numbers immediately triggered range limits
- **Event Listener Safety**: Added comprehensive null safety checks to prevent errors with missing DOM elements
- **Touch Event Handling**: Improved mobile touch responsiveness and prevented default behaviors
- **BMI Calculation Errors**: Fixed null reference errors in updateBMICalculation method
- **Patient Modal Functionality**: Resolved issues with patient information edit button not responding

### Technical Improvements
- **DigitalPicker Class**: 225-line comprehensive input component with floating-point arithmetic correction
- **Error Handling**: Enhanced try-catch blocks and safety checks throughout the application
- **Mobile Optimization**: Improved touch targets and responsive design for smartphone usage
- **Null Safety**: Added extensive null checks for all DOM element interactions
- **Event Management**: Improved event listener management with proper cleanup and initialization

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