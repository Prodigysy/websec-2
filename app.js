document.addEventListener("DOMContentLoaded", async () => {
    let weatherChart = null; 
    let markersData = [];
    let currentApiData = null;
    let currentMapStyle = 'default';

    const bodyEl = document.body;
    const themeToggleBtn = document.getElementById('theme-toggle');
    const moonIcon = themeToggleBtn?.querySelector('.moon-icon');
    const sunIcon = themeToggleBtn?.querySelector('.sun-icon');
    const sidebar = document.getElementById('weather-sidebar');
    const sidebarTitle = document.getElementById('sidebar-city-name');
    const geoBtn = document.getElementById('geo-btn');
    const searchInput = document.getElementById('city-search');
    
    const ui = {
        temp: document.getElementById('current-temp'),
        icon: document.getElementById('current-icon'),
        humidity: document.getElementById('current-humidity'),
        wind: document.getElementById('current-wind'),
        pressure: document.getElementById('current-pressure')
    };

    const API_BASE_URL = "https://api.open-meteo.com/v1/forecast";

    const mapLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }),
        light: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 18 }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
        topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 })
    };

    const map = L.map('map', { zoomControl: false }).setView([55.0, 50.0], 4);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    let activeLayer = null;

    function setMapLayer(layer) {
        if (activeLayer) map.removeLayer(activeLayer);
        layer.addTo(map);
        activeLayer = layer;
    }

    function updateThemeIcons() {
        if (!moonIcon || !sunIcon) return;
        const isLight = bodyEl.classList.contains('light-theme');
        moonIcon.classList.toggle('hidden', isLight);
        sunIcon.classList.toggle('hidden', !isLight);
    }

    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    if (savedTheme === 'light') {
        bodyEl.classList.add('light-theme');
        setMapLayer(mapLayers.light);
    } else {
        setMapLayer(mapLayers.dark);
    }
    updateThemeIcons();

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLight = bodyEl.classList.toggle('light-theme');
            localStorage.setItem('app-theme', isLight ? 'light' : 'dark');
            
            if (currentMapStyle === 'default') {
                setMapLayer(isLight ? mapLayers.light : mapLayers.dark);
            }
            updateThemeIcons(); 

            if (weatherChart && currentApiData) {
                renderNeonChart(currentApiData, getThemeColors());
            }
        });
    }

    document.querySelectorAll('#layer-controls button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#layer-controls button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentMapStyle = e.target.dataset.layer;
            if (currentMapStyle === 'default') {
                setMapLayer(bodyEl.classList.contains('light-theme') ? mapLayers.light : mapLayers.dark);
            } else {
                setMapLayer(mapLayers[currentMapStyle]);
            }
        });
    });

    document.getElementById('close-sidebar')?.addEventListener('click', () => {
        sidebar.classList.add('hidden');
    });

    if (geoBtn) {
        geoBtn.addEventListener('click', () => {
            if ("geolocation" in navigator) {
                geoBtn.style.opacity = '0.5';
                navigator.geolocation.getCurrentPosition(pos => {
                    const { latitude, longitude } = pos.coords;
                    map.flyTo([latitude, longitude], 11, { animate: true, duration: 1.5 });
                    openWeatherSidebar(latitude, longitude, "МОЯ ЛОКАЦИЯ");
                    geoBtn.style.opacity = '1';
                }, () => {
                    alert("Доступ к геолокации запрещен.");
                    geoBtn.style.opacity = '1';
                });
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length > 2) {
                const found = markersData.find(c => c.name.includes(query));
                if (found) {
                    map.flyTo([found.lat, found.lon], 10, { animate: true, duration: 1.5 });
                    found.marker.openTooltip();
                }
            }
        });
    }

    try {
        const response = await fetch('cities.json');
        if (response.ok) {
            const data = await response.json();
            data.forEach(city => {
                const marker = L.marker([city.lat, city.lon]).addTo(map);
                marker.bindTooltip(city.name);
                
                markersData.push({
                    name: String(city.name).toLowerCase().trim(),
                    lat: city.lat, lon: city.lon, marker: marker
                });

                marker.on('click', () => openWeatherSidebar(city.lat, city.lon, city.name));
            });
        }
    } catch (error) {
        console.error("Ошибка загрузки городов:", error);
    }

    function getWeatherIcon(code) {
        const icons = {
            0: '☀️', 
            1: '🌤️', 2: '⛅', 3: '☁️', 
            45: '🌫️', 48: '🌫️', 
            51: '🌧️', 53: '🌧️', 55: '🌧️', 
            56: '🌧️', 57: '🌧️', 
            61: '🌧️', 63: '🌧️', 65: '🌧️', 
            66: '🌧️', 67: '🌧️', 
            71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
            80: '🌦️', 81: '🌦️', 82: '🌦️', 
            85: '🌨️', 86: '🌨️',
            95: '⚡', 96: '⛈️', 99: '⛈️' 
        };
        return icons[code] || '❓';
    }

    async function openWeatherSidebar(lat, lon, cityName) {
        sidebarTitle.innerText = `LOADING//${cityName.toUpperCase()}`;
        sidebar.classList.remove('hidden');

        try {
            const url = `${API_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,windspeed_10m&current_weather=true&hourly=relativehumidity_2m,surface_pressure&timezone=auto&forecast_days=2`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('API_ERR');
            
            const apiData = await response.json();
            currentApiData = apiData; 
            
            sidebarTitle.innerText = `STATUS//${cityName.toUpperCase()}`;

            const current = apiData.current_weather;
            ui.temp.innerText = `${Math.round(current.temperature)}°`;
            ui.icon.innerText = getWeatherIcon(current.weathercode);
            ui.wind.innerText = `${Math.round(current.windspeed)} КМ/Ч`;
            ui.humidity.innerText = `${apiData.hourly.relativehumidity_2m[0]}%`;
            ui.pressure.innerText = `${Math.round(apiData.hourly.surface_pressure[0] * 0.75006)} ММ`;

            const graphData = {
                labels: apiData.hourly.time.slice(0, 24).map(t => t.slice(-5)),
                temperatures: apiData.hourly.temperature_2m.slice(0, 24),
                rains: apiData.hourly.precipitation.slice(0, 24),
                winds: apiData.hourly.windspeed_10m.slice(0, 24)
            };

            renderNeonChart(graphData, getThemeColors());
        } catch (error) {
            sidebarTitle.innerText = `ERROR//CONNECTION_FAILED`;
        }
    }

    function getThemeColors() {
        const root = document.body;
        return {
            tempColor: getComputedStyle(root).getPropertyValue('--neon-red').trim(),
            rainColor: getComputedStyle(root).getPropertyValue('--neon-green').trim(),
            windColor: getComputedStyle(root).getPropertyValue('--neon-blue').trim(),
            gridColor: getComputedStyle(root).getPropertyValue('--border-glass').trim(),
            textColor: getComputedStyle(root).getPropertyValue('--text-muted').trim(),
            tooltipBg: getComputedStyle(root).getPropertyValue('--bg-panel').trim()
        };
    }

    function renderNeonChart(data, colors) {
        const ctx = document.getElementById('weatherChart').getContext('2d');
        if (weatherChart) weatherChart.destroy();

        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = colors.textColor;

        weatherChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'ТЕМПЕРАТУРА (°C)',
                        data: data.temperatures,
                        borderColor: colors.tempColor,
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderWidth: 2, yAxisID: 'y', tension: 0.4, fill: true,
                        pointBackgroundColor: colors.tempColor, pointRadius: 2
                    },
                    {
                        label: 'ОСАДКИ (ММ)',
                        data: data.rains,
                        borderColor: colors.rainColor,
                        backgroundColor: 'rgba(57, 255, 20, 0.4)',
                        yAxisID: 'y1', type: 'bar', borderRadius: 3
                    },
                    {
                        label: 'ВЕТЕР (КМ/Ч)',
                        data: data.winds,
                        borderColor: colors.windColor,
                        yAxisID: 'y2', tension: 0.4, borderDash: [5, 5],
                        pointRadius: 0, borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, family: "'Roboto Mono', monospace" }, padding: 10 } },
                    tooltip: {
                        backgroundColor: colors.tooltipBg, titleColor: colors.textColor, bodyColor: colors.textColor,
                        backdropFilter: 'blur(10px)', titleFont: { family: "'Roboto Mono', monospace" }, bodyFont: { family: "'Inter', sans-serif" },
                        borderColor: colors.gridColor, borderWidth: 1, padding: 10, cornerRadius: 6
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '°C', color: colors.tempColor, font: { weight: 'bold', size: 10 } }, grid: { color: colors.gridColor } },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'ММ', color: colors.rainColor, font: { weight: 'bold', size: 10 } }, grid: { drawOnChartArea: false }, min: 0, suggestedMax: 3 },
                    y2: { type: 'linear', display: false, min: 0 }
                }
            }
        });
    }
});