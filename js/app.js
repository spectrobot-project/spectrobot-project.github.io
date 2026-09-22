(() => {
  'use strict';

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
  const playAllBtn = document.getElementById('playAllBtn');
  const restartBtn = document.getElementById('restartBtn');

  const VIDEO_SETS = {
    empty: { top: 'empty_top', wrist: 'empty_wrist', spectro: 'empty_spectro', gripper: 'Gripper A' },
    spacer1: { top: 'spacer1_top', wrist: 'spacer1_wrist', spectro: 'spacer1_spectro', gripper: 'Gripper A' },
    spacer7: { top: 'spacer7_top', wrist: 'spacer7_wrist', spectro: 'spacer7_spectro', gripper: 'Gripper A' },
    nuts7: { top: 'nuts7_top', wrist: 'nuts7_wrist', spectro: 'nuts7_spectro', gripper: 'Gripper A' },
  };

  // The three cameras are one entangled recording of a single episode, so they share one progress bar
  // (driven by the top-camera video) instead of three independent ones.
  const sharedProgress = document.getElementById('sharedProgress');
  const sharedPlayed = sharedProgress?.querySelector('.video-progress-played');
  const sharedBuffered = sharedProgress?.querySelector('.video-progress-buffered');

  function wireSharedProgress(masterVideo, allVids) {
    const updatePlayed = () => { if (masterVideo.duration) sharedPlayed.style.width = `${masterVideo.currentTime / masterVideo.duration * 100}%`; };
    const updateBuffered = () => {
      if (masterVideo.buffered.length && masterVideo.duration) {
        const end = masterVideo.buffered.end(masterVideo.buffered.length - 1);
        sharedBuffered.style.width = `${Math.min(100, end / masterVideo.duration * 100)}%`;
      }
    };
    masterVideo.addEventListener('timeupdate', updatePlayed);
    masterVideo.addEventListener('progress', updateBuffered);
    masterVideo.addEventListener('loadedmetadata', () => { updatePlayed(); updateBuffered(); });
    masterVideo.addEventListener('seeked', updatePlayed);
    sharedProgress?.addEventListener('click', e => {
      if (!masterVideo.duration) return;
      const rect = sharedProgress.getBoundingClientRect();
      const t = (e.clientX - rect.left) / rect.width * masterVideo.duration;
      allVids.forEach(v => { v.currentTime = t; });
    });
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
    if (sharedPlayed) sharedPlayed.style.width = '0%';
    if (sharedBuffered) sharedBuffered.style.width = '0%';
    playAllBtn.classList.remove('is-playing');
    playAllBtn.querySelector('span').textContent = 'Play episode';
  }

  {
    const vids = camGrid3 ? [...camGrid3.querySelectorAll('video')] : [];
    if (vids[0]) wireSharedProgress(vids[0], vids);
  }

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

  function allVideos() { return [...camGrid3.querySelectorAll('video')]; }

  playAllBtn?.addEventListener('click', () => {
    const vids = allVideos();
    const playing = !playAllBtn.classList.contains('is-playing');
    if (playing) {
      vids.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
      playAllBtn.classList.add('is-playing');
      playAllBtn.querySelector('span').textContent = 'Pause episode';
    } else {
      vids.forEach(v => v.pause());
      playAllBtn.classList.remove('is-playing');
      playAllBtn.querySelector('span').textContent = 'Play episode';
    }
  });
  restartBtn?.addEventListener('click', () => {
    const vids = allVideos();
    vids.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
    playAllBtn.classList.add('is-playing');
    playAllBtn.querySelector('span').textContent = 'Pause episode';
  });
  camGrid3?.addEventListener('ended', e => {
    if (e.target.tagName !== 'VIDEO') return;
    if (allVideos().every(v => v.paused || v.ended)) {
      playAllBtn.classList.remove('is-playing');
      playAllBtn.querySelector('span').textContent = 'Play episode';
    }
  }, true);

  /* ---------------- Benchmark data ---------------- */
  // Per-sensor gripper photos, each with a red box pre-drawn around that specific sensor.
  const sensorPhoto = id => `assets/img/grippers/sensor-${id}.webp`;

  // seg = [EMPTY, SPACER, 7_SPACERS, 7_NUTS] correct placements out of 20 each; gf = grasp/handling failures out of 80.
  const GRIPPERS = {
    a: {
      label: 'Gripper A',
      desc: 'Reference gripper carrying an IEPE Dragonfly® strain sensor and an IEPE accelerometer, mounted on the upper jaw, mechanically coupled to but physically separated from the contact points.',
      sensors: [
        { id: 'dgf-acc', name: 'IEPE Dragonfly®', abbr: 'dgf', seg: [19, 9, 18, 16], gf: 8, note: 'Common reference sensor bonded to every gripper design to monitor dataset-level consistency.' },
        { id: 'acc', name: 'IEPE Accelerometer', abbr: 'acc', seg: [17, 19, 9, 12], gf: 6 },
        { id: 'notact', name: 'No Tactile Sensor', abbr: 'none', seg: [1, 4, 8, 6], gf: 9, note: 'Vision-only baseline — close to the 25% chance level for 4 classes.' },
      ],
    },
    b: {
      label: 'Gripper B',
      desc: 'The gripper was redesigned to place an IEPE load cell directly in the load path, measuring the resultant force transmitted through the structure.',
      sensors: [
        { id: 'dgf-ldc', name: 'IEPE Dragonfly®', abbr: 'dgf', seg: [14, 17, 12, 14], gf: 6 },
        { id: 'loadcell', name: 'IEPE Load Cell', abbr: 'ldc', seg: [12, 16, 11, 0], gf: 3, note: 'Measures transmitted force rather than local contact deformation; no true static response. Includes episodes where the box could not be delivered to a bin.' },
      ],
    },
    c: {
      label: 'Gripper C',
      desc: 'A four-sensor gripper comparing a passive (charge-output) Dragonfly®, a low-cost PZT disk, a MEMS accelerometer, and a metallic strain gauge, alongside the IEPE Dragonfly® reference.',
      sensors: [
        { id: 'dgf-frank', name: 'IEPE Dragonfly®', abbr: 'dgf', seg: [20, 17, 18, 9], gf: 2 },
        { id: 'dgf-passif', name: 'Passive Dragonfly®', abbr: 'dgfp', seg: [17, 11, 16, 10], gf: 7, note: 'Outputs charge directly — no sensor-side power needed.' },
        { id: 'pzt', name: 'PZT Disk', abbr: 'pzt', seg: [15, 16, 18, 10], gf: 2, note: 'Low-cost bulk PZT; brittle, with lead-oxide processing concerns.' },
        { id: 'acc-mems', name: 'MEMS Accelerometer', abbr: 'mems', seg: [20, 16, 18, 12], gf: 8, note: 'Best overall — limited by a resonance around 5 kHz.' },
        { id: 'strain-gauge', name: 'Metallic Strain Gauge', abbr: 'stg', seg: [8, 8, 15, 16], gf: 7, note: 'Captures static strain but shows broader confusion among plastic-content classes.' },
      ],
    },
  };

  const TEENSY = {
    label: 'Teensy 4.1 bench',
    desc: 'A low-cost acquisition chain (≈100 €) built from a ZONRI IEPE interface converter, a 16-bit ADS8688 ADC, and a Teensy 4.1 microcontroller — roughly 10× noisier than the Dewesoft bench, evaluated on a separately collected dataset. The paper reports all three low-cost sensors at ≈90% averaged success.',
    sensors: [
      { id: 'dgf-frank-cheap', name: 'IEPE Dragonfly®', abbr: 'dgf', seg: [19, 19, 17, 19], gf: 2, photo: sensorPhoto('dgf-frank') },
      { id: 'pzt-cheap', name: 'PZT Disk', abbr: 'pzt', seg: [12, 18, 17, 19], gf: 1, photo: sensorPhoto('pzt') },
      { id: 'acc-mems-cheap', name: 'MEMS Accelerometer', abbr: 'mems', seg: [20, 18, 17, 17], gf: 2, photo: sensorPhoto('acc-mems') },
    ],
  };

  const confmatSrc = id => `assets/img/confmat/${id}.webp`;

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
    'dgf-frank-cheap': { dataset: 'rollout_2026-09-10_cheap_shakeit_bench_dgf_iepe_20260910_140939', model: null },
    'pzt-cheap': { dataset: 'rollout_2026-09-10_cheap_shakeit_bench_pzt_disk_20260910_160409', model: null },
    'acc-mems-cheap': { dataset: 'rollout_2026-09-10_cheap_shakeit_bench_mems_acc_20260910_163759', model: null },
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
  const SEG_LABELS = ['Empty', 'Spacer', '7 Spacers', '7 Nuts'];

  let currentBench = 'opendaq';
  let currentSelection = { group: 'a', sensorId: 'dgf-acc' };

  const barChartEl = document.getElementById('barChart');
  const detailPanel = document.getElementById('detailPanel');
  const legendEl = document.getElementById('chartLegend');

  function renderLegend() {
    const items = [...SEG_LABELS.map((l, i) => [SEG_CLASSES[i], l]), ['seg-gf', 'Grasp / handling failure']];
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
      barChartEl.appendChild(buildGroup('teensy', TEENSY.label, TEENSY.sensors, true));
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

  function buildGroup(groupKey, label, sensors, showAxis) {
    const wrap = document.createElement('div');
    wrap.className = 'bar-group';

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
    lbl.textContent = label;
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
    const groupData = currentBench === 'opendaq' ? GRIPPERS[currentSelection.group] : TEENSY;
    if (!groupData) return;
    const sensor = groupData.sensors.find(s => s.id === currentSelection.sensorId) || groupData.sensors[0];
    if (!sensor) { detailPanel.innerHTML = ''; return; }
    updateBenchLinks(sensor.id);
    const success = sensor.seg.reduce((a, b) => a + b, 0);
    const pct = Math.floor(success / 80 * 100);
    const photo = sensor.photo || sensorPhoto(sensor.id);

    detailPanel.innerHTML = `
      <div class="detail-header">
        <h3>${sensor.name}</h3>
        <span class="detail-rate">${pct}%</span>
        <span class="detail-n">n = ${success}/80 successful placements, ${sensor.gf} grasp/handling failures</span>
      </div>
      <div class="detail-gripper-label">${groupData.label} — ${groupData.desc}</div>
      <div class="detail-left-col">
        <h4 class="detail-block-title">Gripper photo</h4>
        <div class="detail-photo-wrap">
          <img id="detailPhoto" src="${photo}" alt="Photo of ${groupData.label} with the ${sensor.name} highlighted" loading="lazy">
        </div>
        ${sensor.note ? `<p class="detail-note">${sensor.note}</p>` : ''}
      </div>
      <div class="detail-side">
        <div class="detail-side-block">
          <div class="detail-block-title-row">
            <h4 class="detail-block-title">Confusion matrix</h4>
            <span class="info-toggle-wrap">
              <button class="info-toggle" id="confmatInfoBtn" type="button" aria-expanded="false" title="How to read this">?</button>
              <p class="detail-confmat-caption" id="confmatCaption" hidden>Each row is the box's true contents (0 = Empty, 1 = 1 Spacer, 2 = 7 Spacers, 3 = 7 Nuts); each column is the bin the robot chose, and the diagonal is correct placements. Out of 80 episodes total, each row starts from 20 — sometimes fewer, when the box wasn't picked up or a grasp failure kept it from reaching a bin.</p>
            </span>
          </div>
          <img id="detailConfmat" src="${confmatSrc(sensor.id)}" alt="Confusion matrix for ${sensor.name}" loading="lazy">
        </div>
      </div>
    `;
    syncConfmatHeight();
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

  // Keep the confusion matrix the same height as the sensor photo, however tall that photo renders.
  let confmatResizeObserver = null;
  function syncConfmatHeight() {
    confmatResizeObserver?.disconnect();
    const photoImg = document.getElementById('detailPhoto');
    const confmatImg = document.getElementById('detailConfmat');
    if (!photoImg || !confmatImg || !('ResizeObserver' in window)) return;
    const apply = () => {
      const h = photoImg.getBoundingClientRect().height;
      if (h > 0) confmatImg.style.height = `${h}px`;
    };
    if (photoImg.complete) apply(); else photoImg.addEventListener('load', apply, { once: true });
    confmatResizeObserver = new ResizeObserver(apply);
    confmatResizeObserver.observe(photoImg);
  }

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
      currentSelection = { group: 'teensy', sensorId: 'dgf-frank-cheap' };
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
  document.getElementById('openFig2')?.addEventListener('click', () => {
    openLightbox('assets/img/figure2-results-overview.webp', 'Figure 2: full sensor benchmark results with gripper photos, success rates and confusion matrices');
  });
  document.getElementById('lightboxClose')?.addEventListener('click', () => { lightbox.hidden = true; });
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) lightbox.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hidden) lightbox.hidden = true; });

  /* ---------------- Attention section ---------------- */
  let attnBox = 'empty';
  let attnBand = '10khz';
  const attnImage = document.getElementById('attnImage');
  const ATTN_ALT = {
    empty: 'empty box', spacer1: '1 plastic spacer', spacer7: '7 plastic spacers', nuts7: '7 metallic nuts',
  };
  function updateAttnImage() {
    attnImage.src = `assets/img/attention/${attnBox}-${attnBand}.webp`;
    attnImage.alt = `Attention and scene-sensitivity maps for ${ATTN_ALT[attnBox]}, 0–${attnBand === '10khz' ? '10' : '100'} kHz`;
  }
  document.getElementById('attnBoxTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    attnBox = btn.dataset.abox;
    document.querySelectorAll('#attnBoxTabs button').forEach(b => b.classList.toggle('is-active', b === btn));
    updateAttnImage();
  });
  document.getElementById('attnBandwidth')?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    attnBand = btn.dataset.aband;
    document.querySelectorAll('#attnBandwidth button').forEach(b => b.classList.toggle('is-active', b === btn));
    updateAttnImage();
  });
})();
