// static/js/admin/admin_dashboard.js

let revenueChartInstance = null;
let statusChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    
    const fetchAnalytics = async (timeframe = 'monthly') => {
        try {
            const res = await fetch(`/api/store/admin/analytics/?timeframe=${timeframe}`);
            const data = await res.json();

            // 1. Update Top Metric Cards
            document.getElementById('metricRevenue').innerText = `KSh ${parseFloat(data.metrics.revenue).toLocaleString()}`;
            document.getElementById('metricOrders').innerText = data.metrics.orders;
            document.getElementById('metricUsers').innerText = data.metrics.users;
            document.getElementById('metricTopProduct').innerText = data.metrics.top_product;

            // 2. Render Revenue Line Chart
            const revCtx = document.getElementById('revenueChart').getContext('2d');
            if (revenueChartInstance) revenueChartInstance.destroy();
            
            revenueChartInstance = new Chart(revCtx, {
                type: 'line',
                data: {
                    labels: data.charts.revenue_labels,
                    datasets: [{
                        label: 'Revenue (KSh)',
                        data: data.charts.revenue_data,
                        borderColor: '#c3a37a', // Afrostreet Khaki
                        backgroundColor: 'rgba(195, 163, 122, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3 // Smooth curves
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });

            // 3. Render Order Status Doughnut Chart
            const statCtx = document.getElementById('statusChart').getContext('2d');
            if (statusChartInstance) statusChartInstance.destroy();
            
            statusChartInstance = new Chart(statCtx, {
                type: 'doughnut',
                data: {
                    labels: data.charts.status_labels,
                    datasets: [{
                        data: data.charts.status_data,
                        backgroundColor: ['#f1c40f', '#3498db', '#2ecc71', '#95a5a6', '#e74c3c'], // Warning, Primary, Success, Secondary, Danger
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });

        } catch (error) {
            console.error("Failed to fetch analytics", error);
        }
    };

    // Initial Load
    fetchAnalytics('monthly');

    // Handle Timeframe Radio Buttons
    const timeframeRadios = document.querySelectorAll('input[name="timeframe"]');
    timeframeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            fetchAnalytics(e.target.value);
        });
    });

    // Handle PDF Export
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        // Find which radio is checked
        const selectedTimeframe = document.querySelector('input[name="timeframe"]:checked').value;
        // Trigger file download via window.location
        window.location.href = `/api/store/admin/analytics/export/pdf/?timeframe=${selectedTimeframe}`;
    });
});