/**
 * AETHER // FUTURISTIC CLIMATE RADAR ENGINE
 * Real-time meteorological telemetry, multi-cycle forecasts & cyber-HUD controls
 */

// Configuration & State
const CONFIG = {
    API_KEY: '7329e0664c8241f23faf58ea1969d2a9',
    CURRENT_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    DEFAULT_CITY: 'Tokyo',
    MAX_HISTORY: 6,
    HISTORY_KEY: 'aether_weather_history',
    UNIT_KEY: 'aether_weather_unit',
    SOUND_KEY: 'aether_sound_enabled'
};

const state = {
    currentUnit: localStorage.getItem(CONFIG.UNIT_KEY) || 'metric', // 'metric' (°C) or 'imperial' (°F)
    soundEnabled: localStorage.getItem(CONFIG.SOUND_KEY) !== 'false',
    currentWeatherData: null,
    forecastData: null,
    targetTimezoneOffset: 0, // seconds from UTC
    clockInterval: null
};

// DOM Element References
const DOM = {
    cityInput: document.getElementById('cityInput'),
    searchBtn: document.getElementById('searchBtn'),
    geoBtn: document.getElementById('geoBtn'),
    quickChips: document.getElementById('quickChips'),
    statusBanner: document.getElementById('statusBanner'),
    statusIcon: document.getElementById('statusIcon'),
    statusText: document.getElementById('statusText'),
    
    // Header controls
    timeString: document.getElementById('timeString'),
    timezoneBadge: document.getElementById('timezoneBadge'),
    celsiusBtn: document.getElementById('celsiusBtn'),
    fahrenheitBtn: document.getElementById('fahrenheitBtn'),
    soundToggle: document.getElementById('soundToggle'),
    soundIcon: document.getElementById('soundIcon'),
    
    // Hero Weather
    cityName: document.getElementById('cityName'),
    countryCode: document.getElementById('countryCode'),
    coordsDisplay: document.getElementById('coordsDisplay'),
    weatherMain: document.getElementById('weatherMain'),
    currentTemp: document.getElementById('currentTemp'),
    tempUnit: document.getElementById('tempUnit'),
    maxTemp: document.getElementById('maxTemp'),
    minTemp: document.getElementById('minTemp'),
    mainWeatherIcon: document.getElementById('mainWeatherIcon'),
    weatherDesc: document.getElementById('weatherDesc'),
    quickWind: document.getElementById('quickWind'),
    quickHumidity: document.getElementById('quickHumidity'),
    quickFeels: document.getElementById('quickFeels'),
    
    // Telemetry Cards
    windSpeed: document.getElementById('windSpeed'),
    windUnit: document.getElementById('windUnit'),
    windDirection: document.getElementById('windDirection'),
    windGust: document.getElementById('windGust'),
    compassPointer: document.getElementById('compassPointer'),
    humidityVal: document.getElementById('humidityVal'),
    humidityProgress: document.getElementById('humidityProgress'),
    dewPoint: document.getElementById('dewPoint'),
    visibilityVal: document.getElementById('visibilityVal'),
    visibilityStatus: document.getElementById('visibilityStatus'),
    cloudsCoverage: document.getElementById('cloudsCoverage'),
    pressureVal: document.getElementById('pressureVal'),
    seaLevelVal: document.getElementById('seaLevelVal'),
    grndLevelVal: document.getElementById('grndLevelVal'),
    sunriseTime: document.getElementById('sunriseTime'),
    sunsetTime: document.getElementById('sunsetTime'),
    dayProgressFill: document.getElementById('dayProgressFill'),
    sunOrb: document.getElementById('sunOrb'),
    daylightDuration: document.getElementById('daylightDuration'),
    
    // Forecasts & History
    hourlyTimeline: document.getElementById('hourlyTimeline'),
    dailyForecast: document.getElementById('dailyForecast'),
    recentHistoryChips: document.getElementById('recentHistoryChips'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn')
};

// ==========================================================================
// Web Audio Cyber Sound Synthesizer (No external asset files needed)
// ==========================================================================
class CyberAudio {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
    }

    playChime(type = 'scan') {
        if (!state.soundEnabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            const now = this.ctx.currentTime;
            if (type === 'scan') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'success') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
            }
        } catch (_) {
            // Audio policy / unsupported fallback
        }
    }
}
const cyberAudio = new CyberAudio();

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
function init() {
    updateUnitButtons();
    updateSoundButton();
    renderHistoryChips();
    startClock();

    // Search bar events
    DOM.searchBtn.addEventListener('click', handleSearch);
    DOM.cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Geolocation button
    DOM.geoBtn.addEventListener('click', handleGeolocation);

    // Quick city chips
    DOM.quickChips.addEventListener('click', (e) => {
        const city = e.target.getAttribute('data-city');
        if (city) {
            cyberAudio.playChime('scan');
            fetchWeatherData(city);
        }
    });

    // History container
    DOM.recentHistoryChips.addEventListener('click', (e) => {
        const city = e.target.getAttribute('data-city');
        if (city) {
            cyberAudio.playChime('scan');
            fetchWeatherData(city);
        }
    });

    DOM.clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem(CONFIG.HISTORY_KEY);
        renderHistoryChips();
    });

    // Unit toggle buttons
    DOM.celsiusBtn.addEventListener('click', () => setUnit('metric'));
    DOM.fahrenheitBtn.addEventListener('click', () => setUnit('imperial'));

    // Sound toggle
    DOM.soundToggle.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        localStorage.setItem(CONFIG.SOUND_KEY, state.soundEnabled);
        updateSoundButton();
        if (state.soundEnabled) cyberAudio.playChime('scan');
    });

    // Auto-load last city or default city
    const history = getSearchHistory();
    const initialCity = history.length > 0 ? history[0] : CONFIG.DEFAULT_CITY;
    fetchWeatherData(initialCity);
}

