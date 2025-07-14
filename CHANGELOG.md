# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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