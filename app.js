document.addEventListener("DOMContentLoaded", async () => {
    let weatherChart = null; 
    let markersData = [];
    let currentApiData = null;
    let currentCityName = "";
    let currentMapStyle = 'default';

    const darkMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO',
        maxZoom: 18
    });

    const lightMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO',
        maxZoom: 18
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 18
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap',
        maxZoom: 17
    });

    const map = L.map('map', { zoomControl: false }).setView([55.0, 50.0], 4);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    let activeLayer = null;

    function setMapLayer(layer) {
        if (activeLayer) map.removeLayer(activeLayer);
        layer.addTo(map);
        activeLayer = layer;
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    const bodyEl = document.body;
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const savedTheme = localStorage.getItem('app-theme');
    
    function updateThemeIcons() {
        if (bodyEl.classList.contains('light-theme')) {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    }

    if (savedTheme === 'light') {
        bodyEl.classList.add('light-theme');
        setMapLayer(lightMapLayer);
    } else {
        setMapLayer(darkMapLayer);
    }
    updateThemeIcons(); 

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            if (bodyEl.classList.contains('light-theme')) {
                bodyEl.classList.remove('light-theme');
                if (currentMapStyle === 'default') setMapLayer(darkMapLayer);
                localStorage.setItem('app-theme', 'dark');
            } else {
                bodyEl.classList.add('light-theme');
                if (currentMapStyle === 'default') setMapLayer(lightMapLayer);
                localStorage.setItem('app-theme', 'light');
            }
            updateThemeIcons(); 

            if (weatherChart && currentApiData) {
                renderNeonChart(currentApiData, getThemeColors());
            }
        });
    }

    const layerBtns = document.querySelectorAll('#layer-controls button');
    layerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            layerBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const style = e.target.dataset.layer;
            currentMapStyle = style;

            if (style === 'default') {
                setMapLayer(bodyEl.classList.contains('light-theme') ? lightMapLayer : darkMapLayer);
            } else if (style === 'satellite') {
                setMapLayer(satelliteLayer);
            } else if (style === 'topo') {
                setMapLayer(topoLayer);
            }
        });
    });

    const geoBtn = document.getElementById('geo-btn');
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
            } else {
                alert("Ваш браузер не поддерживает геолокацию.");
            }
        });
    }

    function getThemeColors() {
        return {
            tempColor: getComputedStyle(document.body).getPropertyValue('--neon-red').trim(),
            rainColor: getComputedStyle(document.body).getPropertyValue('--neon-green').trim(),
            windColor: getComputedStyle(document.body).getPropertyValue('--neon-blue').trim(),
            gridColor: getComputedStyle(document.body).getPropertyValue('--border-glass').trim(),
            textColor: getComputedStyle(document.body).getPropertyValue('--text-muted').trim(),
            tooltipBg: getComputedStyle(document.body).getPropertyValue('--bg-panel').trim()
        };
    }

    try {
        const response = await fetch('cities.json');
        if (!response.ok) throw new Error('ERR');
        const data = await response.json();

        data.forEach(city => {
            const marker = L.marker([city.lat, city.lon]).addTo(map);
            marker.bindTooltip(city.name);
            
            markersData.push({
                name: String(city.name).toLowerCase().trim(),
                originalName: city.name,
                lat: city.lat,
                lon: city.lon,
                marker: marker
            });

            marker.on('click', () => {
                openWeatherSidebar(city.lat, city.lon, city.name);
            });
        });
    } catch (error) {
        console.error(error);
    }

    const searchInput = document.getElementById('city-search');
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

    const closeSidebarBtn = document.getElementById('close-sidebar');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            document.getElementById('weather-sidebar').classList.add('hidden');
        });
    }

    function getWeatherIcon(code) {
        if (code === 0) return '☀️';
        if (code >= 1 && code <= 3) return '☁️';
        if (code >= 45 && code <= 48) return '🌫️';
        if (code >= 51 && code <= 67) return '🌧️';
        if (code >= 71 && code <= 77) return '❄️';
        if (code >= 80 && code <= 82) return '🌦️';
        if (code >= 85 && code <= 86) return '🌨️';
        if (code >= 95 && code <= 99) return '⚡';
        return '❓';
    }

    async function openWeatherSidebar(lat, lon, cityName) {
        const sidebarTitle = document.getElementById('sidebar-city-name');
        const sidebar = document.getElementById('weather-sidebar');
        const currentTempEl = document.getElementById('current-temp');
        const currentIconEl = document.getElementById('current-icon');
        const currentHumidityEl = document.getElementById('current-humidity');
        const currentWindEl = document.getElementById('current-wind');
        const currentPressureEl = document.getElementById('current-pressure');

        sidebarTitle.innerText = `LOADING//${cityName.toUpperCase()}`;
        sidebar.classList.remove('hidden');

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,windspeed_10m&current_weather=true&hourly=relativehumidity_2m,surface_pressure&timezone=auto&forecast_days=2`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('ERR');
            const apiData = await response.json();
            
            currentApiData = apiData; 
            currentCityName = cityName;

            sidebarTitle.innerText = `STATUS//${cityName.toUpperCase()}`;

            const current = apiData.current_weather;
            
            currentTempEl.innerText = `${round(current.temperature)}°`;
            currentIconEl.innerText = getWeatherIcon(current.weathercode);
            currentWindEl.innerText = `${round(current.windspeed)} КМ/Ч`;
            currentHumidityEl.innerText = `${apiData.hourly.relativehumidity_2m[0]}%`;
            const pressureHpa = apiData.hourly.surface_pressure[0];
            currentPressureEl.innerText = `${round(pressureHpa * 0.75006)} ММ`;

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

    function round(val) { return Math.round(val); }

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
                        borderWidth: 2,
                        yAxisID: 'y',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: colors.tempColor,
                        pointRadius: 2
                    },
                    {
                        label: 'ОСАДКИ (ММ)',
                        data: data.rains,
                        borderColor: colors.rainColor,
                        backgroundColor: 'rgba(57, 255, 20, 0.4)',
                        yAxisID: 'y1',
                        type: 'bar',
                        borderRadius: 3
                    },
                    {
                        label: 'ВЕТЕР (КМ/Ч)',
                        data: data.winds,
                        borderColor: colors.windColor,
                        yAxisID: 'y2',
                        tension: 0.4,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            font: { size: 9, family: "'Roboto Mono', monospace" },
                            padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.textColor,
                        bodyColor: colors.textColor,
                        backdropFilter: 'blur(10px)',
                        titleFont: { family: "'Roboto Mono', monospace" },
                        bodyFont: { family: "'Inter', sans-serif" },
                        borderColor: colors.gridColor,
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 6
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 9 } }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: '°C', color: colors.tempColor, font: { weight: 'bold', size: 10 } },
                        grid: { color: colors.gridColor }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'ММ', color: colors.rainColor, font: { weight: 'bold', size: 10 } },
                        grid: { drawOnChartArea: false },
                        min: 0,
                        suggestedMax: 3
                    },
                    y2: { type: 'linear', display: false, min: 0 }
                }
            }
        });
    }
});