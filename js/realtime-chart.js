/**
 * Realtime Chart for Induction Engine
 * Real-time visualization of effect-site concentration and BIS values
 * 
 * Features:
 * - Dual-axis chart (Ce and BIS)
 * - High-performance real-time updates
 * - Memory management with data point limits
 * - Optimized for continuous updates
 */

class RealtimeChart {
    constructor(canvasId, maxDataPoints = 300) {
        this.maxDataPoints = maxDataPoints;
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas with id '${canvasId}' not found`);
        }
        
        this.initChart();
    }

    initChart() {
        this.chart = new Chart(this.canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Effect-site Concentration',
                    data: [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                }, {
                    label: 'BIS Value',
                    data: [],
                    borderColor: '#FFC107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0  // Disable animations for real-time updates
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Real-time Effect-site Concentration & BIS Value',
                        color: '#a0a0a0',
                        font: { size: 12 }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { color: '#a0a0a0', boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#333',
                        titleColor: '#fff',
                        bodyColor: '#e0e0e0',
                        borderColor: '#4a4a4a',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y') {
                                    label += context.parsed.y.toFixed(3) + ' μg/mL';
                                } else {
                                    label += context.parsed.y.toFixed(1);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Time (seconds)',
                            color: '#a0a0a0'
                        },
                        ticks: {
                            color: '#a0a0a0',
                            callback: function(value) {
                                // Convert seconds to MM:SS format
                                const minutes = Math.floor(value / 60);
                                const seconds = Math.floor(value % 60);
                                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.08)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Effect-site Concentration (μg/mL)',
                            color: '#a0a0a0'
                        },
                        beginAtZero: true,
                        ticks: { color: '#a0a0a0' },
                        grid: {
                            drawOnChartArea: true,
                            color: 'rgba(255,255,255,0.08)',
                        },
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'BIS Value',
                            color: '#a0a0a0'
                        },
                        min: 0,
                        max: 100,
                        ticks: { color: '#a0a0a0' },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    addDataPoint(elapsedTime, ceValue, bisValue) {
        const chart = this.chart;
        
        // Add new data point
        chart.data.labels.push(elapsedTime);
        chart.data.datasets[0].data.push(ceValue);
        chart.data.datasets[1].data.push(bisValue);
        
        // Remove old data points if we exceed the limit
        if (chart.data.labels.length > this.maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
        
        // Update chart without animation for performance
        chart.update('none');
    }

    clear() {
        this.chart.data.labels = [];
        this.chart.data.datasets[0].data = [];
        this.chart.data.datasets[1].data = [];
        this.chart.update('none');
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    resize() {
        if (this.chart) {
            this.chart.resize();
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.RealtimeChart = RealtimeChart;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RealtimeChart };
}