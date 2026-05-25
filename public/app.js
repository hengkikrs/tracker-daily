(() => {
  'use strict';

  const STORAGE_KEY = 'miaw-tracker.state.v1';
  const THEME_KEY = 'miaw-tracker.theme';
  const CLIENT_ID_KEY = 'miaw-tracker.client-id';
  const SCHEMA_VERSION = 1;
  const REMOTE_SYNC_DEBOUNCE_MS = 650;

  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const CATEGORY_ORDER = ['daily', 'weekly', 'specificWeekly', 'monthly'];

  const CATEGORY_CONFIG = {
    daily: {
      label: 'Kebiasaan Harian',
      shortLabel: 'Harian',
      slotUnit: 'hari',
      color: 'teal',
      description: 'Dilacak untuk setiap hari kalender dalam bulan ini.',
    },
    weekly: {
      label: 'Kebiasaan Mingguan',
      shortLabel: 'Mingguan',
      slotUnit: 'minggu',
      color: 'blue',
      description: 'Dilacak berdasarkan jumlah minggu pada bulan ini.',
    },
    specificWeekly: {
      label: 'Kebiasaan Mingguan Khusus',
      shortLabel: 'Mingguan Khusus',
      slotUnit: 'minggu',
      color: 'amber',
      description: 'Rutinitas mingguan khusus dengan logika progres mingguan yang sama.',
    },
    monthly: {
      label: 'Kebiasaan Bulanan',
      shortLabel: 'Bulanan',
      slotUnit: 'bulan',
      color: 'rose',
      description: 'Target besar yang dicentang satu kali per bulan.',
    },
  };

  const DEFAULT_HABITS = {
    daily: [
      'Minum air yang cukup',
      'Bergerak selama 20 menit',
      'Membaca 10 halaman',
      'Tidur sebelum target waktu',
      'Menulis jurnal singkat',
      'Latihan napas sadar',
      'Merencanakan hari esok',
      'Merapikan satu area',
    ],
    weekly: [
      'Evaluasi mingguan',
      'Persiapan makanan',
      'Cek anggaran',
      'Rapikan ruang kerja',
    ],
    specificWeekly: [
      'Rutinitas reset hari Minggu',
      'Sesi jalan kaki panjang',
      'Bersih-bersih area khusus',
      'Menghubungi keluarga atau teman',
    ],
    monthly: [
      'Membayar tagihan',
      'Pemeriksaan kesehatan',
      'Target belajar bulanan',
      'Cadangan data digital',
    ],
  };

  const HABIT_NAME_TRANSLATIONS = {
    'Drink enough water': 'Minum air yang cukup',
    'Move for 20 minutes': 'Bergerak selama 20 menit',
    'Read 10 pages': 'Membaca 10 halaman',
    'Sleep before target time': 'Tidur sebelum target waktu',
    'Journal check-in': 'Menulis jurnal singkat',
    'Mindful breathing': 'Latihan napas sadar',
    'Plan tomorrow': 'Merencanakan hari esok',
    'Tidy one space': 'Merapikan satu area',
    'Weekly review': 'Evaluasi mingguan',
    'Meal prep': 'Persiapan makanan',
    'Budget check': 'Cek anggaran',
    'Workspace reset': 'Rapikan ruang kerja',
    'Sunday reset routine': 'Rutinitas reset hari Minggu',
    'Long walk session': 'Sesi jalan kaki panjang',
    'Deep clean zone': 'Bersih-bersih area khusus',
    'Call family or friend': 'Menghubungi keluarga atau teman',
    'Pay bills': 'Membayar tagihan',
    'Health checkpoint': 'Pemeriksaan kesehatan',
    'Learning milestone': 'Target belajar bulanan',
    'Digital backup': 'Cadangan data digital',
  };

  const $ = (selector) => document.querySelector(selector);

  const dom = {
    content: $('#content'),
    monthList: $('#monthList'),
    yearSelect: $('#yearSelect'),
    pageTitle: $('#pageTitle'),
    pageSubtitle: $('#pageSubtitle'),
    sidebar: $('#sidebar'),
    overlay: $('#overlay'),
    menuBtn: $('#menuBtn'),
    themeToggle: $('#themeToggle'),
    toast: $('#toast'),
  };

  const runtimeConfig = window.MIAW_TRACKER_CONFIG || {};
  const supabaseConfig = {
    url: String(runtimeConfig.supabaseUrl || '').replace(/\/+$/, ''),
    key: String(runtimeConfig.supabaseKey || ''),
    table: String(runtimeConfig.supabaseTable || 'tracker_daily_states'),
    clientId: String(runtimeConfig.supabaseClientId || ''),
  };
  const remoteEnabled = Boolean(supabaseConfig.url && supabaseConfig.key && supabaseConfig.table);
  const runtimeYear = new Date().getFullYear();
  let state = loadState();
  let activeYear = Number(state.selectedYear) || runtimeYear;
  let activeView = state.selectedView || 'dashboard';
  let activeMonth = Number.isInteger(state.selectedMonth) ? state.selectedMonth : new Date().getMonth();
  let mobileDailyExpanded = false;
  let mobileOpenSections = new Set(['daily']);
  let toastTimer = null;
  let syncTimer = null;
  let remoteHydrated = false;
  let isApplyingRemoteState = false;

  function uid(prefix = 'h') {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
  }

  function getRemoteClientId() {
    if (supabaseConfig.clientId) return supabaseConfig.clientId;

    let clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!clientId) {
      clientId = `browser_${uid('client')}`;
      localStorage.setItem(CLIENT_ID_KEY, clientId);
    }

    return clientId;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundPercent(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  function compactPercent(value) {
    return `${Math.round(Number.isFinite(value) ? value : 0)}%`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function focusedDayIndex(year, monthIndex) {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === monthIndex) {
      return today.getDate() - 1;
    }
    return 0;
  }

  function weeksInMonth(year, monthIndex) {
    return Math.ceil(daysInMonth(year, monthIndex) / 7);
  }

  function slotCountFor(categoryKey, year, monthIndex) {
    if (categoryKey === 'daily') return daysInMonth(year, monthIndex);
    if (categoryKey === 'weekly' || categoryKey === 'specificWeekly') return weeksInMonth(year, monthIndex);
    return 1;
  }

  function slotLabel(categoryKey, index, year, monthIndex) {
    if (categoryKey === 'daily') return String(index + 1);
    if (categoryKey === 'weekly' || categoryKey === 'specificWeekly') {
      const firstDay = index * 7 + 1;
      const lastDay = Math.min(firstDay + 6, daysInMonth(year, monthIndex));
      return `M${index + 1}`;
    }
    return 'Selesai';
  }

  function slotTitle(categoryKey, index, year, monthIndex) {
    if (categoryKey === 'daily') return `${index + 1} ${MONTHS[monthIndex]} ${year}`;
    if (categoryKey === 'weekly' || categoryKey === 'specificWeekly') {
      const firstDay = index * 7 + 1;
      const lastDay = Math.min(firstDay + 6, daysInMonth(year, monthIndex));
      return `Minggu ${index + 1}: ${firstDay}-${lastDay} ${MONTHS[monthIndex]} ${year}`;
    }
    return `${MONTHS[monthIndex]} ${year}`;
  }

  function createHabit(name, categoryKey, year, monthIndex) {
    return {
      id: uid(categoryKey.slice(0, 2)),
      name,
      category: categoryKey,
      active: true,
      slots: Array(slotCountFor(categoryKey, year, monthIndex)).fill(false),
      createdAt: Date.now(),
    };
  }

  function createMonth(year, monthIndex) {
    const categories = {};
    CATEGORY_ORDER.forEach((categoryKey) => {
      categories[categoryKey] = DEFAULT_HABITS[categoryKey].map((name) => (
        createHabit(name, categoryKey, year, monthIndex)
      ));
    });
    return { categories };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && parsed.schemaVersion === SCHEMA_VERSION && parsed.years) {
        return parsed;
      }
    } catch {
      // Fall back to a fresh state below.
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      selectedYear: runtimeYear,
      selectedView: 'dashboard',
      selectedMonth: new Date().getMonth(),
      years: {},
    };
  }

  function saveState() {
    state.selectedYear = activeYear;
    state.selectedView = activeView;
    state.selectedMonth = activeMonth;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueRemoteSave();
  }

  async function supabaseFetch(path, options = {}) {
    if (!remoteEnabled) return null;

    const headers = {
      apikey: supabaseConfig.key,
      Authorization: `Bearer ${supabaseConfig.key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${supabaseConfig.url}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Supabase ${response.status}: ${message}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function hydrateRemoteState() {
    if (!remoteEnabled || remoteHydrated) return;
    remoteHydrated = true;

    const clientId = encodeURIComponent(getRemoteClientId());
    const path = `/rest/v1/${encodeURIComponent(supabaseConfig.table)}?client_id=eq.${clientId}&select=state,updated_at&limit=1`;

    try {
      const rows = await supabaseFetch(path, { method: 'GET' });
      if (Array.isArray(rows) && rows[0]?.state?.schemaVersion === SCHEMA_VERSION) {
        isApplyingRemoteState = true;
        state = rows[0].state;
        activeYear = Number(state.selectedYear) || runtimeYear;
        activeView = state.selectedView || 'dashboard';
        activeMonth = Number.isInteger(state.selectedMonth) ? state.selectedMonth : new Date().getMonth();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        ensureYear(activeYear);
        renderShell();
        isApplyingRemoteState = false;
        showToast('Data Supabase dimuat.');
        return;
      }

      await saveRemoteState();
      showToast('Data lokal disinkronkan ke Supabase.');
    } catch (error) {
      isApplyingRemoteState = false;
      console.warn(error);
      showToast('Mode lokal aktif. Sinkron Supabase belum tersedia.');
    }
  }

  function queueRemoteSave() {
    if (!remoteEnabled || !remoteHydrated || isApplyingRemoteState) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      saveRemoteState().catch((error) => {
        console.warn(error);
        showToast('Data lokal tersimpan. Sinkron Supabase gagal sementara.');
      });
    }, REMOTE_SYNC_DEBOUNCE_MS);
  }

  async function saveRemoteState() {
    if (!remoteEnabled) return;

    const payload = {
      client_id: getRemoteClientId(),
      state,
    };

    await supabaseFetch(`/rest/v1/${encodeURIComponent(supabaseConfig.table)}?on_conflict=client_id`, {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
  }

  function ensureYear(year) {
    const key = String(year);
    if (!state.years[key]) state.years[key] = { months: {} };

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      ensureMonth(year, monthIndex);
    }

    return state.years[key];
  }

  function ensureMonth(year, monthIndex) {
    const yearKey = String(year);
    if (!state.years[yearKey]) state.years[yearKey] = { months: {} };
    const yearData = state.years[yearKey];
    const monthKey = String(monthIndex);

    if (!yearData.months[monthKey]) {
      yearData.months[monthKey] = createMonth(year, monthIndex);
    }

    normalizeMonth(yearData.months[monthKey], year, monthIndex);
    return yearData.months[monthKey];
  }

  function normalizeMonth(monthData, year, monthIndex) {
    if (!monthData.categories) monthData.categories = {};

    CATEGORY_ORDER.forEach((categoryKey) => {
      if (!Array.isArray(monthData.categories[categoryKey])) {
        monthData.categories[categoryKey] = [];
      }

      const expectedSlots = slotCountFor(categoryKey, year, monthIndex);
      monthData.categories[categoryKey].forEach((habit) => {
        if (!habit.id) habit.id = uid(categoryKey.slice(0, 2));
        if (!habit.category) habit.category = categoryKey;
        if (typeof habit.active !== 'boolean') habit.active = true;
        if (HABIT_NAME_TRANSLATIONS[habit.name]) habit.name = HABIT_NAME_TRANSLATIONS[habit.name];
        if (!Array.isArray(habit.slots)) habit.slots = [];
        habit.slots = Array.from({ length: expectedSlots }, (_, index) => Boolean(habit.slots[index]));
      });
    });
  }

  function getAllHabits(monthData, includeInactive = false) {
    return CATEGORY_ORDER.flatMap((categoryKey) => (
      monthData.categories[categoryKey]
        .filter((habit) => includeInactive || habit.active)
        .map((habit) => ({ ...habit, categoryKey }))
    ));
  }

  function calculateHabitProgress(habit, categoryKey, year, monthIndex) {
    const totalSlots = slotCountFor(categoryKey, year, monthIndex);
    const checkedSlots = habit.slots.slice(0, totalSlots).filter(Boolean).length;
    const progress = totalSlots === 0 ? 0 : (checkedSlots / totalSlots) * 100;

    return {
      checkedSlots,
      totalSlots,
      progress,
    };
  }

  function calculateDailyRates(monthData, year, monthIndex) {
    const dayCount = daysInMonth(year, monthIndex);
    const activeDailyHabits = monthData.categories.daily.filter((habit) => habit.active);

    return Array.from({ length: dayCount }, (_, dayIndex) => {
      const checked = activeDailyHabits.filter((habit) => Boolean(habit.slots[dayIndex])).length;
      return {
        checked,
        total: activeDailyHabits.length,
        progress: activeDailyHabits.length === 0 ? 0 : (checked / activeDailyHabits.length) * 100,
      };
    });
  }

  function calculateMonthStats(year, monthIndex) {
    const monthData = ensureMonth(year, monthIndex);
    const habits = getAllHabits(monthData);
    const rows = habits.map((habit) => {
      const progressData = calculateHabitProgress(habit, habit.categoryKey, year, monthIndex);
      return { ...habit, ...progressData };
    });

    const totalHabits = rows.length;
    const average = totalHabits === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.progress, 0) / totalHabits;

    const checkedSlots = rows.reduce((sum, row) => sum + row.checkedSlots, 0);
    const totalSlots = rows.reduce((sum, row) => sum + row.totalSlots, 0);
    const activeDailyHabits = monthData.categories.daily.filter((habit) => habit.active).length;

    return {
      monthIndex,
      monthName: MONTHS[monthIndex],
      totalHabits,
      average,
      checkedSlots,
      totalSlots,
      activeDailyHabits,
      rows,
    };
  }

  function calculateYearStats(year) {
    ensureYear(year);
    const months = MONTHS.map((_, monthIndex) => calculateMonthStats(year, monthIndex));
    const yearAverage = months.length === 0
      ? 0
      : months.reduce((sum, month) => sum + month.average, 0) / months.length;
    const bestMonth = months.reduce((best, month) => (
      !best || month.average > best.average ? month : best
    ), null);
    const totalHabits = months.reduce((sum, month) => sum + month.totalHabits, 0);
    const checkedSlots = months.reduce((sum, month) => sum + month.checkedSlots, 0);
    const totalSlots = months.reduce((sum, month) => sum + month.totalSlots, 0);

    return {
      months,
      yearAverage,
      bestMonth,
      totalHabits,
      checkedSlots,
      totalSlots,
    };
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2200);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      applyTheme(saved);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  function buildYearOptions() {
    const knownYears = Object.keys(state.years).map(Number).filter(Number.isFinite);
    const years = new Set([
      runtimeYear - 1,
      runtimeYear,
      runtimeYear + 1,
      runtimeYear + 2,
      activeYear,
      ...knownYears,
    ]);

    return Array.from(years).sort((a, b) => a - b);
  }

  function renderYearOptions() {
    dom.yearSelect.innerHTML = buildYearOptions()
      .map((year) => `<option value="${year}" ${year === activeYear ? 'selected' : ''}>${year}</option>`)
      .join('');
  }

  function renderMonthList() {
    dom.monthList.innerHTML = MONTHS.map((month, monthIndex) => {
      const stats = calculateMonthStats(activeYear, monthIndex);
      const activeClass = activeView === 'month' && activeMonth === monthIndex ? 'active' : '';

      return `
        <button class="month-link ${activeClass}" type="button" data-month="${monthIndex}">
          <span>${month}</span>
          <strong>${compactPercent(stats.average)}</strong>
        </button>
      `;
    }).join('');
  }

  function renderShell() {
    renderYearOptions();
    renderMonthList();

    document.querySelectorAll('[data-view="dashboard"]').forEach((button) => {
      button.classList.toggle('active', activeView === 'dashboard');
    });

    if (activeView === 'dashboard') {
      dom.pageTitle.textContent = 'Dasbor';
      dom.pageSubtitle.textContent = `Ringkasan kebiasaan sepanjang ${activeYear}`;
      dom.content.innerHTML = renderDashboard(activeYear);
      return;
    }

    dom.pageTitle.textContent = `${MONTHS[activeMonth]} ${activeYear}`;
    dom.pageSubtitle.textContent = 'Lembar pelacak bulanan dan analitik';
    dom.content.innerHTML = renderMonth(activeYear, activeMonth);
  }

  function renderDashboard(year) {
    const yearStats = calculateYearStats(year);
    const bestMonth = yearStats.bestMonth;
    const focusMonth = calculateMonthStats(year, activeMonth);
    const focusMonthData = ensureMonth(year, activeMonth);
    const focusDailyRates = calculateDailyRates(focusMonthData, year, activeMonth);
    const categoryBreakdown = calculateCategoryBreakdown(focusMonthData, year, activeMonth);
    const slotRate = yearStats.totalSlots === 0
      ? 0
      : (yearStats.checkedSlots / yearStats.totalSlots) * 100;

    return `
      <div class="dashboard-layout">
        <section class="dashboard-sheet" aria-label="Dasbor bergaya spreadsheet">
          <aside class="sheet-sidebar">
            <div class="sheet-tile label-tile">
              <span>Tahun</span>
              <strong>${year}</strong>
            </div>
            <div class="sheet-tile month-tile">
              <span>Bulan Fokus</span>
              <strong>${focusMonth.monthName}</strong>
            </div>
            <div class="sheet-tile habit-tile">
              <span>Kebiasaan Saya</span>
              <strong>${focusMonth.totalHabits}</strong>
            </div>
          </aside>

          <div class="sheet-stage">
            <div class="sheet-stage-head">
              <div>
                <span class="kicker">Garis pelacakan tahunan</span>
                <h3>Peta Penyelesaian Kebiasaan ${year}</h3>
                <p>Rata-rata bulanan dihitung dari semua kebiasaan harian, mingguan, mingguan khusus, dan bulanan yang aktif.</p>
              </div>
              <button class="small-button" type="button" data-action="jump-month" data-month="${activeMonth}">
                Buka ${focusMonth.monthName}
              </button>
            </div>
            ${renderTrendChart(yearStats.months)}
            ${renderDailyPercentStrip(focusDailyRates, year, activeMonth)}
          </div>

          <aside class="cat-card">
            <div class="cat-badge" aria-hidden="true">
              <img src="cat-logo.svg" alt="" />
            </div>
            <span>Selamat</span>
            <strong>${compactPercent(focusMonth.average)}</strong>
            <p>Rata-rata global ${focusMonth.monthName}. ${focusMonth.average >= 70 ? 'Konsistensi miaw-keren.' : 'Tetap miaw-langkah maju.'}</p>
          </aside>
        </section>

        <section class="dashboard-band">
          ${renderMetric('Rata-rata Tahun', `${roundPercent(yearStats.yearAverage)}%`, 'Momentum miaw-keren', 'teal')}
          ${renderMetric('Bulan Terbaik', bestMonth ? bestMonth.monthName : '-', bestMonth ? `${roundPercent(bestMonth.average)}% selesai` : 'Belum ada data', 'blue')}
          ${renderMetric('Slot Dicentang', `${roundPercent(slotRate)}%`, `${yearStats.checkedSlots} dari ${yearStats.totalSlots} slot`, 'amber')}
          ${renderMetric('Bulan Fokus', `${roundPercent(focusMonth.average)}%`, `${focusMonth.checkedSlots} dari ${focusMonth.totalSlots} slot`, 'rose')}
        </section>

        <section class="category-board" aria-label="Rincian kategori bulan fokus">
          ${categoryBreakdown.map((category) => `
            <article class="category-card tone-${CATEGORY_CONFIG[category.categoryKey].color}">
              <div>
                <span>${CATEGORY_CONFIG[category.categoryKey].shortLabel}</span>
                <strong>${roundPercent(category.average)}%</strong>
              </div>
              <div class="category-track" aria-hidden="true">
                <span style="width:${clamp(category.average, 0, 100)}%"></span>
              </div>
              <p>${category.checkedSlots}/${category.totalSlots} dicentang dari ${category.totalHabits} kebiasaan aktif</p>
            </article>
          `).join('')}
        </section>

        <section class="panel month-board">
          <div class="section-heading">
            <div>
              <h3>Tile Bulanan</h3>
              <p>Navigasi visual cepat untuk setiap lembar bulan.</p>
            </div>
          </div>
          <div class="month-tile-grid">
            ${yearStats.months.map((month) => `
              <button class="month-score-card ${scoreClass(month.average)}" type="button" data-action="jump-month" data-month="${month.monthIndex}">
                <span>${month.monthName.slice(0, 3)}</span>
                <strong>${compactPercent(month.average)}</strong>
                <em>${month.totalHabits} kebiasaan</em>
              </button>
            `).join('')}
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <div>
              <h3>Ringkasan Bulanan Utama</h3>
              <p>Setiap baris mengambil data dari lembar bulan dan merata-ratakan progres semua kebiasaan aktif.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th>Jumlah Kebiasaan</th>
                  <th>% Selesai</th>
                  <th>Slot Dicentang</th>
                  <th>Buka</th>
                </tr>
              </thead>
              <tbody>
                ${yearStats.months.map((month) => `
                  <tr class="${month.monthIndex === activeMonth ? 'is-focus-month' : ''}">
                    <td><strong>${month.monthName}</strong></td>
                    <td>${month.totalHabits}</td>
                    <td>
                      <div class="inline-progress">
                        <span class="mini-bar" aria-hidden="true"><span style="width:${clamp(month.average, 0, 100)}%"></span></span>
                        <strong>${roundPercent(month.average)}%</strong>
                      </div>
                    </td>
                    <td>${month.checkedSlots} / ${month.totalSlots}</td>
                    <td>
                      <button class="small-button" type="button" data-action="jump-month" data-month="${month.monthIndex}">Lihat</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  function calculateCategoryBreakdown(monthData, year, monthIndex) {
    return CATEGORY_ORDER.map((categoryKey) => {
      const rows = monthData.categories[categoryKey]
        .filter((habit) => habit.active)
        .map((habit) => calculateHabitProgress(habit, categoryKey, year, monthIndex));
      const totalHabits = rows.length;
      const average = totalHabits === 0
        ? 0
        : rows.reduce((sum, row) => sum + row.progress, 0) / totalHabits;
      const checkedSlots = rows.reduce((sum, row) => sum + row.checkedSlots, 0);
      const totalSlots = rows.reduce((sum, row) => sum + row.totalSlots, 0);

      return {
        categoryKey,
        totalHabits,
        average,
        checkedSlots,
        totalSlots,
      };
    });
  }

  function scoreClass(score) {
    if (score >= 85) return 'score-great';
    if (score >= 60) return 'score-good';
    if (score >= 35) return 'score-watch';
    return 'score-low';
  }

  function renderDailyPercentStrip(dailyRates, year, monthIndex) {
    if (!dailyRates.length) {
      return '<div class="daily-strip empty">Belum ada kebiasaan harian.</div>';
    }

    return `
      <div class="daily-strip" aria-label="Strip tingkat penyelesaian harian ${MONTHS[monthIndex]}">
        ${dailyRates.map((day, index) => `
          <div class="day-score ${scoreClass(day.progress)}" title="${index + 1} ${MONTHS[monthIndex]} ${year}: ${roundPercent(day.progress)}%">
            <strong>${compactPercent(day.progress)}</strong>
            <span>${index + 1}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderMetric(label, value, note, tone) {
    return `
      <article class="metric-card tone-${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <p>${escapeHtml(note)}</p>
      </article>
    `;
  }

  function renderTrendChart(monthStats) {
    const width = 760;
    const height = 260;
    const left = 42;
    const right = 22;
    const top = 24;
    const bottom = 44;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const xStep = plotWidth / (monthStats.length - 1);
    const points = monthStats.map((month, index) => {
      const x = left + (index * xStep);
      const y = top + plotHeight - ((clamp(month.average, 0, 100) / 100) * plotHeight);
      return { x, y, month };
    });
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
    const area = `${left},${top + plotHeight} ${polyline} ${left + plotWidth},${top + plotHeight}`;

    return `
      <div class="chart-scroll">
        <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik tren penyelesaian tahunan">
          <g class="chart-grid">
            ${[0, 25, 50, 75, 100].map((tick) => {
              const y = top + plotHeight - ((tick / 100) * plotHeight);
              return `
                <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
                <text x="8" y="${y + 4}">${tick}%</text>
              `;
            }).join('')}
          </g>
          <polygon class="chart-area" points="${area}"></polygon>
          <polyline class="chart-line" points="${polyline}"></polyline>
          ${points.map((point, index) => `
            <g class="chart-point">
              <circle cx="${point.x}" cy="${point.y}" r="5"></circle>
              <text x="${point.x}" y="${point.y - 12}" text-anchor="middle">${compactPercent(point.month.average)}</text>
              <text class="chart-month" x="${point.x}" y="${height - 14}" text-anchor="middle">${MONTHS[index].slice(0, 3)}</text>
            </g>
          `).join('')}
        </svg>
      </div>
    `;
  }

  function renderMonth(year, monthIndex) {
    const monthData = ensureMonth(year, monthIndex);
    const stats = calculateMonthStats(year, monthIndex);
    const leaderboards = calculateLeaderboards(monthData, year, monthIndex);
    const dailyRates = calculateDailyRates(monthData, year, monthIndex);
    const focusDayIndex = focusedDayIndex(year, monthIndex);
    const dailyAverage = dailyRates.length === 0
      ? 0
      : dailyRates.reduce((sum, day) => sum + day.progress, 0) / dailyRates.length;

    return `
      <div class="month-layout">
        <section class="metric-grid" aria-label="Metrik ringkasan bulanan">
          ${renderMetric('Rata-rata Global Bulan', `${roundPercent(stats.average)}%`, 'Rata-rata progres semua kebiasaan aktif', 'teal')}
          ${renderMetric('Kebiasaan Aktif', String(stats.totalHabits), `${stats.activeDailyHabits} kebiasaan harian masuk rumus harian`, 'blue')}
          ${renderMetric('Rata-rata Harian', `${roundPercent(dailyAverage)}%`, 'Rata-rata tingkat penyelesaian per kolom hari', 'amber')}
          ${renderMetric('Slot Dicentang', `${stats.checkedSlots}/${stats.totalSlots}`, 'Semua nilai dicentang di lembar ini', 'rose')}
        </section>

        <section class="panel control-panel">
          <form id="habitForm" class="habit-form">
            <label>
              <span>Kategori</span>
              <select name="category">
                ${CATEGORY_ORDER.map((categoryKey) => (
                  `<option value="${categoryKey}">${CATEGORY_CONFIG[categoryKey].label}</option>`
                )).join('')}
              </select>
            </label>
            <label class="habit-name-field">
              <span>Nama kebiasaan</span>
              <input name="name" type="text" maxlength="80" placeholder="Tambah kebiasaan baru" autocomplete="off" required />
            </label>
            <button class="primary-button" type="submit">Tambah Kebiasaan</button>
            <button class="danger-button" type="button" data-action="reset-month">Reset Centang</button>
          </form>
        </section>

        ${renderHabitSection('daily', monthData, year, monthIndex, dailyRates, focusDayIndex)}
        ${renderHabitSection('weekly', monthData, year, monthIndex, null, focusDayIndex)}
        ${renderHabitSection('specificWeekly', monthData, year, monthIndex, null, focusDayIndex)}
        ${renderHabitSection('monthly', monthData, year, monthIndex, null, focusDayIndex)}

        <section class="analytics-grid">
          ${renderLeaderboard('Miaw-keren!', '5 Kebiasaan Harian Paling Konsisten', leaderboards.top, 'top')}
          ${renderLeaderboard('Miaw-no!', '5 Kebiasaan Harian yang Perlu Ditingkatkan', leaderboards.bottom, 'bottom')}
        </section>
      </div>
    `;
  }

  function renderHabitSection(categoryKey, monthData, year, monthIndex, dailyRates = null, focusDayIndex = 0) {
    const config = CATEGORY_CONFIG[categoryKey];
    const habits = monthData.categories[categoryKey];
    const slotCount = slotCountFor(categoryKey, year, monthIndex);
    const slotIndexes = Array.from({ length: slotCount }, (_, index) => index);
    const activeCount = habits.filter((habit) => habit.active).length;
    const sectionId = `${categoryKey}-${year}-${monthIndex}`;
    const isDaily = categoryKey === 'daily';
    const isCollapsed = !isDaily && !mobileOpenSections.has(categoryKey);
    const tableClass = isDaily
      ? `daily-table ${mobileDailyExpanded ? 'mobile-full' : 'mobile-focus'}`
      : '';
    const mobileToggleLabel = isDaily
      ? (mobileDailyExpanded ? 'Ringkas ke tanggal fokus' : 'Lihat semua tanggal')
      : (isCollapsed ? `Buka ${config.shortLabel}` : `Tutup ${config.shortLabel}`);
    const mobileToggleAction = isDaily ? 'toggle-daily-full' : 'toggle-mobile-section';
    const focusDateText = `${focusDayIndex + 1} ${MONTHS[monthIndex]}`;

    return `
      <section class="panel tracker-section tone-${config.color} ${isCollapsed ? 'mobile-collapsed' : ''}" aria-labelledby="${sectionId}" data-category="${categoryKey}">
        <div class="section-heading">
          <div>
            <h3 id="${sectionId}">${config.label}</h3>
            <p>${config.description}</p>
          </div>
          <div class="section-head-actions">
            ${isDaily ? `<span class="section-chip mobile-focus-chip">Fokus: ${focusDateText}</span>` : ''}
            <span class="section-chip">${activeCount} aktif</span>
            <button class="small-button mobile-section-toggle" type="button" data-action="${mobileToggleAction}" data-category="${categoryKey}" aria-expanded="${isDaily ? mobileDailyExpanded : !isCollapsed}">
              ${mobileToggleLabel}
            </button>
          </div>
        </div>

        <div class="grid-scroller" data-scroll-key="${categoryKey}">
          <table class="habit-table ${tableClass}">
            <thead>
              <tr>
                <th class="habit-col">Kebiasaan</th>
                ${slotIndexes.map((slotIndex) => `
                  <th class="slot-col ${slotIndex === focusDayIndex ? 'is-focus-slot' : ''}" data-slot-index="${slotIndex}" title="${escapeHtml(slotTitle(categoryKey, slotIndex, year, monthIndex))}">
                    ${escapeHtml(slotLabel(categoryKey, slotIndex, year, monthIndex))}
                  </th>
                `).join('')}
                <th class="progress-col">Progres</th>
                <th class="action-col">Aksi</th>
              </tr>
              ${isDaily ? renderDailyRateRow(dailyRates, 'top', focusDayIndex) : ''}
            </thead>
            <tbody>
              ${habits.length === 0 ? renderEmptyHabitRow(slotCount) : habits.map((habit) => (
                renderHabitRow(habit, categoryKey, year, monthIndex, slotIndexes, focusDayIndex)
              )).join('')}
            </tbody>
            ${isDaily ? `<tfoot>${renderDailyRateRow(dailyRates, 'bottom', focusDayIndex)}</tfoot>` : ''}
          </table>
        </div>
      </section>
    `;
  }

  function renderDailyRateRow(dailyRates, placement, focusDayIndex) {
    const label = placement === 'top' ? 'Tingkat harian' : 'Total tingkat harian';

    return `
      <tr class="rate-row">
        <th class="habit-col">${label}</th>
        ${dailyRates.map((day, dayIndex) => `
          <td class="rate-cell ${dayIndex === focusDayIndex ? 'is-focus-slot' : ''}" data-slot-index="${dayIndex}" title="${day.checked} dari ${day.total} kebiasaan harian aktif">
            ${compactPercent(day.progress)}
          </td>
        `).join('')}
        <td class="progress-col">Sukses kolom</td>
        <td class="action-col"></td>
      </tr>
    `;
  }

  function renderEmptyHabitRow(slotCount) {
    return `
      <tr>
        <td class="empty-row" colspan="${slotCount + 3}">Belum ada kebiasaan untuk kategori ini.</td>
      </tr>
    `;
  }

  function renderHabitRow(habit, categoryKey, year, monthIndex, slotIndexes, focusDayIndex = 0) {
    const config = CATEGORY_CONFIG[categoryKey];
    const progressData = calculateHabitProgress(habit, categoryKey, year, monthIndex);
    const rowClass = habit.active ? '' : 'is-paused';
    const statusLabel = habit.active ? 'Aktif' : 'Dijeda';

    return `
      <tr class="${rowClass}" data-habit-id="${habit.id}" data-category="${categoryKey}">
        <th class="habit-col" scope="row">
          <div class="habit-title">
            <strong>${escapeHtml(habit.name)}</strong>
            <span class="habit-meta">${config.shortLabel} - ${statusLabel}</span>
          </div>
        </th>
        ${slotIndexes.map((slotIndex) => `
          <td class="slot-cell ${slotIndex === focusDayIndex ? 'is-focus-slot' : ''}" data-slot-index="${slotIndex}">
            <input
              class="slot-check tone-${config.color}"
              type="checkbox"
              aria-label="${escapeHtml(habit.name)} ${escapeHtml(slotTitle(categoryKey, slotIndex, year, monthIndex))}"
              data-action="toggle-slot"
              data-category="${categoryKey}"
              data-habit-id="${habit.id}"
              data-slot="${slotIndex}"
              ${habit.slots[slotIndex] ? 'checked' : ''}
              ${habit.active ? '' : 'disabled'}
            />
          </td>
        `).join('')}
        <td class="progress-col">
          <div class="progress-stack">
            <span class="progress-bar" aria-hidden="true"><span style="width:${clamp(progressData.progress, 0, 100)}%"></span></span>
            <strong>${roundPercent(progressData.progress)}%</strong>
            <small>${progressData.checkedSlots}/${progressData.totalSlots}</small>
          </div>
        </td>
        <td class="action-col">
          <div class="row-actions">
            <button class="icon-action" type="button" title="Ganti nama kebiasaan" aria-label="Ganti nama kebiasaan" data-action="rename-habit" data-category="${categoryKey}" data-habit-id="${habit.id}">
              <svg viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="M13.5 6.5 17.5 10.5"/></svg>
            </button>
            <button class="icon-action" type="button" title="${habit.active ? 'Jeda kebiasaan' : 'Aktifkan kebiasaan'}" aria-label="${habit.active ? 'Jeda kebiasaan' : 'Aktifkan kebiasaan'}" data-action="toggle-active" data-category="${categoryKey}" data-habit-id="${habit.id}">
              <svg viewBox="0 0 24 24">${habit.active ? '<path d="M10 4H6v16h4V4ZM18 4h-4v16h4V4Z"/>' : '<path d="m8 5 11 7-11 7V5Z"/>'}</svg>
            </button>
            <button class="icon-action danger" type="button" title="Hapus kebiasaan" aria-label="Hapus kebiasaan" data-action="delete-habit" data-category="${categoryKey}" data-habit-id="${habit.id}">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function calculateLeaderboards(monthData, year, monthIndex) {
    const dailyRows = monthData.categories.daily
      .filter((habit) => habit.active)
      .map((habit) => ({
        ...habit,
        ...calculateHabitProgress(habit, 'daily', year, monthIndex),
      }));

    const byHigh = [...dailyRows].sort((a, b) => (
      b.progress - a.progress || a.name.localeCompare(b.name)
    ));
    const byLow = [...dailyRows].sort((a, b) => (
      a.progress - b.progress || a.name.localeCompare(b.name)
    ));

    return {
      top: byHigh.slice(0, 5),
      bottom: byLow.slice(0, 5),
    };
  }

  function renderLeaderboard(kicker, title, rows, type) {
    const empty = `
      <div class="leader-empty">
        <strong>${type === 'top' ? 'Miaw-menunggu.' : 'Belum ada daftar Miaw-no.'}</strong>
        <span>Tambahkan kebiasaan harian aktif untuk membuat papan ini.</span>
      </div>
    `;

    return `
      <section class="panel leaderboard ${type}">
        <div class="section-heading">
          <div>
            <span class="kicker">${escapeHtml(kicker)}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${type === 'top' ? 'Persentase penyelesaian harian tertinggi.' : 'Persentase penyelesaian harian terendah. Tetap miaw-langkah maju.'}</p>
          </div>
        </div>
        ${rows.length === 0 ? empty : `
          <ol class="leader-list">
            ${rows.map((row, index) => `
              <li>
                <span class="rank">${index + 1}</span>
                <div>
                  <strong>${escapeHtml(row.name)}</strong>
                  <span>${row.checkedSlots}/${row.totalSlots} hari dicentang</span>
                </div>
                <em>${roundPercent(row.progress)}%</em>
              </li>
            `).join('')}
          </ol>
        `}
      </section>
    `;
  }

  function findHabit(categoryKey, habitId) {
    const monthData = ensureMonth(activeYear, activeMonth);
    return monthData.categories[categoryKey].find((habit) => habit.id === habitId);
  }

  function rerenderWithScroll(scrollKey, scrollLeft) {
    renderShell();
    if (!scrollKey) return;
    requestAnimationFrame(() => {
      const scroller = document.querySelector(`[data-scroll-key="${scrollKey}"]`);
      if (scroller) scroller.scrollLeft = scrollLeft;
    });
  }

  function addHabit(form) {
    const data = new FormData(form);
    const categoryKey = data.get('category');
    const name = String(data.get('name') || '').trim();

    if (!CATEGORY_CONFIG[categoryKey] || !name) return;

    const monthData = ensureMonth(activeYear, activeMonth);
    monthData.categories[categoryKey].push(createHabit(name, categoryKey, activeYear, activeMonth));
    form.reset();
    saveState();
    renderShell();
    showToast('Miaw-keren! Kebiasaan ditambahkan.');
  }

  function toggleSlot(input) {
    const categoryKey = input.dataset.category;
    const habitId = input.dataset.habitId;
    const slotIndex = Number(input.dataset.slot);
    const habit = findHabit(categoryKey, habitId);
    if (!habit || !Number.isInteger(slotIndex)) return;

    const scroller = input.closest('.grid-scroller');
    habit.slots[slotIndex] = input.checked;
    saveState();
    rerenderWithScroll(scroller?.dataset.scrollKey, scroller?.scrollLeft || 0);
    showToast(input.checked ? 'Miaw-keren! Slot dicentang.' : 'Miaw-tenang. Slot batal dicentang.');
  }

  function renameHabit(categoryKey, habitId) {
    const habit = findHabit(categoryKey, habitId);
    if (!habit) return;

    const nextName = prompt('Ganti nama kebiasaan:', habit.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) return;

    habit.name = trimmed.slice(0, 80);
    saveState();
    renderShell();
    showToast('Nama kebiasaan diganti.');
  }

  function toggleActive(categoryKey, habitId) {
    const habit = findHabit(categoryKey, habitId);
    if (!habit) return;

    habit.active = !habit.active;
    saveState();
    renderShell();
    showToast(habit.active ? 'Miaw-keren! Kebiasaan aktif.' : 'Kebiasaan dijeda.');
  }

  function deleteHabit(categoryKey, habitId) {
    const monthData = ensureMonth(activeYear, activeMonth);
    const habit = monthData.categories[categoryKey].find((item) => item.id === habitId);
    if (!habit) return;

    if (!confirm(`Hapus "${habit.name}" dari ${MONTHS[activeMonth]} ${activeYear}?`)) return;

    monthData.categories[categoryKey] = monthData.categories[categoryKey].filter((item) => item.id !== habitId);
    saveState();
    renderShell();
    showToast('Kebiasaan dihapus.');
  }

  function resetMonthChecks() {
    const monthData = ensureMonth(activeYear, activeMonth);
    if (!confirm(`Reset semua centang untuk ${MONTHS[activeMonth]} ${activeYear}? Nama kebiasaan tetap disimpan.`)) return;

    CATEGORY_ORDER.forEach((categoryKey) => {
      monthData.categories[categoryKey].forEach((habit) => {
        habit.slots = habit.slots.map(() => false);
      });
    });

    saveState();
    renderShell();
    showToast('Miaw-rapi. Centang bulan ini direset.');
  }

  function openSidebar() {
    dom.sidebar.classList.add('open');
    dom.overlay.classList.add('show');
  }

  function closeSidebar() {
    dom.sidebar.classList.remove('open');
    dom.overlay.classList.remove('show');
  }

  function bindEvents() {
    dom.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    dom.menuBtn.addEventListener('click', openSidebar);
    dom.overlay.addEventListener('click', closeSidebar);

    dom.yearSelect.addEventListener('change', () => {
      activeYear = Number(dom.yearSelect.value);
      ensureYear(activeYear);
      saveState();
      renderShell();
    });

    dom.monthList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-month]');
      if (!button) return;

      activeMonth = Number(button.dataset.month);
      activeView = 'month';
      mobileDailyExpanded = false;
      mobileOpenSections = new Set(['daily']);
      saveState();
      renderShell();
      closeSidebar();
    });

    document.addEventListener('click', (event) => {
      const dashboardButton = event.target.closest('[data-view="dashboard"]');
      if (dashboardButton) {
        activeView = 'dashboard';
        saveState();
        renderShell();
        closeSidebar();
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      const { action, category, habitId, month } = actionButton.dataset;

      if (action === 'jump-month') {
        activeMonth = Number(month);
        activeView = 'month';
        mobileDailyExpanded = false;
        mobileOpenSections = new Set(['daily']);
        saveState();
        renderShell();
        return;
      }

      if (action === 'toggle-daily-full') {
        mobileDailyExpanded = !mobileDailyExpanded;
        renderShell();
        return;
      }

      if (action === 'toggle-mobile-section') {
        if (mobileOpenSections.has(category)) {
          mobileOpenSections.delete(category);
        } else {
          mobileOpenSections.add(category);
        }
        renderShell();
        return;
      }

      if (action === 'rename-habit') renameHabit(category, habitId);
      if (action === 'toggle-active') toggleActive(category, habitId);
      if (action === 'delete-habit') deleteHabit(category, habitId);
      if (action === 'reset-month') resetMonthChecks();
    });

    dom.content.addEventListener('submit', (event) => {
      if (event.target.id !== 'habitForm') return;
      event.preventDefault();
      addHabit(event.target);
    });

    dom.content.addEventListener('change', (event) => {
      const input = event.target.closest('[data-action="toggle-slot"]');
      if (!input) return;
      toggleSlot(input);
    });
  }

  function init() {
    initTheme();
    ensureYear(activeYear);
    saveState();
    bindEvents();
    renderShell();
    hydrateRemoteState();
  }

  init();
})();