// ==========================================================================
// Status Notifications
// ==========================================================================
function showStatus(message, type = 'loading') {
    DOM.statusBanner.className = `status-banner visible ${type}`;
    DOM.statusText.textContent = message;

    if (type === 'loading') {
        DOM.statusIcon.className = 'bx bx-loader-alt bx-spin';
    } else if (type === 'error') {
        DOM.statusIcon.className = 'bx bx-error-circle';
        cyberAudio.playChime('error');
    } else if (type === 'success') {
        DOM.statusIcon.className = 'bx bx-check-circle';
        cyberAudio.playChime('success');
        setTimeout(() => {
            DOM.statusBanner.classList.remove('visible');
        }, 3500);
    }
}

// ==========================================================================
// API Telemetry Acquisition
// ==========================================================================
async function fetchWeatherData(query, isCoords = false) {
    showStatus(`Targeting ${isCoords ? 'coordinates' : query.toUpperCase()} // Initializing orbital scan...`, 'loading');
    
    let weatherUrl, forecastUrl;
    if (isCoords) {
        const { lat, lon } = query;
        weatherUrl = `${CONFIG.CURRENT_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${CONFIG.API_KEY}`;
        forecastUrl = `${CONFIG.FORECAST_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${CONFIG.API_KEY}`;
    } else {
        const cleanQuery = query.trim();
        if (!cleanQuery) return;
        weatherUrl = `${CONFIG.CURRENT_URL}?q=${encodeURIComponent(cleanQuery)}&units=metric&appid=${CONFIG.API_KEY}`;
        forecastUrl = `${CONFIG.FORECAST_URL}?q=${encodeURIComponent(cleanQuery)}&units=metric&appid=${CONFIG.API_KEY}`;
    }

    try {
        const [weatherRes, forecastRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(forecastUrl)
        ]);

        if (!weatherRes.ok) {
            const errData = await weatherRes.json();
            throw new Error(errData.message || 'Target not found in global planetary database.');
        }

        const weatherData = await weatherRes.json();
        const forecastData = forecastRes.ok ? await forecastRes.json() : null;

        state.currentWeatherData = weatherData;
        state.forecastData = forecastData;
        state.targetTimezoneOffset = weatherData.timezone || 0;

        renderAllWeather();
        saveSearchHistory(weatherData.name);
        showStatus(`Telemetry locked: ${weatherData.name}, ${weatherData.sys.country}`, 'success');
        DOM.cityInput.value = '';
    } catch (err) {
        console.error(err);
        showStatus(`SCAN ERROR: ${err.message}`, 'error');
    }
}

function handleSearch() {
    const query = DOM.cityInput.value.trim();
    if (query) {
        cyberAudio.playChime('scan');
        fetchWeatherData(query);
    }
}

