(() => {
  'use strict';

  function formatRegistered(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/®/g, '<sup class="registered-mark">®</sup>');
  }

  /* ---------------- Nav ---------------- */
  const navToggle = document.getElementById('navToggle');
  const chapters = document.getElementById('chapters');
  navToggle?.addEventListener('click', () => {
    const open = chapters.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  chapters?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    chapters.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));

  const sections = [...document.querySelectorAll('main .section, .hero')].filter(s => s.id);
  const navLinks = [...document.querySelectorAll('.chapters a')];
  if ('IntersectionObserver' in window && sections.length) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === `#${id}`));
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => obs.observe(s));
  }

  /* ---------------- Results: box switch + synced videos ---------------- */
  const boxSwitch = document.getElementById('boxSwitch');
  const camGrid3 = document.getElementById('camGrid3');

  const VIDEO_SETS = {
    empty: { top: 'empty_top', wrist: 'empty_wrist', spectro: 'empty_spectro', gripper: 'Gripper A' },
    spacer1: { top: 'spacer1_top', wrist: 'spacer1_wrist', spectro: 'spacer1_spectro', gripper: 'Gripper A' },
    spacer7: { top: 'spacer7_top', wrist: 'spacer7_wrist', spectro: 'spacer7_spectro', gripper: 'Gripper A' },
    nuts7: { top: 'nuts7_top', wrist: 'nuts7_wrist', spectro: 'nuts7_spectro', gripper: 'Gripper A' },
  };

  /* ---------------- Shared episode player (round play, seek bar, time/frame, speed) ---------------- */
  const PLAYER_FPS = 30;               // frame rate of every video on the page
  const PLAYER_RATES = [1, 2, 0.5];    // click the speed button to cycle

  // Click or drag on a progress bar to seek; `seekTo(fraction)` does the work.
  function wireDragSeek(bar, seekTo) {
    const fraction = e => {
      const r = bar.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    };
    bar.addEventListener('pointerdown', e => {
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('is-dragging');
      seekTo(fraction(e));
    });
    bar.addEventListener('pointermove', e => {
      if (bar.hasPointerCapture(e.pointerId)) seekTo(fraction(e));
    });
    const end = e => { bar.classList.remove('is-dragging'); if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId); };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  // The videos of one grid are one entangled recording, so they share one bar, driven by the first visible video.
  function createPlayer({ grid, playBtn, progress, timeEl, frameEl, speedBtn }) {
    const played = progress.querySelector('.video-progress-played');
    const vids = () => [...grid.querySelectorAll('.cam-slot:not([hidden]) video')];
    const allVids = () => [...grid.querySelectorAll('video')];
    let rate = 1;
    let raf = 0;
    let playRequest = 0;
    let autoplayPending = true;

    function sync() {
      const m = vids()[0];
      if (!m || !m.duration) return;
      played.style.width = `${m.currentTime / m.duration * 100}%`;
      timeEl.textContent = `${m.currentTime.toFixed(2)} / ${m.duration.toFixed(2)} s`;
      frameEl.textContent = `frame ${Math.round(m.currentTime * PLAYER_FPS)} / ${Math.round(m.duration * PLAYER_FPS)}`;
    }
    function tick() { sync(); if (playBtn.classList.contains('is-playing')) raf = requestAnimationFrame(tick); }
    function setPlaying(playing) {
      playBtn.classList.toggle('is-playing', playing);
      playBtn.setAttribute('aria-label', playing ? 'Pause episode' : 'Play episode');
      cancelAnimationFrame(raf);
      if (playing) tick(); else sync();
    }
    function applyRate() { allVids().forEach(v => { v.defaultPlaybackRate = rate; v.playbackRate = rate; }); }
    function pause() {
      playRequest++;
      allVids().forEach(v => v.pause());
      setPlaying(false);
    }
    function play() {
      const request = ++playRequest;
      setPlaying(true);
      Promise.all(vids().map(v => {
        v.muted = true;
        if (v.ended) v.currentTime = 0;
        return v.play();
      })).catch(error => {
        // Leave the manual play button available if autoplay is blocked.
        if (request === playRequest) {
          pause();
          console.warn('Video playback failed:', error);
        }
      });
    }

    grid.addEventListener('timeupdate', e => { if (e.target === vids()[0]) sync(); }, true);
    grid.addEventListener('loadedmetadata', e => { if (e.target === vids()[0]) sync(); }, true);
    grid.addEventListener('ended', e => {
      if (e.target.tagName === 'VIDEO' && vids().every(v => v.paused || v.ended)) setPlaying(false);
    }, true);
    wireDragSeek(progress, f => {
      const m = vids()[0];
      if (!m || !m.duration) return;
      vids().forEach(v => { v.currentTime = f * m.duration; });
      sync();
    });
    playBtn.addEventListener('click', () => {
      autoplayPending = false;
      if (playBtn.classList.contains('is-playing')) pause(); else play();
    });
    speedBtn.addEventListener('click', () => {
      rate = PLAYER_RATES[(PLAYER_RATES.indexOf(rate) + 1) % PLAYER_RATES.length];
      speedBtn.textContent = `${rate}×`;
      applyRate();
    });
    // Start when the player is visible, so short clips do not finish offscreen.
    if ('IntersectionObserver' in window) {
      const autoplayObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          autoplayObserver.disconnect();
          if (autoplayPending) { autoplayPending = false; play(); }
        }
      }, { threshold: 0.25 });
      autoplayObserver.observe(grid);
    } else {
      autoplayPending = false;
      play();
    }
    return {
      // Call after swapping video sources.
      reset() { autoplayPending = false; pause(); applyRate(); played.style.width = '0%'; play(); },
      // Call after showing/hiding slots: play again from the start.
      restart() { autoplayPending = false; pause(); allVids().forEach(v => { v.currentTime = 0; }); played.style.width = '0%'; play(); },
    };
  }

  function loadBoxVideos(box) {
    const set = VIDEO_SETS[box];
    if (!set) return;
    const slots = camGrid3.querySelectorAll('.cam-slot video');
    const keys = ['top', 'wrist', 'spectro'];
    slots.forEach((video, i) => {
      const key = keys[i];
      const src = `assets/video/${set[key]}.mp4`;
      const poster = `assets/img/posters/${set[key]}.jpg`;
      video.pause();
      video.querySelector('source').src = src;
      video.poster = poster;
      video.load();
      video.dataset.group = box;
    });
    resultsPlayer?.reset();
  }

  const resultsPlayer = camGrid3 ? createPlayer({
    grid: camGrid3,
    playBtn: document.getElementById('playAllBtn'),
    progress: document.getElementById('sharedProgress'),
    timeEl: document.getElementById('sharedTime'),
    frameEl: document.getElementById('sharedFrame'),
    speedBtn: document.getElementById('sharedSpeedBtn'),
  }) : null;

  boxSwitch?.addEventListener('click', e => {
    const btn = e.target.closest('.box-btn');
    if (!btn) return;
    const box = btn.dataset.box;
    boxSwitch.querySelectorAll('.box-btn').forEach(b => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    loadBoxVideos(box);
  });

  /* ---------------- Benchmark data ---------------- */
  // Per-sensor gripper photos, each with a red box pre-drawn around that specific sensor.
  const sensorPhoto = id => `assets/img/grippers/sensor-${id}.webp`;

  // seg, gf and confmat are filled in from js/results.js (see computeResults below).
  const GRIPPERS = {
    a: {
      label: 'Gripper A',
      desc: 'Gripper carrying an IEPE Dragonfly® strain sensor and an IEPE accelerometer, both mounted on the upper jaw.',
      sensors: [
        { id: 'dgf-acc', name: 'IEPE Dragonfly®', abbr: 'IEPE Dragonfly®', note: 'The IEPE Dragonfly® is a thin, flexible piezoelectric strain sensor characterized by a low noise level. It serves as a reference sensor across the different gripper designs to assess consistency at the dataset level.' },
        { id: 'acc', name: 'IEPE accelerometer', abbr: 'IEPE accelerometer', note: 'The IEPE accelerometer is a piezoelectric accelerometer used for measuring vibrations.'  },
        { id: 'notact', name: 'No tactile sensor', abbr: 'No tactile sensor', note: 'Vision-only baseline. Sensor spectrograms were removed during both training and inference. Performance remains close to 25%, corresponding to the random-chance level for four classes.' },
      ],
    },
    b: {
      label: 'Gripper B',
      desc: 'The gripper was redesigned to place a load cell directly in the load path, measuring the resultant force transmitted through the structure.',
      sensors: [
        { id: 'dgf-ldc', name: 'IEPE Dragonfly®', abbr: 'IEPE Dragonfly®', note: 'The IEPE Dragonfly® is a thin, flexible piezoelectric strain sensor characterized by a low noise level. It serves as a reference sensor across the different gripper designs to assess consistency at the dataset level.' },
        { id: 'loadcell', name: 'IEPE load cell', abbr: 'IEPE load cell', note: 'The IEPE load cell measures transmitted force rather than local contact deformation. It fails to capture the full dynamics of the objects in the box.' },
      ],
    },
    c: {
      label: 'Gripper C',
      desc: 'A five-sensor gripper comparing a passive Dragonfly®, a PZT disk, a MEMS accelerometer, and a metallic strain gauge, alongside the IEPE Dragonfly® reference sensor.',
      sensors: [
        { id: 'dgf-frank', name: 'IEPE Dragonfly®', abbr: 'IEPE Dragonfly®', note: 'The IEPE Dragonfly® is a thin, flexible piezoelectric strain sensor characterized by a low noise level. It serves as a reference sensor across the different gripper designs to assess consistency at the dataset level.' },
        { id: 'dgf-passif', name: 'Passive Dragonfly®', abbr: 'Passive Dragonfly®', note: 'The passive Dragonfly® outputs charge directly and provides sensing capabilities similar to those of the IEPE Dragonfly®, but without the signal conditioning.' },
        { id: 'pzt', name: 'PZT disk', abbr: 'PZT disk', note: 'The PZT disk is a bulk piezoelectric sensor with high sensitivity to vibration. Its main limitations are its mechanical brittleness and lead content.' },
        { id: 'acc-mems', name: 'MEMS accelerometer', abbr: 'MEMS accelerometer', note: 'The MEMS accelerometer is commonly used in IMUs, with bandwidth limited by a resonance around 5 kHz.' },
        { id: 'strain-gauge', name: 'Metallic strain gauge', abbr: 'Metallic strain gauge', note: 'The metallic strain gauge captures static strain but is relatively noisy.' },
      ],
    },
  };

  const TEENSY = {
    label: 'Low-cost acquisition system with Gripper C',
    desc: 'A low-cost acquisition chain (≈100 €) built from a ZONRI IEPE interface converter, a 16-bit ADS8688 ADC, and a Teensy 4.1 microcontroller. It is much noisier than the high-fidelity acquisition system. It is evaluated on a separately collected dataset.',
    sensors: [
      { id: 'dgf-frank-cheap', name: 'IEPE Dragonfly®', abbr: 'IEPE Dragonfly®', photo: sensorPhoto('dgf-frank') },
      { id: 'pzt-cheap', name: 'PZT disk', abbr: 'PZT disk', photo: sensorPhoto('pzt') },
      { id: 'acc-mems-cheap', name: 'MEMS accelerometer', abbr: 'MEMS accelerometer', photo: sensorPhoto('acc-mems') },
      { id: 'notact-cheap', name: 'No tactile sensor', abbr: 'No tactile sensor', photo: sensorPhoto('notact') },
    ],
  };

  const SPECTRO = {
    tiltAbbr: true, // long setting labels are drawn at an angle so they don't overlap
    label: 'Spectrogram settings with Gripper A and IEPE Dragonfly®',
    desc: 'Using Gripper A and IEPE Dragonfly® sensor on the high-fidelity acquisition system. We vary only the spectrogram configuration: FFT window length (nFFT) and frequency bandwidth.',
    sensors: [
      { id: 'dgf-nfft64', name: 'IEPE Dragonfly® — Time window: 0.36 s — Bandwidth: 0–10 kHz', abbr: '0.36 s — 10 kHz', photo: sensorPhoto('dgf-acc') },
      { id: 'dgf-acc', name: 'IEPE Dragonfly® — Time window: 2.9 s — Bandwidth: 0–10 kHz', abbr: '2.9 s — 10 kHz', note: 'Default setting used for every other benchmark result.' },
      { id: 'dgf-100k-512', name: 'IEPE Dragonfly® — Time window: 0.29 s — Bandwidth: 0–100 kHz', abbr: '0.29 s — 100 kHz', photo: sensorPhoto('dgf-acc') },
      { id: 'dgf-100k-4096', name: 'IEPE Dragonfly® — Time window: 2.3 s — Bandwidth: 0–100 kHz', abbr: '2.3 s — 100 kHz', photo: sensorPhoto('dgf-acc') },
    ],
  };

  // Raw episodes (js/results.js): episodes 0-19 Empty, 20-39 1 Spacer, 40-59 7 Spacers, 60-79 7 Nuts;
  // value = chosen bin 1-4, or 0 / -1 for a grasp/handling failure.
  // seg = [EMPTY, SPACER, 7_SPACERS, 7_NUTS] correct placements out of 20 each; gf = grasp/handling failures out of 80;
  // confmat[true][chosen] = placements, failures excluded.
  function computeResults(episodes) {
    const confmat = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
    let gf = 0;
    episodes.forEach((bin, i) => {
      if (bin >= 1 && bin <= 4) confmat[Math.floor(i / 20)][bin - 1]++;
      else gf++;
    });
    return { seg: confmat.map((row, i) => row[i]), gf, confmat };
  }
  [...Object.values(GRIPPERS).flatMap(g => g.sensors), ...TEENSY.sensors, ...SPECTRO.sensors].forEach(s => {
    Object.assign(s, computeResults(window.SPECTROBOT_RESULTS[s.id]));
  });

  // Confusion matrix drawn as an SVG data URI so it drops into the same <img> slot as a figure.
  function confmatSrc(confmat) {
    const cell = 164, gap = 2, pad = 20, size = pad * 2 + cell * 4 + gap * 3;
    const lo = [254, 226, 226], hi = [204, 27, 27]; // 0 -> very light red, 20 -> red
    const mix = t => `rgb(${lo.map((c, k) => Math.round(c + (hi[k] - c) * t)).join(',')})`;
    const cells = confmat.flatMap((row, r) => row.map((v, c) => {
      const x = pad + c * (cell + gap), y = pad + r * (cell + gap);
      const t = Math.min(v / 20, 1);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${mix(t)}"/>` +
        `<text x="${x + cell / 2}" y="${y + cell / 2}" dy=".35em" text-anchor="middle" font-size="54" font-weight="700" ` +
        `font-family="Inter,system-ui,Segoe UI,Roboto,sans-serif" fill="${t > 0.55 ? '#fff' : '#10182c'}">${v}</text>`;
    })).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" fill="#fff"/>${cells}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  // Val (rollout) dataset and policy model repos, from table_dataset.txt — the exact HF repos behind each bar.
  const LINKS = {
    'dgf-acc': { dataset: 'rollout_2026-08-04_shake4it_bench_dragonfly_10kHz_nfft_512_big_20260804_112531', model: 'policy_2026-07-28_shake4it_bench_dragonfly_10kHz_nfft_512' },
    'acc': { dataset: 'rollout_2026-08-04_shake4it_bench_accelero_10kHz_nfft_512_big_20260804_105115', model: 'policy_2026-08-03_shake4it_bench_accelero_10kHz_nfft_512' },
    'notact': { dataset: 'rollout_2026-08-04_shake4it_bench_notact_20260804_143759', model: 'policy_2026-08-03_shake4it_bench_notact' },
    'loadcell': { dataset: 'rollout_2026-08-06_shake4it_bench_dlc_load_cell_10kHz_nfft_512_big_20260807_142722', model: 'policy_2026-08-06_shake4it_bench_dlc_load_cell_10kHz_nfft_512' },
    'dgf-ldc': { dataset: '2026-08-06_shake4it_bench_dgf_load_cell_20260806_173918', model: 'policy_2026-08-06_shake4it_bench_dragonfly_10kHz_nfft_512' },
    'dgf-frank': { dataset: 'rollout_2026-09-03_shake4it_bench_5sensors_v3_dragonfly_10kHz_nfft_512_20260903_154723', model: 'policy_2026-09-02_shake4it_bench_5sensors_v3_dragonfly_10kHz_nfft_512' },
    'acc-mems': { dataset: 'rollout_2026-09-07_shake4it_bench_5sensors_v3_acc_mems_10kHz_nfft_512_20260907_104906', model: null },
    'pzt': { dataset: 'rollout_2026-09-07_shake4it_bench_5sensors_v3_pastille_pzt_10kHz_nfft_512_20260907_131438', model: null },
    'dgf-passif': { dataset: 'rollout_2026-09-07_shake4it_bench_5sensors_v3_dgf_passif_10kHz_nfft_512_20260907_141249', model: null },
    'strain-gauge': { dataset: 'rollout_2026-09-07_shake4it_bench_5sensors_v3_strain_gauge_10kHz_nfft_512_20260907_113746', model: null },
    'dgf-frank-cheap': { dataset: 'rollout_2026-09-22_cheap_shakeit_bench_3sensors_v2_dgf_iepe_nfft_512_20260922_113612', model: 'policy_2026-09-21_cheap_shakeit_bench_3sensors_v2_dgf_iepe_nfft_512' },
    'pzt-cheap': { dataset: 'rollout_2026-09-10_cheap_shakeit_bench_pzt_disk_20260910_160409', model: 'policy_2026-09-21_cheap_shakeit_bench_3sensors_v2_pzt_disk_nfft_512' },
    'acc-mems-cheap': { dataset: 'rollout_2026-09-10_cheap_shakeit_bench_mems_acc_20260910_163759', model: 'policy_2026-09-21_cheap_shakeit_bench_3sensors_v2_acc_mems_nfft_512' },
    'notact-cheap': { dataset: 'rollout_2026-09-21_cheap_shakeit_bench_3sensors_v2_no_tactile_20260922_173821', model: 'policy_2026-09-21_cheap_shakeit_bench_3sensors_v2_no_tactile' },
  };
  const hfDataset = repo => `https://huggingface.co/datasets/jogarulfop/${repo}`;
  const hfModel = repo => `https://huggingface.co/jogarulfop/${repo}`;

  function updateBenchLinks(sensorId) {
    const links = LINKS[sensorId];
    const datasetLink = document.getElementById('datasetLink');
    const modelLink = document.getElementById('modelLink');
    if (!datasetLink || !modelLink) return;
    if (links && links.dataset) {
      datasetLink.href = hfDataset(links.dataset);
      datasetLink.classList.remove('disabled');
      datasetLink.removeAttribute('aria-disabled');
    } else {
      datasetLink.href = '#';
      datasetLink.classList.add('disabled');
      datasetLink.setAttribute('aria-disabled', 'true');
    }
    if (links && links.model) {
      modelLink.href = hfModel(links.model);
      modelLink.classList.remove('disabled');
      modelLink.removeAttribute('aria-disabled');
    } else {
      modelLink.href = '#';
      modelLink.classList.add('disabled');
      modelLink.setAttribute('aria-disabled', 'true');
    }
  }

  const SEG_CLASSES = ['seg-empty', 'seg-spacer1', 'seg-spacer7', 'seg-nuts7'];
  const SEG_LABELS = ['Empty', '1 plastic spacer', '7 plastic spacers', '7 metallic nuts'];

  // Benches drawn as a single bar group (the openDAQ bench is split into grippers A–C).
  const SINGLE_BENCHES = { teensy: TEENSY, spectro: SPECTRO };

  let currentBench = 'opendaq';
  let currentSelection = { group: 'a', sensorId: 'dgf-acc' };

  const barChartEl = document.getElementById('barChart');
  const detailPanel = document.getElementById('detailPanel');
  const legendEl = document.getElementById('chartLegend');

  function renderLegend() {
    const items = [...SEG_LABELS.map((l, i) => [SEG_CLASSES[i], l]), ['seg-gf', 'Grasp failure']];
    legendEl.innerHTML = items.map(([cls, label]) =>
      `<span class="sw"><span class="sw-swatch ${cls}"></span>${label}</span>`
    ).join('');
  }
  renderLegend();

  function renderChart() {
    barChartEl.innerHTML = '';
    if (currentBench === 'opendaq') {
      Object.entries(GRIPPERS).forEach(([key, group], i) => {
        barChartEl.appendChild(buildGroup(key, group.label, group.sensors, i === 0));
      });
    } else {
      const group = SINGLE_BENCHES[currentBench];
      barChartEl.appendChild(buildGroup(currentBench, group.label, group.sensors, true, group.tiltAbbr));
    }
  }

  const BAR_SCALE_PX = 240; // px representing 80/80 = 100%

  function wilsonInterval(successCount, n = 80, z = 1.96) {
    const p = successCount / n;
    const denom = 1 + (z * z) / n;
    const center = (p + (z * z) / (2 * n)) / denom;
    const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
    return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
  }

  function buildGroup(groupKey, label, sensors, showAxis, tiltAbbr = true) {
    const wrap = document.createElement('div');
    wrap.className = 'bar-group';
    if (tiltAbbr) wrap.classList.add('tilt-abbr');

    const bars = document.createElement('div');
    bars.className = 'bar-group-bars';

    const gridlines = document.createElement('div');
    gridlines.className = 'bar-gridlines';
    gridlines.style.height = `${BAR_SCALE_PX}px`;
    [0, 20, 40, 60, 80, 100].forEach(pct => {
      const line = document.createElement('div');
      line.className = 'bar-gridline';
      line.style.bottom = `${pct / 100 * BAR_SCALE_PX}px`;
      gridlines.appendChild(line);
      if (showAxis) {
        const lbl = document.createElement('span');
        lbl.className = 'bar-gridline-label';
        lbl.style.bottom = `${pct / 100 * BAR_SCALE_PX}px`;
        lbl.style.left = '-2.6em';
        lbl.textContent = `${pct}%`;
        gridlines.appendChild(lbl);
      }
    });
    bars.appendChild(gridlines);

    sensors.forEach(s => {
      const success = s.seg.reduce((a, b) => a + b, 0);
      const total = success + s.gf;
      const pct = Math.floor(success / 80 * 100);
      const { lower, upper } = wilsonInterval(success);

      const outer = document.createElement('div');
      outer.className = 'bar-outer';
      outer.style.height = `${BAR_SCALE_PX}px`;

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${total / 80 * BAR_SCALE_PX}px`;
      bar.dataset.group = groupKey;
      bar.dataset.sensor = s.id;
      bar.title = `${s.name} — ${pct}% (95% CI ${Math.round(lower * 100)}–${Math.round(upper * 100)}%)`;
      bar.setAttribute('role', 'button');
      bar.setAttribute('tabindex', '0');
      // bottom-up stacking order: EMPTY..NUTS first, grasp-failure segment last (on top)
      s.seg.forEach((count, i) => {
        const seg = document.createElement('div');
        seg.className = `bar-seg ${SEG_CLASSES[i]}`;
        seg.style.height = `${count / total * 100}%`;
        seg.title = `${SEG_LABELS[i]}: ${count}/20`;
        bar.appendChild(seg);
      });
      const gfSeg = document.createElement('div');
      gfSeg.className = 'bar-seg seg-gf';
      gfSeg.style.height = `${s.gf / total * 100 || 0}%`;
      bar.appendChild(gfSeg);
      bar.addEventListener('click', () => selectSensor(groupKey, s.id));
      bar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSensor(groupKey, s.id); } });
      outer.appendChild(bar);

      const errBar = document.createElement('div');
      errBar.className = 'error-bar';
      errBar.style.bottom = `${lower * BAR_SCALE_PX}px`;
      errBar.style.height = `${(upper - lower) * BAR_SCALE_PX}px`;
      const errDot = document.createElement('span');
      errDot.className = 'error-bar-dot';
      errBar.appendChild(errDot);
      outer.appendChild(errBar);

      const valueLbl = document.createElement('span');
      valueLbl.className = 'bar-value';
      valueLbl.style.bottom = `${Math.max(upper * BAR_SCALE_PX, total / 80 * BAR_SCALE_PX) + 6}px`;
      valueLbl.textContent = `${pct}%`;
      outer.appendChild(valueLbl);

      if (s.abbr) {
        const abbrLbl = document.createElement('span');
        abbrLbl.className = 'bar-abbr';
        abbrLbl.textContent = s.abbr;
        outer.appendChild(abbrLbl);
      }

      bars.appendChild(outer);
    });
    wrap.appendChild(bars);

    const lbl = document.createElement('div');
    lbl.className = 'bar-group-label';
    lbl.innerHTML = formatRegistered(label);
    wrap.appendChild(lbl);
    return wrap;
  }

  function selectSensor(groupKey, sensorId) {
    currentSelection = { group: groupKey, sensorId };
    barChartEl.querySelectorAll('.bar').forEach(b => {
      b.classList.toggle('is-selected', b.dataset.group === groupKey && b.dataset.sensor === sensorId);
    });
    renderDetail();
  }

  function renderDetail() {
    const groupData = currentBench === 'opendaq' ? GRIPPERS[currentSelection.group] : SINGLE_BENCHES[currentBench];
    if (!groupData) return;
    const sensor = groupData.sensors.find(s => s.id === currentSelection.sensorId) || groupData.sensors[0];
    if (!sensor) { detailPanel.innerHTML = ''; return; }
    updateBenchLinks(sensor.id);
    const success = sensor.seg.reduce((a, b) => a + b, 0);
    const pct = Math.floor(success / 80 * 100);
    const photo = sensor.photo || sensorPhoto(sensor.id);

    detailPanel.innerHTML = `
      <div class="detail-header">
        <h3>${formatRegistered(sensor.name)}</h3>
        <span class="detail-rate">${pct}%</span>
        <span class="detail-n">n = ${success}/80 successful placements, ${sensor.gf} grasp failures</span>
      </div>
      ${sensor.note ? `<div class="detail-gripper-label">${formatRegistered(sensor.note)}</div>` : ''}
      <div class="detail-left-col">
        <h4 class="detail-block-title">Gripper photo</h4>
        <div class="detail-photo-wrap">
          <img id="detailPhoto" src="${photo}" alt="Photo of ${groupData.label} with the ${sensor.name} highlighted" loading="lazy">
        </div>
      </div>
      <div class="detail-side">
        <div class="detail-side-block">
          <div class="detail-block-title-row">
            <h4 class="detail-block-title">Confusion matrix</h4>
            <span class="info-toggle-wrap">
              <button class="info-toggle" id="confmatInfoBtn" type="button" aria-expanded="false" title="How to read this">Confused ?</button>
                <p class="detail-confmat-caption" id="confmatCaption" hidden>
                Each row represents the true contents of the box: 0 = empty, 1 = 1 plastic spacer, 2 = 7 plastic spacers, and 3 = 7 metallic nuts. Each column represents the bin selected by the robot. Values on the diagonal correspond to correct placements. Across the 80 total episodes, each row contains up to 20 trials. Some rows contain fewer trials because a grasp failure prevented the robot from reaching a bin.
                </p>
            </span>
          </div>
          <img id="detailConfmat" src="${confmatSrc(sensor.confmat)}" alt="Confusion matrix for ${sensor.name}">
        </div>
      </div>
      <p class="detail-note detail-gripper-desc">${formatRegistered(groupData.label)} — ${formatRegistered(groupData.desc)}</p>
    `;
  }

  function closeConfmatCaption() {
    const caption = document.getElementById('confmatCaption');
    const btn = document.getElementById('confmatInfoBtn');
    if (caption && !caption.hidden) {
      caption.hidden = true;
      btn?.setAttribute('aria-expanded', 'false');
    }
  }

  detailPanel.addEventListener('click', e => {
    const btn = e.target.closest('#confmatInfoBtn');
    if (!btn) return;
    const caption = document.getElementById('confmatCaption');
    const open = caption.hidden;
    caption.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.info-toggle-wrap')) closeConfmatCaption();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeConfmatCaption();
  });

  document.getElementById('benchSwitch')?.addEventListener('click', e => {
    const btn = e.target.closest('.bench-btn');
    if (!btn) return;
    currentBench = btn.dataset.bench;
    document.querySelectorAll('#benchSwitch .bench-btn').forEach(b => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    if (currentBench === 'opendaq') {
      currentSelection = { group: 'a', sensorId: 'dgf-acc' };
    } else {
      currentSelection = { group: currentBench, sensorId: SINGLE_BENCHES[currentBench].sensors[0].id };
    }
    renderChart();
    selectSensor(currentSelection.group, currentSelection.sensorId);
  });

  renderChart();
  selectSensor(currentSelection.group, currentSelection.sensorId);

  /* ---------------- Lightbox ---------------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.hidden = false;
  }
  document.getElementById('lightboxClose')?.addEventListener('click', () => { lightbox.hidden = true; });
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) lightbox.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hidden) lightbox.hidden = true; });

  /* ---------------- Attention section ---------------- */
  // Box class -> episode of the full-episode rollout used for that class.
  const ATTN_EPISODE = { empty: 0, spacer1: 20, spacer7: 40, nuts7: 60 };
  const ATTN_STREAMS = ['primary_attention', 'wrist_attention', 'spectro_attention', 'spectro_sensitivity'];
  const attnGrid = document.getElementById('attnGrid');
  const attnPlayer = attnGrid ? createPlayer({
    grid: attnGrid,
    playBtn: document.getElementById('attnPlayBtn'),
    progress: document.getElementById('attnProgress'),
    timeEl: document.getElementById('attnTime'),
    frameEl: document.getElementById('attnFrame'),
    speedBtn: document.getElementById('attnSpeedBtn'),
  }) : null;
  function loadAttnVideos(box) {
    attnGrid.querySelectorAll('video').forEach((video, i) => {
      video.pause();
      video.querySelector('source').src = `assets/video/act_ep${ATTN_EPISODE[box]}_${ATTN_STREAMS[i]}.mp4`;
      video.load();
    });
    attnPlayer.reset();
  }
  document.getElementById('attnBoxTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.querySelectorAll('#attnBoxTabs button').forEach(b => b.classList.toggle('is-active', b === btn));
    loadAttnVideos(btn.dataset.abox);
  });
  document.getElementById('attnMode')?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.querySelectorAll('#attnMode button').forEach(b => b.classList.toggle('is-active', b === btn));
    attnGrid.dataset.mode = btn.dataset.mode;
    attnGrid.querySelectorAll('.cam-slot').forEach(s => { s.hidden = s.dataset.kind !== btn.dataset.mode; });
    attnPlayer.restart();
  });
})();
