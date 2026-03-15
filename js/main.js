/**
 * Main Application Controller for Propofol TCI TIVA V2.1.0
 * Seamless 3-step workflow: Induction -> Protocol -> Monitoring
 * Based on Eleveld et al. (2018) BJA PK/PD model
 */

class MainApplicationController {
    constructor() {
        this.appState = new AppState();
        this.inductionEngine = new InductionEngine();
        this.protocolEngine = new ProtocolEngine();
        this.advancedProtocolEngine = new AdvancedProtocolEngine();
        this.monitoringEngine = new MonitoringEngine();

        // Chart instances
        this.realtimeChart = null;
        this.protocolChart = null;
        this.monitoringChart = null;

        // Wizard state
        this.currentStep = 0;
        this.totalSteps = 3;

        // Workflow data (shared between steps)
        this.locCe = null;           // LOC Ce from induction (Step 1 -> Step 2)
        this.safetyMargin = 1.5;     // Default safety margin for propofol
        this.protocolResult = null;  // Protocol result (Step 2 -> Step 3)

        // Touch tracking for swipe
        this.touchStartX = 0;
        this.touchDeltaX = 0;
        this.isSwiping = false;

        // Hold state for stepper long-press
        this.holdState = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        console.log('Initializing Propofol TCI TIVA V2.1.0');

        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
        }, 1500);

        this.initializeDefaultPatient();
        this.setupEventListeners();
        this.setupWizard();
        this.setupStepperControls();
        this.setupInductionCallbacks();
        this.initializeRealtimeChart();
        this.updatePatientDisplay();

        console.log('Application initialized successfully');
    }

    // =============================================
    // Patient Initialization
    // =============================================
    initializeDefaultPatient() {
        const now = new Date();
        now.setHours(8, 0, 0, 0);

        this.appState.patient = new Patient(
            `Patient-${new Date().toISOString().split('T')[0]}`,
            35, 70.0, 170.0,
            SexType.MALE, AsapsType.CLASS_1_2, now
        );

        // Set opioid co-admin default
        if (typeof OpioidType !== 'undefined') {
            this.appState.patient.opioidCoadmin = OpioidType.YES;
        }

        this.protocolEngine.setPatient(this.appState.patient);
        this.advancedProtocolEngine.setPatient(this.appState.patient);
        this.monitoringEngine.setPatient(this.appState.patient);
    }

    // =============================================
    // Wizard Control
    // =============================================
    setupWizard() {
        // Step tab clicks
        document.querySelectorAll('.step-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.goToStep(parseInt(tab.dataset.step));
            });
        });

        // Next/Back button clicks
        document.querySelectorAll('[data-goto]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetStep = parseInt(btn.dataset.goto);
                this.goToStep(targetStep);
            });
        });

        // Swipe gesture on wizard viewport
        const viewport = document.querySelector('.wizard-viewport');

        viewport.addEventListener('touchstart', (e) => {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'CANVAS') return;

            this.touchStartX = e.touches[0].clientX;
            this.isSwiping = false;
        }, { passive: true });

        viewport.addEventListener('touchmove', (e) => {
            if (this.touchStartX === 0) return;
            this.touchDeltaX = e.touches[0].clientX - this.touchStartX;

            if (Math.abs(this.touchDeltaX) > 20) {
                this.isSwiping = true;
            }
        }, { passive: true });

        viewport.addEventListener('touchend', () => {
            if (this.isSwiping && Math.abs(this.touchDeltaX) > 60) {
                if (this.touchDeltaX < 0 && this.currentStep < this.totalSteps - 1) {
                    this.goToStep(this.currentStep + 1);
                } else if (this.touchDeltaX > 0 && this.currentStep > 0) {
                    this.goToStep(this.currentStep - 1);
                }
            }
            this.touchStartX = 0;
            this.touchDeltaX = 0;
            this.isSwiping = false;
        });

        // Set initial position
        this.goToStep(0);
    }

    goToStep(step) {
        if (step < 0 || step >= this.totalSteps) return;

        this.currentStep = step;
        const track = document.getElementById('wizardTrack');
        const offset = -(step * 100 / this.totalSteps);
        track.style.transform = `translateX(${offset}%)`;

        // Update tab states
        document.querySelectorAll('.step-tab').forEach((tab, i) => {
            tab.classList.toggle('active', i === step);
            tab.classList.toggle('completed', i < step);
        });

        // Trigger step-specific actions
        if (step === 1) {
            this.onEnterProtocolStep();
        } else if (step === 2) {
            this.onEnterMonitoringStep();
        }
    }

    // =============================================
    // Event Listeners
    // =============================================
    setupEventListeners() {
        // Disclaimer
        const disclaimerBtn = document.getElementById('acceptDisclaimer');
        disclaimerBtn.addEventListener('click', () => this.hideDisclaimer());
        disclaimerBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.hideDisclaimer();
        });

        // Patient modal
        document.getElementById('editPatientBtn').addEventListener('click', () => this.showPatientModal());
        document.getElementById('closePatientModal').addEventListener('click', () => this.hidePatientModal());
        document.getElementById('cancelPatientEdit').addEventListener('click', () => this.hidePatientModal());
        document.getElementById('patientForm').addEventListener('submit', (e) => this.savePatientData(e));

        // Step 1: Induction
        document.getElementById('startInductionBtn').addEventListener('click', () => this.startInduction());
        document.getElementById('stopInductionBtn').addEventListener('click', () => this.stopInduction());
        document.getElementById('recordSnapshotBtn').addEventListener('click', () => this.recordSnapshot());
        document.getElementById('recordLOCBtn').addEventListener('click', () => this.recordLOC());

        // Step 2: Protocol
        document.getElementById('optimizeProtocolBtn').addEventListener('click', () => this.optimizeProtocol());

        // Safety margin change
        document.getElementById('safetyMargin').addEventListener('change', () => this.updateTargetCeFromMargin());

        // Step 3: Monitoring
        document.getElementById('addDoseBtn').addEventListener('click', () => this.showDoseModal());
        document.getElementById('runSimulationBtn').addEventListener('click', () => this.runMonitoringSimulation());
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCsv());

        // Dose modal
        document.getElementById('closeDoseModal').addEventListener('click', () => this.hideDoseModal());
        document.getElementById('cancelDoseAdd').addEventListener('click', () => this.hideDoseModal());
        document.getElementById('doseForm').addEventListener('submit', (e) => this.addDoseEvent(e));

        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });
    }

    // =============================================
    // Stepper Controls (unified event delegation)
    // =============================================
    setupStepperControls() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.stepper-btn');
            if (btn) this.handleStepperButton(btn);
        });

        // Long-press: pointerdown
        document.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.stepper-btn');
            if (btn) {
                e.preventDefault();
                this.startHold(btn);
            }
        });

        ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
            document.addEventListener(evt, () => this.stopHold());
        });

        window.addEventListener('blur', () => this.stopHold());
    }

    handleStepperButton(button) {
        const targetId = button.getAttribute('data-target');
        const step = parseFloat(button.getAttribute('data-step'));
        const input = document.getElementById(targetId);
        if (!input) return;

        const isIncrement = button.classList.contains('stepper-plus');
        const currentValue = parseFloat(input.value) || 0;
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);

        let newValue = isIncrement ? currentValue + step : currentValue - step;
        // Fix floating point
        newValue = Math.round(newValue * 1000) / 1000;
        if (!isNaN(min)) newValue = Math.max(min, newValue);
        if (!isNaN(max)) newValue = Math.min(max, newValue);

        // Display with appropriate precision to avoid floating point artifacts
        const stepStr = button.getAttribute('data-step');
        const decimals = (stepStr.includes('.')) ? stepStr.split('.')[1].length : 0;
        input.value = newValue.toFixed(decimals);
        input.dispatchEvent(new Event('change'));

        this.onStepperValueChanged(targetId, newValue);
    }

    onStepperValueChanged(targetId, value) {
        // Induction dose updates
        if (targetId === 'inductionBolus' || targetId === 'inductionContinuous') {
            if (this.appState.isInductionRunning) {
                const bolus = parseFloat(document.getElementById('inductionBolus').value);
                const continuous = parseFloat(document.getElementById('inductionContinuous').value);
                this.inductionEngine.updateDose(bolus, continuous);
            }
        }

        // BMI update
        if (targetId === 'editWeight' || targetId === 'editHeight') {
            this.updateBMICalculation();
        }

        // Safety margin update
        if (targetId === 'safetyMargin') {
            this.safetyMargin = value;
            this.updateTargetCeFromMargin();
        }
    }

    startHold(button) {
        this.stopHold();
        this.holdState = {
            button: button,
            timeout: null,
            interval: null,
            currentInterval: 200
        };

        button.classList.add('holding');

        this.holdState.timeout = setTimeout(() => {
            this.startHoldInterval(button);
        }, 500);
    }

    startHoldInterval(button) {
        this.holdState.interval = setInterval(() => {
            this.handleStepperButton(button);
            this.holdState.currentInterval *= 0.9;
            if (this.holdState.currentInterval < 50) {
                this.holdState.currentInterval = 50;
            }
            clearInterval(this.holdState.interval);
            this.startHoldInterval(button);
        }, this.holdState.currentInterval);
    }

    stopHold() {
        if (this.holdState) {
            clearTimeout(this.holdState.timeout);
            clearInterval(this.holdState.interval);
            if (this.holdState.button) {
                this.holdState.button.classList.remove('holding');
            }
            this.holdState = null;
        }
    }

    // =============================================
    // Induction Callbacks & Realtime Chart
    // =============================================
    setupInductionCallbacks() {
        this.inductionEngine.addUpdateCallback((state) => {
            this.updateInductionDisplay(state);
            this.updateRealtimeChart(state);
        });
    }

    initializeRealtimeChart() {
        try {
            this.realtimeChart = new RealtimeChart('inductionRealtimeChart', 300);
            console.log('Realtime chart initialized successfully');
        } catch (error) {
            console.error('Failed to initialize realtime chart:', error);
        }
    }

    // =============================================
    // Modal Management
    // =============================================
    hideDisclaimer() {
        document.getElementById('disclaimerModal').classList.remove('active');
        document.getElementById('mainApp').classList.remove('hidden');
    }

    showPatientModal() {
        const modal = document.getElementById('patientModal');
        const patient = this.appState.patient;

        document.getElementById('editPatientId').value = patient.id;
        document.getElementById('editAge').value = patient.age;
        document.getElementById('editWeight').value = patient.weight;
        document.getElementById('editHeight').value = patient.height;
        document.querySelector(`input[name="sex"][value="${patient.sex === SexType.MALE ? 'male' : 'female'}"]`).checked = true;
        document.querySelector(`input[name="asa"][value="${patient.asaPS === AsapsType.CLASS_1_2 ? '1-2' : '3-4'}"]`).checked = true;

        // Opioid co-admin
        if (typeof OpioidType !== 'undefined' && patient.opioidCoadmin !== undefined) {
            document.querySelector(`input[name="opioid"][value="${patient.opioidCoadmin === OpioidType.YES ? 'yes' : 'no'}"]`).checked = true;
        }

        document.getElementById('editAnesthesiaStart').value = patient.formattedStartTime;
        this.updateBMICalculation();

        modal.classList.add('active');
    }

    hidePatientModal() {
        document.getElementById('patientModal').classList.remove('active');
    }

    showDoseModal() {
        document.getElementById('doseTime').value = this.appState.patient.formattedStartTime;
        document.getElementById('doseBolusAmount').value = 0;
        document.getElementById('doseContinuousRate').value = 0;
        document.getElementById('anesthesiaStartReference').textContent = this.appState.patient.formattedStartTime;
        document.getElementById('doseModal').classList.add('active');
    }

    hideDoseModal() {
        document.getElementById('doseModal').classList.remove('active');
    }

    // =============================================
    // Patient Data
    // =============================================
    savePatientData(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const timeValue = document.getElementById('editAnesthesiaStart').value;
        const anesthesiaStart = new Date(this.appState.patient.anesthesiaStartTime);
        const [hours, minutes] = timeValue.split(':').map(Number);
        anesthesiaStart.setHours(hours, minutes, 0, 0);

        this.appState.patient.id = document.getElementById('editPatientId').value;
        this.appState.patient.age = parseInt(document.getElementById('editAge').value);
        this.appState.patient.weight = parseFloat(document.getElementById('editWeight').value);
        this.appState.patient.height = parseFloat(document.getElementById('editHeight').value);
        this.appState.patient.sex = formData.get('sex') === 'male' ? SexType.MALE : SexType.FEMALE;
        this.appState.patient.asaPS = formData.get('asa') === '1-2' ? AsapsType.CLASS_1_2 : AsapsType.CLASS_3_4;

        if (typeof OpioidType !== 'undefined') {
            this.appState.patient.opioidCoadmin = formData.get('opioid') === 'yes' ? OpioidType.YES : OpioidType.NO;
        }

        this.appState.patient.anesthesiaStartTime = anesthesiaStart;

        const validation = this.appState.patient.validate();
        if (!validation.isValid) {
            alert('Input Error:\n' + validation.errors.join('\n'));
            return;
        }

        this.protocolEngine.setPatient(this.appState.patient);
        this.advancedProtocolEngine.setPatient(this.appState.patient);
        this.monitoringEngine.setPatient(this.appState.patient);

        this.updatePatientDisplay();
        this.hidePatientModal();
    }

    updatePatientDisplay() {
        const p = this.appState.patient;
        const summary = `${p.age}y ${p.weight}kg`;
        document.getElementById('headerPatientSummary').textContent = summary;
    }

    updateBMICalculation() {
        const weight = parseFloat(document.getElementById('editWeight').value);
        const height = parseFloat(document.getElementById('editHeight').value);
        const bmi = weight / Math.pow(height / 100, 2);
        document.getElementById('bmiCalculated').textContent = bmi.toFixed(1);
    }

    // =============================================
    // Step 1: Induction
    // =============================================
    startInduction() {
        const bolus = parseFloat(document.getElementById('inductionBolus').value);
        const continuous = parseFloat(document.getElementById('inductionContinuous').value);

        // Clear the realtime chart when starting new induction
        if (this.realtimeChart) {
            this.realtimeChart.clear();
        }

        if (this.inductionEngine.start(this.appState.patient, bolus, continuous)) {
            this.appState.isInductionRunning = true;
            this.updateInductionControls();
        }
    }

    stopInduction() {
        if (this.inductionEngine.stop()) {
            this.appState.isInductionRunning = false;
            this.updateInductionControls();
        }
    }

    recordSnapshot() {
        const snapshot = this.inductionEngine.takeSnapshot();
        if (snapshot) this.updateSnapshotsDisplay();
    }

    recordLOC() {
        // Record the current effect-site concentration as LOC Ce
        const state = this.inductionEngine.getState();
        if (!state) return;

        this.locCe = state.effectSiteConcentration;

        // Update LOC display in Step 1
        document.getElementById('locCeDisplay').classList.remove('hidden');
        document.getElementById('locCeValue').textContent = this.locCe.toFixed(3);

        // Also record as a snapshot
        this.recordSnapshot();

        // Mark Step 1 tab as completed
        document.querySelector('.step-tab[data-step="0"]').classList.add('completed');

        // Update target Ce calculation
        this.updateTargetCeFromMargin();
    }

    updateInductionDisplay(state) {
        document.getElementById('plasmaConcentration').textContent = state.plasmaConcentration.toFixed(3);
        document.getElementById('effectConcentration').textContent = state.effectSiteConcentration.toFixed(3);

        // Format elapsed time as MM:SS
        const totalSec = Math.floor(state.elapsedTime);
        const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const ss = (totalSec % 60).toString().padStart(2, '0');
        document.getElementById('elapsedTime').textContent = `${mm}:${ss}`;
    }

    updateRealtimeChart(state) {
        if (this.realtimeChart && state.isRunning) {
            this.realtimeChart.addDataPoint(
                state.elapsedTime * 60,  // Convert minutes to seconds
                state.effectSiteConcentration,
                state.bisValue
            );
        }
    }

    updateInductionControls() {
        const isRunning = this.appState.isInductionRunning;
        document.getElementById('startInductionBtn').classList.toggle('hidden', isRunning);
        document.getElementById('stopInductionBtn').classList.toggle('hidden', !isRunning);
        document.getElementById('recordSnapshotBtn').classList.toggle('hidden', !isRunning);
        document.getElementById('recordLOCBtn').classList.toggle('hidden', !isRunning);
    }

    updateSnapshotsDisplay() {
        const snapshots = this.inductionEngine.getState().snapshots;
        const container = document.getElementById('snapshotsList');
        const section = document.getElementById('snapshotsSection');

        if (snapshots.length > 0) {
            section.classList.remove('hidden');
            container.innerHTML = '';

            snapshots.forEach((snapshot, index) => {
                const item = document.createElement('div');
                item.className = 'snapshot-item';
                item.innerHTML = `
                    <div class="snapshot-header">
                        <span class="snapshot-title">Record #${snapshots.length - index}</span>
                        <span class="snapshot-time">${snapshot.formattedTime}</span>
                    </div>
                    <div class="snapshot-values">
                        <span>Cp: ${snapshot.plasmaConcentration.toFixed(3)}</span>
                        <span>Ce: ${snapshot.effectSiteConcentration.toFixed(3)} &#956;g/mL</span>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            section.classList.add('hidden');
        }
    }

    // =============================================
    // Step 2: Protocol Optimization
    // =============================================
    onEnterProtocolStep() {
        // If LOC Ce is available, show transfer banner and auto-fill target
        if (this.locCe !== null) {
            document.getElementById('locTransferBanner').classList.remove('hidden');
            document.getElementById('transferredLocCe').textContent = this.locCe.toFixed(3);
            this.updateTargetCeFromMargin();
        }
    }

    updateTargetCeFromMargin() {
        if (this.locCe === null) {
            document.getElementById('calculatedTargetCe').textContent = '---';
            return;
        }

        this.safetyMargin = parseFloat(document.getElementById('safetyMargin').value) || 1.5;
        const targetCe = Math.round((this.locCe + this.safetyMargin) * 1000) / 1000;

        document.getElementById('calculatedTargetCe').textContent = targetCe.toFixed(3);

        // Auto-fill the target concentration input
        document.getElementById('targetConcentration').value = targetCe.toFixed(1);
    }

    optimizeProtocol() {
        const targetConcentration = parseFloat(document.getElementById('targetConcentration').value);
        const bolusDose = parseFloat(document.getElementById('protocolBolus').value);
        const targetTime = parseFloat(document.getElementById('targetReachTime').value);
        const upperThresholdRatio = parseFloat(document.getElementById('upperThresholdRatio').value) / 100;
        const reductionFactor = parseFloat(document.getElementById('reductionFactor').value) / 100;
        const adjustmentInterval = parseFloat(document.getElementById('adjustmentInterval').value);

        try {
            // Update advanced protocol engine settings
            this.advancedProtocolEngine.updateSettings({
                targetCe: targetConcentration,
                targetReachTime: targetTime,
                upperThresholdRatio: upperThresholdRatio,
                reductionFactor: reductionFactor,
                adjustmentInterval: adjustmentInterval
            });

            const result = this.advancedProtocolEngine.optimizeBolusProtocol(
                targetConcentration,
                bolusDose,
                targetTime
            );

            this.protocolResult = result;
            this.appState.protocolResult = result;
            this.updateProtocolDisplay(result);

            // Mark Step 2 as completed
            document.querySelector('.step-tab[data-step="1"]').classList.add('completed');
        } catch (error) {
            console.error('Protocol optimization failed:', error);
            alert('Optimization error:\n' + error.message);
        }
    }

    updateProtocolDisplay(result) {
        document.getElementById('protocolResults').classList.remove('hidden');
        document.getElementById('optimalRate').textContent = result.optimization.optimalRate.toFixed(2);

        // Display final Ce from time series data
        const finalCe = result.protocol.timeSeriesData[result.protocol.timeSeriesData.length - 1].ce;
        document.getElementById('predictedFinalCe').textContent = finalCe.toFixed(3);

        document.getElementById('targetAccuracy').textContent = result.performance.targetAccuracy.toFixed(1);
        document.getElementById('adjustmentCount').textContent = result.performance.totalAdjustments;
        document.getElementById('stabilityIndex').textContent = result.performance.stabilityIndex.toFixed(1);
        document.getElementById('convergenceTime').textContent =
            result.performance.convergenceTime === Infinity ? '---' : result.performance.convergenceTime.toFixed(1);

        this.updateProtocolChart(result);
        this.updateProtocolTable(result.schedule);
    }

    updateProtocolChart(result) {
        const ctx = document.getElementById('protocolChart').getContext('2d');
        if (this.protocolChart) this.protocolChart.destroy();

        const chartData = this.advancedProtocolEngine.getChartData();
        if (!chartData || !chartData.times) return;

        // Convert times to clock-time labels
        const labels = chartData.times.map(t => {
            const ct = this.appState.patient.minutesToClockTime(t);
            return ct.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        });

        this.protocolChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cp',
                        data: chartData.plasmaConcentrations,
                        borderColor: '#29B6F6',
                        fill: false, tension: 0.1, pointRadius: 0, borderWidth: 1.5
                    },
                    {
                        label: 'Ce',
                        data: chartData.effectSiteConcentrations,
                        borderColor: '#4CAF50',
                        fill: false, tension: 0.1, pointRadius: 0, borderWidth: 2
                    },
                    {
                        label: 'Target',
                        data: chartData.targetLine,
                        borderColor: 'rgba(244,67,54,0.8)',
                        borderDash: [5, 5], tension: 0, pointRadius: 0, borderWidth: 1.5, fill: false
                    },
                    {
                        label: 'Rate',
                        data: chartData.infusionRates,
                        borderColor: '#CE93D8',
                        tension: 0.1, pointRadius: 0, borderWidth: 1.5, fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false, axis: 'x' },
                plugins: {
                    tooltip: {
                        events: ['click', 'touchstart'],
                        padding: 10, cornerRadius: 8,
                        titleFont: { size: 12 }, bodyFont: { size: 11 },
                        backgroundColor: '#333', titleColor: '#fff', bodyColor: '#e0e0e0',
                        borderColor: '#4a4a4a', borderWidth: 1
                    },
                    legend: { display: true, labels: { boxWidth: 12, font: { size: 11 }, color: '#a0a0a0' } }
                },
                scales: {
                    x: { ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Conc (ug/mL)', font: { size: 10 }, color: '#a0a0a0' }, ticks: { color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    y1: {
                        type: 'linear', display: true, position: 'right', beginAtZero: true,
                        title: { display: true, text: 'Rate (mg/hr)', font: { size: 10 }, color: '#a0a0a0' },
                        ticks: { color: '#a0a0a0' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    updateProtocolTable(schedule) {
        const container = document.getElementById('protocolTable');
        container.innerHTML = '';

        if (!schedule || schedule.length === 0) return;

        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr>
                <th>Time</th><th>Action</th><th>Rate</th><th>Comment</th>
            </tr></thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        schedule.forEach(item => {
            const row = document.createElement('tr');
            if (item.type === 'step_down') row.className = 'reactive';
            else if (item.type === 'start_continuous') row.className = 'predictive';
            const timeStr = item.time !== '' && item.time !== undefined ? `${item.time} min` : '';
            row.innerHTML = `
                <td>${timeStr}</td>
                <td>${item.action || '---'}</td>
                <td>${item.rate || '---'}</td>
                <td>${item.comment || ''}</td>
            `;
            tbody.appendChild(row);
        });

        container.appendChild(table);
    }

    // =============================================
    // Step 3: Monitoring
    // =============================================
    onEnterMonitoringStep() {
        // If protocol result exists, offer to transfer
        if (this.protocolResult) {
            this.transferProtocolToMonitoring();
        }
    }

    transferProtocolToMonitoring() {
        const result = this.protocolResult;
        if (!result) return;

        const banner = document.getElementById('protocolTransferBanner');
        const info = document.getElementById('transferredProtocolInfo');

        const bolus = parseFloat(document.getElementById('protocolBolus').value);
        const rate = result.optimization.optimalRate;

        info.textContent = `Bolus ${bolus}mg + ${rate.toFixed(1)} mg/hr`;
        banner.classList.remove('hidden');

        // Only auto-load if monitoring has no events yet
        const events = this.monitoringEngine.getDoseEvents();
        if (events.length === 0) {
            // Add bolus at time 0 with initial continuous rate
            const bolusEvent = new DoseEvent(0, bolus, rate);
            this.monitoringEngine.addDoseEvent(bolusEvent);

            // Add step-down adjustments from schedule
            if (result.schedule) {
                result.schedule.forEach(item => {
                    if (item.type === 'step_down' && item.time > 0) {
                        // Extract numeric rate from string like "123.45 mg/hr"
                        const rateStr = item.rate || '';
                        const numericRate = parseFloat(rateStr);
                        if (!isNaN(numericRate)) {
                            const adjEvent = new DoseEvent(Math.round(item.time), 0, numericRate);
                            this.monitoringEngine.addDoseEvent(adjEvent);
                        }
                    }
                });
            }

            this.updateMonitoringDisplay();
        }
    }

    addDoseEvent(e) {
        e.preventDefault();

        const timeValue = document.getElementById('doseTime').value;
        const bolusAmount = parseFloat(document.getElementById('doseBolusAmount').value);
        const continuousRate = parseFloat(document.getElementById('doseContinuousRate').value);

        const doseTime = new Date(this.appState.patient.anesthesiaStartTime);
        const [hours, minutes] = timeValue.split(':').map(Number);
        doseTime.setHours(hours, minutes, 0, 0);

        let minutesFromStart = this.appState.patient.clockTimeToMinutes(doseTime);
        if (minutesFromStart < 0) minutesFromStart += 1440;
        minutesFromStart = Math.max(0, Math.round(minutesFromStart));

        const doseEvent = new DoseEvent(minutesFromStart, bolusAmount, continuousRate);
        const validation = doseEvent.validate();
        if (!validation.isValid) {
            alert('Input Error:\n' + validation.errors.join('\n'));
            return;
        }

        this.monitoringEngine.addDoseEvent(doseEvent);
        this.updateMonitoringDisplay();
        this.hideDoseModal();
    }

    updateMonitoringDisplay() {
        const events = this.monitoringEngine.getDoseEvents();
        const container = document.getElementById('doseEventsList');
        container.innerHTML = '';

        events.forEach((event, index) => {
            const item = this.createDoseEventElement(event, index);
            container.appendChild(item);
        });
    }

    createDoseEventElement(event, index) {
        const div = document.createElement('div');
        div.className = 'dose-event';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'dose-info';

        const title = document.createElement('h4');
        title.textContent = `${event.timeInMinutes} min (${event.formattedClockTime(this.appState.patient)})`;

        const details = document.createElement('div');
        details.className = 'dose-details';

        if (event.bolusMg > 0 || event.continuousMgKgHr > 0) {
            if (event.bolusMg > 0) {
                const span = document.createElement('span');
                span.textContent = `Bolus: ${event.bolusMg.toFixed(1)}mg`;
                details.appendChild(span);
            }
            if (event.continuousMgKgHr > 0) {
                const span = document.createElement('span');
                span.textContent = `${event.continuousMgKgHr.toFixed(1)}mg/hr`;
                details.appendChild(span);
            }
        } else {
            const span = document.createElement('span');
            span.textContent = 'Discontinued';
            span.className = 'dose-stop';
            details.appendChild(span);
        }

        infoDiv.appendChild(title);
        infoDiv.appendChild(details);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-dose';
        deleteBtn.textContent = '\u00D7';
        deleteBtn.addEventListener('click', () => {
            this.monitoringEngine.removeDoseEvent(index);
            this.updateMonitoringDisplay();
        });

        div.appendChild(infoDiv);
        div.appendChild(deleteBtn);
        return div;
    }

    runMonitoringSimulation() {
        const events = this.monitoringEngine.getDoseEvents();
        if (!events || events.length === 0) {
            alert('No dose events registered.\nPlease run Protocol optimization first, or add dose events manually.');
            return;
        }
        try {
            const result = this.monitoringEngine.runSimulation();
            this.appState.simulationResult = result;
            this.updateMonitoringResults(result);
        } catch (error) {
            console.error('Simulation failed:', error);
            alert('Simulation error:\n' + error.message);
        }
    }

    updateMonitoringResults(result) {
        document.getElementById('simulationResults').classList.remove('hidden');
        document.getElementById('maxPlasmaConc').textContent = result.maxPlasmaConcentration.toFixed(3);
        document.getElementById('maxEffectConc').textContent = result.maxEffectSiteConcentration.toFixed(3);
        document.getElementById('minBISValue').textContent = result.minBISValue ? result.minBISValue.toFixed(1) : '---';

        this.updateMonitoringChart(result);
    }

    updateMonitoringChart(result) {
        const ctx = document.getElementById('monitoringChart').getContext('2d');
        if (this.monitoringChart) this.monitoringChart.destroy();

        const chartData = this.monitoringEngine.getChartData();
        if (!chartData) return;

        this.monitoringChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Cp',
                        data: chartData.plasmaData,
                        borderColor: '#29B6F6',
                        fill: false, tension: 0.1, pointRadius: 0, borderWidth: 1.5
                    },
                    {
                        label: 'Ce',
                        data: chartData.effectData,
                        borderColor: '#4CAF50',
                        fill: false, tension: 0.1, pointRadius: 0, borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false, axis: 'x' },
                plugins: {
                    tooltip: {
                        events: ['click', 'touchstart'],
                        padding: 10, cornerRadius: 8,
                        titleFont: { size: 12 }, bodyFont: { size: 11 },
                        backgroundColor: '#333', titleColor: '#fff', bodyColor: '#e0e0e0',
                        borderColor: '#4a4a4a', borderWidth: 1
                    },
                    legend: { labels: { boxWidth: 12, font: { size: 11 }, color: '#a0a0a0' } }
                },
                scales: {
                    x: { ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Conc (ug/mL)', font: { size: 10 }, color: '#a0a0a0' }, ticks: { color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.08)' } }
                }
            }
        });
    }

    // =============================================
    // CSV Export
    // =============================================
    exportCsv() {
        try {
            const csvContent = this.monitoringEngine.exportToCSV();
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const patientId = this.appState.patient.id.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `propofol_${patientId}_${dateStr}.csv`;

            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('CSV export failed:', error);
            alert('Export error:\n' + error.message);
        }
    }
}

// Initialize
const app = new MainApplicationController();

if (typeof window !== 'undefined') {
    window.app = app;
}
