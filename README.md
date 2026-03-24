# Propofol TCI TIVA V2.3 - Target Controlled Infusion Simulator

## Overview

A Progressive Web Application for Target-Controlled Infusion (TCI) simulation of propofol in Total Intravenous Anesthesia (TIVA). The app provides a seamless 3-step workflow: Induction prediction, Protocol optimization, and Dose monitoring — optimized for iPhone with an OR-monitor dark theme.

**Important Notice**: This application is designed exclusively for research and educational purposes. It is not intended for clinical decision-making, patient care, or therapeutic applications.

## Live Application

**https://ysuzuki1978.github.io/propofol-tci-simulator/**

## User Manual / 取扱説明書

- [User Manual (English)](docs/manual_en.html)
- [取扱説明書 (日本語)](docs/manual_ja.html)

## Features

- **3-Step Seamless Workflow**: Induction → Protocol → Monitoring with automatic data transfer
- **Real-time Induction Prediction**: Live plasma/effect-site concentration tracking with LOC Ce recording
- **Step-down Protocol Optimization**: Safety margin calculation and adaptive dosing schedule
- **Dose Monitoring**: Actual dose input with concentration simulation and CSV export
- **Validated PK Model**: Eleveld et al. (2018) BJA three-compartment PK/PD model with BIS integration
- **iPhone-optimized PWA**: Offline capability, dark OR-monitor theme, safe-area support

## Version History

### V2.3 (2026-03-24)
- **RK4 Timestep Unification**: Standardized RK4 integration timesteps across all engines
  - Induction: dt = 0.01 min (already correct, no change)
  - Protocol: dt = 0.1 min (loop pattern fix only)
  - Monitoring: dt = 0.1 min (optimized from dt=0.01 with <10⁻⁶% error vs dt=0.001)
- **Float Accumulation Fix**: Replaced `t += dt` loop pattern with `i * dt` index multiplication across all time-loop constructs to eliminate floating-point accumulation error

### V2.2 (2026-03-23)
- **PWA Update Notification**: Non-intrusive banner notifies users when a new version is available; update applies on next launch without interrupting active sessions
- **Service Worker Cache Sync**: Aligned SW version with app version

### V2.1
- Bug fixes and Eleveld PK/PD model refinements
- OR-monitor dark theme for clinical environment

## System Requirements

Modern browsers (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+). Works on desktop, tablet, and mobile devices.

## Pharmacokinetic Model

Eleveld DJ, Colin P, Absalom AR, Struys MMRF. Pharmacokinetic-pharmacodynamic model for propofol for broad application in anaesthesia and sedation. *Br J Anaesth*. 2018;120(5):942-959.

## Disclaimer

**Research Use Only**: This application is designed exclusively for research and educational purposes. It is not validated for clinical use, patient care decisions, or therapeutic applications. The developers explicitly disclaim all responsibility for any consequences arising from the use of this software in clinical settings.

## License

MIT License - Copyright (c) 2025 Yasuyuki Suzuki

## Author

**Yasuyuki Suzuki, MD, PhD**

1. Department of Anaesthesiology, Saiseikai Matsuyama Hospital, Matsuyama City, Ehime, Japan
2. Department of Pharmacology, Ehime University Graduate School of Medicine, Toon City, Ehime, Japan

## References

1. Eleveld DJ, Colin P, Absalom AR, Struys MMRF. Pharmacokinetic-pharmacodynamic model for propofol for broad application in anaesthesia and sedation. *British Journal of Anaesthesia*. 2018;120(5):942-959.
