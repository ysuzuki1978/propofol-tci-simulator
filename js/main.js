/**
 * Main Application Controller for Propofol TCI TIVA
 * 統合アプリケーションメインコントローラー
 * 
 * Coordinates:
 * - Induction Engine (Real-time prediction)
 * - Advanced Protocol Engine (Enhanced step-down optimization)
 * - Monitoring Engine (Dose tracking)
 * - UI Management
 * - State Management
 */

class MainApplicationController {
    constructor() {
        this.appState = new AppState();
        this.inductionEngine = new InductionEngine();
        this.protocolEngine = new ProtocolEngine();
        this.advancedProtocolEngine = new AdvancedProtocolEngine();
        this.monitoringEngine = new MonitoringEngine();
        
        // Chart instances
        this.protocolChart = null;
        this.monitoringChart = null;
        this.realtimeChart = null;
        
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        console.log('Initializing Propofol TCI TIVA with Eleveld Model');
        
        // Hide loading screen after short delay
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
        }, 2000);
        
        // Initialize default patient
        this.initializeDefaultPatient();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup induction engine callbacks
        this.setupInductionCallbacks();
        
        // Initialize realtime chart
        this.initializeRealtimeChart();
        
        // Update displays
        this.updatePatientDisplay();
        this.updateAllPanelStates();
        
        console.log('Application initialized successfully');
    }

    initializeDefaultPatient() {
        const now = new Date();
        now.setHours(8, 0, 0, 0); // Default to 8:00 AM
        
        this.appState.patient = new Patient(
            `Patient-${new Date().toISOString().split('T')[0]}`,
            35,
            70.0,
            170.0,
            SexType.MALE,
            AsapsType.CLASS_1_2,
            OpioidType.YES,
            now
        );
        
        // Set patient for all engines
        this.protocolEngine.setPatient(this.appState.patient);
        this.advancedProtocolEngine.setPatient(this.appState.patient);
        this.monitoringEngine.setPatient(this.appState.patient);
        
        console.log('Default patient initialized:', this.appState.patient.id);
    }

    setupEventListeners() {
        // Disclaimer modal
        document.getElementById('acceptDisclaimer').addEventListener('click', () => {
            this.hideDisclaimer();
        });
        
        // Patient information
        document.getElementById('editPatientBtn').addEventListener('click', () => {
            this.showPatientModal();
        });
        
        document.getElementById('closePatientModal').addEventListener('click', () => {
            this.hidePatientModal();
        });
        
        document.getElementById('cancelPatientEdit').addEventListener('click', () => {
            this.hidePatientModal();
        });
        
        document.getElementById('patientForm').addEventListener('submit', (e) => {
            this.savePatientData(e);
        });
        
        // Patient form sliders
        this.setupPatientFormSliders();
        
        // Induction panel
        document.getElementById('startInductionBtn').addEventListener('click', () => {
            this.startInduction();
        });
        
        document.getElementById('stopInductionBtn').addEventListener('click', () => {
            this.stopInduction();
        });
        
        document.getElementById('recordSnapshotBtn').addEventListener('click', () => {
            this.recordSnapshot();
        });
        
        // Induction dose sliders
        this.setupInductionSliders();
        
        // Protocol panel
        document.getElementById('optimizeProtocolBtn').addEventListener('click', () => {
            this.optimizeProtocol();
        });
        
        // Monitoring panel
        document.getElementById('addDoseBtn').addEventListener('click', () => {
            this.showDoseModal();
        });
        
        document.getElementById('runSimulationBtn').addEventListener('click', () => {
            this.runMonitoringSimulation();
        });
        
        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportCsv();
        });
        
        // Dose modal
        document.getElementById('closeDoseModal').addEventListener('click', () => {
            this.hideDoseModal();
        });
        
        document.getElementById('cancelDoseAdd').addEventListener('click', () => {
            this.hideDoseModal();
        });
        
        document.getElementById('doseForm').addEventListener('submit', (e) => {
            this.addDoseEvent(e);
        });
        
        // Dose form sliders
        this.setupDoseFormSliders();
        
        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    setupPatientFormSliders() {
        const ageSlider = document.getElementById('editAge');
        const weightSlider = document.getElementById('editWeight');
        const heightSlider = document.getElementById('editHeight');
        
        ageSlider.addEventListener('input', (e) => {
            document.getElementById('ageValue').textContent = e.target.value;
            this.updateBMICalculation();
        });
        
        weightSlider.addEventListener('input', (e) => {
            document.getElementById('weightValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateBMICalculation();
        });
        
        heightSlider.addEventListener('input', (e) => {
            document.getElementById('heightValue').textContent = e.target.value;
            this.updateBMICalculation();
        });
    }

    setupInductionSliders() {
        const bolusSlider = document.getElementById('inductionBolus');
        const continuousSlider = document.getElementById('inductionContinuous');
        
        bolusSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('inductionBolusValue').textContent = value.toFixed(1);
            if (this.appState.isInductionRunning) {
                this.inductionEngine.updateDose(value, parseFloat(continuousSlider.value));
            }
        });
        
        continuousSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('inductionContinuousValue').textContent = value.toFixed(1);
            if (this.appState.isInductionRunning) {
                this.inductionEngine.updateDose(parseFloat(bolusSlider.value), value);
            }
        });
    }

    setupDoseFormSliders() {
        const bolusSlider = document.getElementById('doseBolusAmount');
        const continuousSlider = document.getElementById('doseContinuousRate');
        
        bolusSlider.addEventListener('input', (e) => {
            document.getElementById('doseBolusValue').textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        continuousSlider.addEventListener('input', (e) => {
            document.getElementById('doseContinuousValue').textContent = parseFloat(e.target.value).toFixed(2);
        });
    }

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

    // Modal management
    hideDisclaimer() {
        document.getElementById('disclaimerModal').classList.remove('active');
        document.getElementById('mainApp').classList.remove('hidden');
    }

    showPatientModal() {
        const modal = document.getElementById('patientModal');
        
        // Populate form with current patient data
        const patient = this.appState.patient;
        document.getElementById('editPatientId').value = patient.id;
        document.getElementById('editAge').value = patient.age;
        document.getElementById('editWeight').value = patient.weight;
        document.getElementById('editHeight').value = patient.height;
        document.querySelector(`input[name="sex"][value="${patient.sex === SexType.MALE ? 'male' : 'female'}"]`).checked = true;
        document.querySelector(`input[name="asa"][value="${patient.asaPS === AsapsType.CLASS_1_2 ? '1-2' : '3-4'}"]`).checked = true;
        document.querySelector(`input[name="opioid"][value="${patient.opioidCoadmin === OpioidType.YES ? 'yes' : 'no'}"]`).checked = true;
        document.getElementById('editAnesthesiaStart').value = patient.formattedStartTime;
        
        // Update display values
        document.getElementById('ageValue').textContent = patient.age;
        document.getElementById('weightValue').textContent = patient.weight.toFixed(1);
        document.getElementById('heightValue').textContent = patient.height;
        this.updateBMICalculation();
        
        modal.classList.add('active');
    }

    hidePatientModal() {
        document.getElementById('patientModal').classList.remove('active');
    }

    showDoseModal() {
        const modal = document.getElementById('doseModal');
        
        // Reset form
        document.getElementById('doseTime').value = this.appState.patient.formattedStartTime;
        document.getElementById('doseBolusAmount').value = 0;
        document.getElementById('doseContinuousRate').value = 0;
        document.getElementById('doseBolusValue').textContent = '0.0';
        document.getElementById('doseContinuousValue').textContent = '0.00';
        document.getElementById('anesthesiaStartReference').textContent = this.appState.patient.formattedStartTime;
        
        modal.classList.add('active');
    }

    hideDoseModal() {
        document.getElementById('doseModal').classList.remove('active');
    }

    // Data management
    savePatientData(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        // Parse time
        const timeValue = document.getElementById('editAnesthesiaStart').value;
        const anesthesiaStart = new Date(this.appState.patient.anesthesiaStartTime);
        const [hours, minutes] = timeValue.split(':').map(Number);
        anesthesiaStart.setHours(hours, minutes, 0, 0);
        
        // Update patient
        this.appState.patient.id = document.getElementById('editPatientId').value;
        this.appState.patient.age = parseInt(document.getElementById('editAge').value);
        this.appState.patient.weight = parseFloat(document.getElementById('editWeight').value);
        this.appState.patient.height = parseFloat(document.getElementById('editHeight').value);
        this.appState.patient.sex = formData.get('sex') === 'male' ? SexType.MALE : SexType.FEMALE;
        this.appState.patient.asaPS = formData.get('asa') === '1-2' ? AsapsType.CLASS_1_2 : AsapsType.CLASS_3_4;
        this.appState.patient.opioidCoadmin = formData.get('opioid') === 'yes' ? OpioidType.YES : OpioidType.NO;
        this.appState.patient.anesthesiaStartTime = anesthesiaStart;
        
        // Validate patient data
        const validation = this.appState.patient.validate();
        if (!validation.isValid) {
            alert('Input Error:\n' + validation.errors.join('\n'));
            return;
        }
        
        // Update engines with new patient data
        this.protocolEngine.setPatient(this.appState.patient);
        this.advancedProtocolEngine.setPatient(this.appState.patient);
        this.monitoringEngine.setPatient(this.appState.patient);
        
        this.updatePatientDisplay();
        this.hidePatientModal();
        
        console.log('Patient data updated:', this.appState.patient.id);
    }

    addDoseEvent(e) {
        e.preventDefault();
        
        const timeValue = document.getElementById('doseTime').value;
        const bolusAmount = parseFloat(document.getElementById('doseBolusAmount').value);
        const continuousRate = parseFloat(document.getElementById('doseContinuousRate').value);
        
        // Calculate minutes from anesthesia start
        const doseTime = new Date(this.appState.patient.anesthesiaStartTime);
        const [hours, minutes] = timeValue.split(':').map(Number);
        doseTime.setHours(hours, minutes, 0, 0);
        
        let minutesFromStart = this.appState.patient.clockTimeToMinutes(doseTime);
        
        // Handle day crossing
        if (minutesFromStart < 0) {
            minutesFromStart += 1440; // Add 24 hours
        }
        
        minutesFromStart = Math.max(0, Math.round(minutesFromStart));
        
        const doseEvent = new DoseEvent(minutesFromStart, bolusAmount, continuousRate);
        
        // Validate dose event
        const validation = doseEvent.validate();
        if (!validation.isValid) {
            alert('Input Error:\n' + validation.errors.join('\n'));
            return;
        }
        
        this.monitoringEngine.addDoseEvent(doseEvent);
        this.updateMonitoringDisplay();
        this.hideDoseModal();
        
        console.log('Dose event added:', doseEvent);
    }

    // Induction management
    startInduction() {
        const bolusDose = parseFloat(document.getElementById('inductionBolus').value);
        const continuousDose = parseFloat(document.getElementById('inductionContinuous').value);
        
        if (this.inductionEngine.start(this.appState.patient, bolusDose, continuousDose)) {
            this.appState.isInductionRunning = true;
            this.updateInductionControls();
            
            // Clear the realtime chart when starting new induction
            if (this.realtimeChart) {
                this.realtimeChart.clear();
            }
            
            console.log('Induction started');
        }
    }

    stopInduction() {
        if (this.inductionEngine.stop()) {
            this.appState.isInductionRunning = false;
            this.updateInductionControls();
            console.log('Induction stopped');
        }
    }

    recordSnapshot() {
        const snapshot = this.inductionEngine.takeSnapshot();
        if (snapshot) {
            this.updateSnapshotsDisplay();
            console.log('Snapshot recorded');
        }
    }

    // Advanced Protocol optimization
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
            
            this.appState.protocolResult = result;
            this.updateAdvancedProtocolDisplay(result);
            console.log('Advanced Protocol optimization completed');
        } catch (error) {
            console.error('Protocol optimization failed:', error);
            alert('An error occurred during protocol optimization:\n' + error.message);
        }
    }

    // Monitoring simulation
    runMonitoringSimulation() {
        try {
            const result = this.monitoringEngine.runSimulation();
            this.appState.simulationResult = result;
            this.updateMonitoringResults(result);
            console.log('Monitoring simulation completed');
        } catch (error) {
            console.error('Monitoring simulation failed:', error);
            alert('An error occurred during simulation execution:\n' + error.message);
        }
    }

    // CSV export
    exportCsv() {
        try {
            const csvContent = this.monitoringEngine.exportToCSV();
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            // Generate filename
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().substring(0, 5).replace(':', '-');
            const patientId = this.appState.patient.id.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `${patientId}_${dateStr}_${timeStr}.csv`;
            
            // Create download link
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
                console.log('CSV exported:', filename);
            } else {
                alert('CSV download is not supported in your browser.');
            }
        } catch (error) {
            console.error('CSV export failed:', error);
            alert('An error occurred during CSV export:\n' + error.message);
        }
    }

    // Display updates
    updatePatientDisplay() {
        const patient = this.appState.patient;
        document.getElementById('patientId').textContent = patient.id;
        document.getElementById('patientAge').textContent = `${patient.age} years`;
        document.getElementById('patientWeight').textContent = `${patient.weight.toFixed(1)} kg`;
        document.getElementById('patientHeight').textContent = `${patient.height.toFixed(0)} cm`;
        document.getElementById('patientBMI').textContent = patient.bmi.toFixed(1);
        document.getElementById('patientSex').textContent = SexType.displayName(patient.sex);
        document.getElementById('patientASA').textContent = AsapsType.displayName(patient.asaPS);
        document.getElementById('patientOpioid').textContent = OpioidType.displayName(patient.opioidCoadmin);
        document.getElementById('anesthesiaStartTime').textContent = patient.formattedStartTime;
    }

    updateBMICalculation() {
        const weight = parseFloat(document.getElementById('editWeight').value);
        const height = parseFloat(document.getElementById('editHeight').value);
        const bmi = weight / Math.pow(height / 100, 2);
        document.getElementById('bmiCalculated').textContent = bmi.toFixed(1);
    }

    updateInductionDisplay(state) {
        document.getElementById('plasmaConcentration').textContent = state.plasmaConcentration.toFixed(3);
        document.getElementById('effectConcentration').textContent = state.effectSiteConcentration.toFixed(3);
        document.getElementById('inductionBISValue').textContent = state.bisValue.toFixed(1);
        document.getElementById('elapsedTime').textContent = state.elapsedTimeString;
        
        if (state.snapshots.length > 0) {
            this.updateSnapshotsDisplay();
        }
    }

    updateRealtimeChart(state) {
        if (this.realtimeChart && state.isRunning) {
            this.realtimeChart.addDataPoint(
                state.elapsedTime,
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
                        <span>Plasma: ${snapshot.plasmaConcentration.toFixed(3)} μg/mL</span>
                        <span>Effect-site: ${snapshot.effectSiteConcentration.toFixed(3)} μg/mL</span>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            section.classList.add('hidden');
        }
    }

    updateAdvancedProtocolDisplay(result) {
        document.getElementById('protocolResults').classList.remove('hidden');
        document.getElementById('optimalRate').textContent = result.optimization.optimalRate.toFixed(2);
        
        // Display final Ce from time series data (end of simulation)
        const finalCe = result.protocol.timeSeriesData[result.protocol.timeSeriesData.length - 1].ce;
        document.getElementById('predictedFinalCe').textContent = finalCe.toFixed(3);
        
        // Update advanced metrics
        document.getElementById('targetAccuracy').textContent = result.performance.targetAccuracy.toFixed(1);
        document.getElementById('adjustmentCount').textContent = result.performance.totalAdjustments;
        document.getElementById('stabilityIndex').textContent = result.performance.stabilityIndex.toFixed(1);
        document.getElementById('convergenceTime').textContent = 
            result.performance.convergenceTime === Infinity ? '∞' : result.performance.convergenceTime.toFixed(1);
        
        // Update chart
        this.updateAdvancedProtocolChart(result);
        
        // Update schedule table
        this.updateProtocolTable(result.schedule);
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

    updateMonitoringResults(result) {
        document.getElementById('simulationResults').classList.remove('hidden');
        document.getElementById('maxPlasmaConc').textContent = result.maxPlasmaConcentration.toFixed(3);
        document.getElementById('maxEffectConc').textContent = result.maxEffectSiteConcentration.toFixed(3);
        document.getElementById('minBISValue').textContent = result.minBISValue ? result.minBISValue.toFixed(1) : '---';
        document.getElementById('calculationMethod').textContent = result.calculationMethod;
        
        // Update monitoring chart
        this.updateMonitoringChart(result);
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
        
        if (event.bolusMg > 0 || event.continuousMgHr > 0) {
            if (event.bolusMg > 0) {
                const bolusSpan = document.createElement('span');
                bolusSpan.textContent = `Bolus: ${event.bolusMg.toFixed(1)} mg`;
                details.appendChild(bolusSpan);
            }
            
            if (event.continuousMgHr > 0) {
                const continuousSpan = document.createElement('span');
                continuousSpan.textContent = `Continuous: ${event.continuousMgHr.toFixed(0)} mg/hr`;
                details.appendChild(continuousSpan);
            }
        } else {
            const stopSpan = document.createElement('span');
            stopSpan.textContent = 'Infusion Stopped';
            stopSpan.className = 'dose-stop';
            details.appendChild(stopSpan);
        }
        
        infoDiv.appendChild(title);
        infoDiv.appendChild(details);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-dose';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.addEventListener('click', () => {
            this.monitoringEngine.removeDoseEvent(index);
            this.updateMonitoringDisplay();
        });
        
        div.appendChild(infoDiv);
        div.appendChild(deleteBtn);
        
        return div;
    }

    updateAdvancedProtocolChart(result) {
        const ctx = document.getElementById('protocolChart').getContext('2d');
        
        if (this.protocolChart) {
            this.protocolChart.destroy();
        }
        
        const chartData = this.advancedProtocolEngine.getChartData();
        if (!chartData) return;
        
        this.protocolChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.times.map(t => {
                    const clockTime = this.appState.patient.minutesToClockTime(t);
                    return clockTime.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                }),
                datasets: [
                    {
                        label: 'Plasma Concentration',
                        data: chartData.plasmaConcentrations,
                        borderColor: 'rgba(0, 122, 255, 1)',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Effect-site Concentration',
                        data: chartData.effectSiteConcentrations,
                        borderColor: 'rgba(52, 199, 89, 1)',
                        backgroundColor: 'rgba(52, 199, 89, 0.1)',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Target Concentration',
                        data: chartData.targetLine,
                        borderColor: 'rgba(255, 59, 48, 0.8)',
                        backgroundColor: 'rgba(255, 59, 48, 0.1)',
                        fill: false,
                        borderDash: [5, 5],
                        tension: 0,
                        pointRadius: 0
                    },
                    {
                        label: 'Upper Threshold',
                        data: chartData.upperThresholdLine,
                        borderColor: 'rgba(255, 149, 0, 0.8)',
                        backgroundColor: 'rgba(255, 149, 0, 0.1)',
                        fill: false,
                        borderDash: [2, 2],
                        tension: 0,
                        pointRadius: 0
                    },
                    {
                        label: 'Infusion Rate (mg/hr)',
                        data: chartData.infusionRates,
                        borderColor: 'rgba(88, 86, 214, 1)',
                        backgroundColor: 'rgba(88, 86, 214, 0.1)',
                        fill: false,
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Concentration (μg/mL)'
                        },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Infusion Rate (mg/hr)'
                        },
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                plugins: {
                    annotation: {
                        annotations: chartData.adjustmentTimes.map((time, index) => ({
                            type: 'line',
                            mode: 'vertical',
                            scaleID: 'x',
                            value: time,
                            borderColor: 'rgba(255, 59, 48, 0.7)',
                            borderWidth: 2,
                            label: {
                                content: `Step-down ${chartData.adjustmentLabels[index]}`,
                                enabled: true,
                                position: 'top'
                            }
                        }))
                    }
                }
            }
        });
    }

    updateMonitoringChart(result) {
        const ctx = document.getElementById('monitoringChart').getContext('2d');
        
        if (this.monitoringChart) {
            this.monitoringChart.destroy();
        }
        
        const chartData = this.monitoringEngine.getChartData();
        if (!chartData) return;
        
        this.monitoringChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Plasma Concentration',
                        data: chartData.plasmaData,
                        borderColor: 'rgba(0, 122, 255, 1)',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        fill: false,
                        tension: 0.1,
                        pointRadius: 1
                    },
                    {
                        label: 'Effect-site Concentration',
                        data: chartData.effectData,
                        borderColor: 'rgba(52, 199, 89, 1)',
                        backgroundColor: 'rgba(52, 199, 89, 0.1)',
                        fill: false,
                        tension: 0.1,
                        pointRadius: 1
                    },
                    {
                        label: 'BIS値',
                        data: chartData.bisData,
                        borderColor: 'rgba(255, 59, 48, 1)',
                        backgroundColor: 'rgba(255, 59, 48, 0.1)',
                        fill: false,
                        tension: 0.1,
                        pointRadius: 1,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'BIS 60 (Mild Sedation)',
                        data: chartData.labels.map(() => 60),
                        borderColor: 'rgba(255, 149, 0, 0.8)',
                        backgroundColor: 'rgba(255, 149, 0, 0.1)',
                        fill: false,
                        borderDash: [5, 5],
                        tension: 0,
                        pointRadius: 0,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'BIS 40 (Deep Sedation)',
                        data: chartData.labels.map(() => 40),
                        borderColor: 'rgba(255, 59, 48, 0.8)',
                        backgroundColor: 'rgba(255, 59, 48, 0.1)',
                        fill: false,
                        borderDash: [2, 2],
                        tension: 0,
                        pointRadius: 0,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Concentration (μg/mL)'
                        },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'BIS値'
                        },
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    updateProtocolTable(schedule) {
        const container = document.getElementById('protocolTable');
        container.innerHTML = '';
        
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Dose</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        schedule.forEach(item => {
            const row = document.createElement('tr');
            // Fix: Properly display dose or rate, avoiding '-' fallback for dose
            const doseOrRate = (item.dose && item.dose !== '-') ? item.dose : 
                              (item.rate && item.rate !== '-') ? item.rate : '-';
            row.innerHTML = `
                <td>${item.time} min</td>
                <td>${item.action}</td>
                <td>${doseOrRate}</td>
                <td>${item.comment}</td>
            `;
            tbody.appendChild(row);
        });
        
        container.appendChild(table);
    }

    updateAllPanelStates() {
        this.updateInductionControls();
        this.updateMonitoringDisplay();
    }
}

// Initialize application when script loads
const app = new MainApplicationController();

// Export for global access
if (typeof window !== 'undefined') {
    window.app = app;
}