function handleGeolocation() {
    if (!navigator.geolocation) {
        showStatus('Geolocation API offline or unsupported by browser.', 'error');
        return;
    }

    cyberAudio.playChime('scan');
    showStatus('Acquiring orbital GPS positioning...', 'loading');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const coords = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            fetchWeatherData(coords, true);
        },
        (error) => {
            let msg = 'GPS Signal acquisition failed.';
            if (error.code === error.PERMISSION_DENIED) {
                msg = 'GPS Position acquisition denied by user.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                msg = 'Location information unavailable.';
            } else if (error.code === error.TIMEOUT) {
                msg = 'GPS request timed out.';
            }
            showStatus(msg, 'error');
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

// ==========================================================================
// Unit System & Conversions
// ==========================================================================
function setUnit(unit) {
    if (state.currentUnit === unit) return;
    state.currentUnit = unit;
    localStorage.setItem(CONFIG.UNIT_KEY, unit);
    updateUnitButtons();
    cyberAudio.playChime('scan');
    if (state.currentWeatherData) {
        renderAllWeather();
    }
}

function updateUnitButtons() {
    if (state.currentUnit === 'metric') {
        DOM.celsiusBtn.classList.add('active');
        DOM.fahrenheitBtn.classList.remove('active');
    } else {
        DOM.celsiusBtn.classList.remove('active');
        DOM.fahrenheitBtn.classList.add('active');
    }
}

function updateSoundButton() {
    DOM.soundIcon.className = state.soundEnabled ? 'bx bx-volume-full' : 'bx bx-volume-mute';
    DOM.soundToggle.style.color = state.soundEnabled ? 'var(--cyan-neon)' : 'var(--text-dim)';
}

function formatTemp(celsiusVal) {
    if (celsiusVal === undefined || celsiusVal === null) return '--';
    if (state.currentUnit === 'imperial') {
        return Math.round((celsiusVal * 9) / 5 + 32);
    }
    return Math.round(celsiusVal);
}

function formatSpeed(mps) {
    // API returns speed in meters/second
    if (state.currentUnit === 'imperial') {
        return {
            value: (mps * 2.23694).toFixed(1),
            unit: 'mph'
        };
    }
    return {
        value: (mps * 3.6).toFixed(1),
        unit: 'km/h'
    };
}

// Weather Code to SVG Icon Mapper
function getWeatherIcon(id, isNight = false) {
    if (id === 800) {
        return 'icons/clear.svg';
    } else if (id >= 200 && id <= 232) {
        return 'icons/storm.svg';
    } else if (id >= 600 && id <= 622) {
        return 'icons/snow.svg';
    } else if (id >= 701 && id <= 781) {
        return 'icons/haze.svg';
    } else if (id >= 801 && id <= 804) {
        return 'icons/cloud.svg';
    } else if ((id >= 500 && id <= 531) || (id >= 300 && id <= 321)) {
        return 'icons/rain.svg';
    }
    return 'icons/clear.svg';
}

function degToCompass(num) {
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[(val % 16)];
}

// ==========================================================================
// Rendering: Hero, Telemetry & Solar Ephemeris
// ==========================================================================
function renderAllWeather() {
    const data = state.currentWeatherData;
    if (!data) return;

    const unitSymbol = state.currentUnit === 'metric' ? '°C' : '°F';
    DOM.tempUnit.textContent = unitSymbol;

    // Hero Section
    DOM.cityName.textContent = data.name;
    DOM.countryCode.textContent = data.sys?.country || '--';
    DOM.coordsDisplay.textContent = `LAT: ${data.coord.lat.toFixed(2)} • LON: ${data.coord.lon.toFixed(2)}`;

    const weather = data.weather[0] || {};
    DOM.weatherMain.textContent = weather.main || 'Clear';
    DOM.weatherDesc.textContent = weather.description || 'Clear sky conditions';

    const currentTempFormatted = formatTemp(data.main.temp);
    DOM.currentTemp.textContent = currentTempFormatted;
    DOM.maxTemp.textContent = `${formatTemp(data.main.temp_max)}${unitSymbol}`;
    DOM.minTemp.textContent = `${formatTemp(data.main.temp_min)}${unitSymbol}`;

    const iconPath = getWeatherIcon(weather.id);
    DOM.mainWeatherIcon.src = iconPath;

    // Quick footer items
    const windInfo = formatSpeed(data.wind.speed);
    DOM.quickWind.textContent = `${windInfo.value} ${windInfo.unit}`;
    DOM.quickHumidity.textContent = `${data.main.humidity}%`;
    DOM.quickFeels.textContent = `${formatTemp(data.main.feels_like)}${unitSymbol}`;

    // 1. Wind Matrix
    DOM.windSpeed.textContent = windInfo.value;
    DOM.windUnit.textContent = windInfo.unit;
    const windDeg = data.wind.deg || 0;
    DOM.windDirection.textContent = degToCompass(windDeg);
    DOM.compassPointer.style.transform = `rotate(${windDeg}deg)`;

    if (data.wind.gust) {
        const gustInfo = formatSpeed(data.wind.gust);
        DOM.windGust.textContent = `${gustInfo.value} ${gustInfo.unit}`;
    } else {
        DOM.windGust.textContent = `Nominal (${windInfo.value} ${windInfo.unit})`;
    }

    // 2. Humidity & Dew Point
    DOM.humidityVal.textContent = data.main.humidity;
    DOM.humidityProgress.style.width = `${Math.min(data.main.humidity, 100)}%`;
    // Approximate Magnus formula dew point
    const T = data.main.temp;
    const RH = data.main.humidity;
    const dewPointC = T - ((100 - RH) / 5);
    DOM.dewPoint.textContent = `${formatTemp(dewPointC)}${unitSymbol}`;

    // 3. Visibility
    const visKm = data.visibility ? (data.visibility / 1000).toFixed(1) : 10;
    DOM.visibilityVal.textContent = state.currentUnit === 'imperial' 
        ? (visKm * 0.621371).toFixed(1)
        : visKm;
    DOM.visibilityStatus.textContent = data.visibility >= 10000 
        ? 'OPTIMAL HORIZON' 
        : (data.visibility >= 5000 ? 'MODERATE ATMOSPHERE' : 'REDUCED RANGE');
    DOM.cloudsCoverage.textContent = `${weather.description} (${data.clouds.all}%)`;

    // 4. Barometric Pressure
    DOM.pressureVal.textContent = data.main.pressure;
    DOM.seaLevelVal.textContent = `${data.main.sea_level || data.main.pressure} hPa`;
    DOM.grndLevelVal.textContent = `${data.main.grnd_level || (data.main.pressure - 3)} hPa`;

    // 5. Solar Ephemeris Tracker
    renderSolarCycle(data);

    // 6. Forecasts
    if (state.forecastData) {
        renderHourlyForecast(state.forecastData);
        renderDailyForecast(state.forecastData);
    }
}

function renderSolarCycle(data) {
    if (!data.sys || !data.sys.sunrise || !data.sys.sunset) return;

    const offset = state.targetTimezoneOffset; // seconds
    const formatTimeWithOffset = (unixSec) => {
        // Target city's local UTC time
        const date = new Date((unixSec + offset) * 1000);
        let hours = date.getUTCHours();
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    };

    DOM.sunriseTime.textContent = formatTimeWithOffset(data.sys.sunrise);
    DOM.sunsetTime.textContent = formatTimeWithOffset(data.sys.sunset);

    const dayDurationSec = data.sys.sunset - data.sys.sunrise;
    const hoursDay = Math.floor(dayDurationSec / 3600);
    const minsDay = Math.floor((dayDurationSec % 3600) / 60);
    DOM.daylightDuration.textContent = `Daylight: ${hoursDay}h ${minsDay}m`;

    // Calculate current sun orb position
    const currentUnix = Math.floor(Date.now() / 1000);
    let dayRatio = (currentUnix - data.sys.sunrise) / dayDurationSec;
    dayRatio = Math.max(0, Math.min(1, dayRatio));

    const percent = (dayRatio * 100).toFixed(1);
    DOM.dayProgressFill.style.width = `${percent}%`;
    DOM.sunOrb.style.left = `${percent}%`;

    if (currentUnix < data.sys.sunrise || currentUnix > data.sys.sunset) {
        DOM.sunOrb.style.background = 'var(--purple-neon)';
        DOM.sunOrb.style.boxShadow = '0 0 12px var(--purple-neon)';
    } else {
        DOM.sunOrb.style.background = 'var(--amber-neon)';
        DOM.sunOrb.style.boxShadow = '0 0 14px var(--amber-neon), 0 0 20px var(--amber-neon)';
    }
}

// ==========================================================================
// Forecast Renderers (24-Hour Timeline & 5-Day Extended Matrix)
// ==========================================================================
function renderHourlyForecast(forecast) {
    DOM.hourlyTimeline.innerHTML = '';
    const list = forecast.list.slice(0, 9); // Next 24-27 hours

    list.forEach((item) => {
        const offset = state.targetTimezoneOffset;
        const date = new Date((item.dt + offset) * 1000);
        let hours = date.getUTCHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const timeStr = `${hours} ${ampm}`;

        const weather = item.weather[0] || {};
        const iconPath = getWeatherIcon(weather.id);
        const temp = formatTemp(item.main.temp);
        const popPercent = Math.round((item.pop || 0) * 100);

        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <span class="hourly-time">${timeStr}</span>
            <img src="${iconPath}" alt="${weather.main}" class="hourly-icon">
            <span class="hourly-temp">${temp}&deg;</span>
            <span class="hourly-pop"><i class='bx bx-water'></i> ${popPercent}%</span>
        `;
        DOM.hourlyTimeline.appendChild(card);
    });
}

function renderDailyForecast(forecast) {
    DOM.dailyForecast.innerHTML = '';

    // Group list items by calendar date in target city's timezone
    const offset = state.targetTimezoneOffset;
    const daysMap = {};

    forecast.list.forEach((item) => {
        const date = new Date((item.dt + offset) * 1000);
        const dateKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;

        if (!daysMap[dateKey]) {
            daysMap[dateKey] = {
                date: date,
                temps: [],
                conditions: [],
                weatherItems: []
            };
        }
        daysMap[dateKey].temps.push(item.main.temp);
        daysMap[dateKey].weatherItems.push(item.weather[0]);
    });

    const dayKeys = Object.keys(daysMap).slice(0, 5);
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    dayKeys.forEach((key, index) => {
        const dayData = daysMap[key];
        const dayOfWeek = dayNames[dayData.date.getUTCDay()];
        const dayTitle = index === 0 ? 'TODAY' : dayOfWeek;
        const dateStr = `${dayData.date.getUTCDate()} ${dayData.date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;

        const maxTemp = Math.max(...dayData.temps);
        const minTemp = Math.min(...dayData.temps);

        // Representative weather around midday
        const midItem = dayData.weatherItems[Math.floor(dayData.weatherItems.length / 2)] || dayData.weatherItems[0];
        const iconPath = getWeatherIcon(midItem.id);

        const card = document.createElement('div');
        card.className = 'daily-card';
        card.innerHTML = `
            <div class="daily-card-top">
                <span class="daily-day-name">${dayTitle}</span>
                <span class="daily-date">${dateStr}</span>
            </div>
            <div class="daily-card-center">
                <img src="${iconPath}" alt="${midItem.main}" class="daily-icon">
                <span class="daily-desc">${midItem.description}</span>
            </div>
            <div class="daily-temps">
                <span class="daily-hi">HI: ${formatTemp(maxTemp)}&deg;</span>
                <span class="daily-lo">LO: ${formatTemp(minTemp)}&deg;</span>
            </div>
        `;
        DOM.dailyForecast.appendChild(card);
    });
}

// ==========================================================================
// Digital Clock & Timezone Sync
// ==========================================================================
function startClock() {
    if (state.clockInterval) clearInterval(state.clockInterval);

    const update = () => {
        const now = new Date();
        // Compute target local time with offset
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const targetDate = new Date(utcMs + (state.targetTimezoneOffset * 1000));

        const h = targetDate.getHours().toString().padStart(2, '0');
        const m = targetDate.getMinutes().toString().padStart(2, '0');
        const s = targetDate.getSeconds().toString().padStart(2, '0');
        DOM.timeString.textContent = `${h}:${m}:${s}`;

        const tzHours = (state.targetTimezoneOffset / 3600);
        const tzSign = tzHours >= 0 ? '+' : '';
        DOM.timezoneBadge.textContent = `UTC${tzSign}${tzHours.toFixed(1).replace('.0', '')}`;
    };

    update();
    state.clockInterval = setInterval(update, 1000);
}

// ==========================================================================
// History Management (Local Storage)
// ==========================================================================
function getSearchHistory() {
    try {
        const saved = localStorage.getItem(CONFIG.HISTORY_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (_) {
        return [];
    }
}

function saveSearchHistory(cityName) {
    if (!cityName) return;
    let history = getSearchHistory();
    // Move to front & deduplicate
    history = history.filter(c => c.toLowerCase() !== cityName.toLowerCase());
    history.unshift(cityName);
    if (history.length > CONFIG.MAX_HISTORY) {
        history = history.slice(0, CONFIG.MAX_HISTORY);
    }
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(history));
    renderHistoryChips();
}

function renderHistoryChips() {
    const history = getSearchHistory();
    DOM.recentHistoryChips.innerHTML = '';

    if (history.length === 0) {
        DOM.recentHistoryChips.innerHTML = '<span class="timeline-hint">No target history nodes logged.</span>';
        return;
    }

    history.forEach(city => {
        const btn = document.createElement('button');
        btn.className = 'chip-btn';
        btn.setAttribute('data-city', city);
        btn.textContent = city;
        DOM.recentHistoryChips.appendChild(btn);
    });
}

// Kickstart Application
document.addEventListener('DOMContentLoaded', init);
