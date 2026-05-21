/*************************
 * GLOBAL STATE
 *************************/
let charts = [];
let activeIndex = 0;
let radarPopup = null;

const BASE_COLOR = '#92dfec';
const FILL_ALPHA = 0.65;

/*************************
 * HELPERS
 *************************/
function hexToRGBA(hex, alpha) {
  if (!hex) hex = BASE_COLOR;
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeConicGradient(chart, axisColors, alpha = FILL_ALPHA) {
  const r = chart.scales.r;
  const ctx = chart.ctx;
  const grad = ctx.createConicGradient(-Math.PI / 2, r.xCenter, r.yCenter);
  const N = axisColors.length;
  for (let i = 0; i <= N; i++) grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  return grad;
}

/*************************
 * PLUGINS
 *************************/
const radarBackgroundPlugin = {
  id: 'customPentagonBackground',
  beforeDatasetsDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r, ctx = chart.ctx;
    const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
    const N = chart.data.labels.length, start = -Math.PI / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, '#f8fcff');
    gradient.addColorStop(0.4, BASE_COLOR);
    gradient.addColorStop(1, BASE_COLOR);

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r, ctx = chart.ctx;
    const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
    const N = chart.data.labels.length, start = -Math.PI / 2;

    ctx.save();
    // inner radial lines
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
    }
    const isPopup = chart.canvas.closest('#overlay') !== null;
    ctx.strokeStyle = isPopup ? 'rgba(0,0,0,0.25)' : '#4a9aab';
    ctx.lineWidth = 1;
    ctx.stroke();

    // outer pentagon
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = isPopup ? '#1a1a1a' : '#92dfec';
    ctx.lineWidth = isPopup ? 3.5 : 3;
    ctx.stroke();
    ctx.restore();
  }
};

// Returns perceived luminance 0–1 from a hex color
function colorLuminance(hex) {
  if (!hex || !hex.startsWith('#')) return 0.5;
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  // sRGB luminance
  const toLinear = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  return 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b);
}

const axisTitlesPlugin = {
  id: 'axisTitles',
  afterDraw(chart) {
    const ctx = chart.ctx,
      r = chart.scales.r,
      labels = chart.data.labels;
    if (!labels) return;

    // Use Chart 1's ability color for all axis titles (main + popup)
    const firstColor =
      (charts && charts.length > 0 && charts[0].color) ? charts[0].color : BASE_COLOR;

    // If the color is dark (luminance below 0.35), use white text fill so it's readable
    const lum = colorLuminance(firstColor);
    const textFill = lum < 0.35 ? '#ffffff' : '#1e3540';

    const isPopup = chart.canvas.closest('#overlay') !== null;
    const cx = r.xCenter,
      cy = r.yCenter,
      base = -Math.PI / 2,
      baseRadius = r.drawingArea * 1.1;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = firstColor;
    ctx.fillStyle = textFill;
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      const a = base + (i * 2 * Math.PI / labels.length);
      // Extra push-out for bottom labels on popup to avoid overlap
      const extraR = isPopup && (i === 2 || i === 3) ? r.drawingArea * 0.18 : 0;
      const labelR = baseRadius + extraR;
      const x = cx + labelR * Math.cos(a);
      let y = cy + labelR * Math.sin(a);
      if (i === 0) y -= 5;
      if (isPopup && (i === 1 || i === 4)) y -= 25;
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

const globalValueLabelsPlugin = {
  id: 'globalValueLabels',
  afterDraw(chart) {
    // Don't draw on popup chart
    if (chart.canvas.closest('#overlay')) return;

    const ctx = chart.ctx,
      r = chart.scales.r,
      labels = chart.data.labels,
      cx = r.xCenter,
      cy = r.yCenter,
      base = -Math.PI / 2,
      baseRadius = r.drawingArea * 1.1,
      offset = 20;

    const axes = labels.length;
    const maxPerAxis = new Array(axes).fill(0);

    charts.forEach(c => {
      for (let i = 0; i < axes; i++) {
        maxPerAxis[i] = Math.max(maxPerAxis[i], c.stats[i] || 0);
      }
    });

    ctx.save();
    ctx.font = '15px Candara';
    ctx.fillStyle = '#2e99ae';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    labels.forEach((_, i) => {
      const angle = base + (i * 2 * Math.PI / axes);
      const x = cx + (baseRadius + offset) * Math.cos(angle);
      let y = cy + (baseRadius + offset) * Math.sin(angle);
      if (i === 0 || i === 1 || i === 4) y += 20;
      const val = Math.round(maxPerAxis[i] * 100) / 100;
      ctx.fillText(`(${val})`, x, y);
    });

    ctx.restore();
  }
};

/*************************
 * CHART CREATION
 *************************/
function makeRadar(ctx, color, withBackground = false) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: hexToRGBA(color, FILL_ALPHA),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: color,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          min: 0,
          max: 10, // will be overridden dynamically in refreshAll()
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#3a6878', lineWidth: 1 },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: withBackground },
      plugins: { legend: { display: false } }
    },
    plugins: [axisTitlesPlugin, radarBackgroundPlugin, globalValueLabelsPlugin]
  });
}

/*************************
 * DOM
 *************************/
const chartArea = document.getElementById('chartArea'),
  addChartBtn = document.getElementById('addChartBtn'),
  chartButtons = document.getElementById('chartButtons'),
  powerInput = document.getElementById('powerInput'),
  speedInput = document.getElementById('speedInput'),
  trickInput = document.getElementById('trickInput'),
  recoveryInput = document.getElementById('recoveryInput'),
  defenseInput = document.getElementById('defenseInput'),
  colorPicker = document.getElementById('colorPicker'),
  multiColorBtn = document.getElementById('multiColorBtn'),
  axisColorsDiv = document.getElementById('axisColors'),
  axisColorPickers = [
    document.getElementById('powerColor'),
    document.getElementById('speedColor'),
    document.getElementById('trickColor'),
    document.getElementById('recoveryColor'),
    document.getElementById('defenseColor')
  ],
  viewBtn = document.getElementById('viewBtn'),
  overlay = document.getElementById('overlay'),
  closeBtn = document.getElementById('closeBtn'),
  downloadBtn = document.getElementById('downloadBtn'),
  uploadedImg = document.getElementById('uploadedImg'),
  imgInput = document.getElementById('imgInput'),
  overlayImg = document.getElementById('overlayImg'),
  overlayName = document.getElementById('overlayName'),
  overlayAbility = document.getElementById('overlayAbility'),
  overlayLevel = document.getElementById('overlayLevel'),
  nameInput = document.getElementById('nameInput'),
  abilityInput = document.getElementById('abilityInput'),
  levelInput = document.getElementById('levelInput');

/*************************
 * INIT
 *************************/
window.addEventListener('load', () => {
  addChart();
  selectChart(0);
  refreshAll();
});

/*************************
 * ADD / SELECT
 *************************/
function addChart() {
  // Ensure the square inner wrapper exists
  let inner = chartArea.querySelector('.chart-inner');
  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'chart-inner';
    chartArea.appendChild(inner);
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'layer';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.zIndex = charts.length + '';
  inner.appendChild(canvas);

  const color =
    charts.length === 0
      ? BASE_COLOR
      : `hsl(${Math.floor(Math.random() * 360)},70%,55%)`;

  const chart = makeRadar(canvas.getContext('2d'), color, false);
  const cObj = {
    chart,
    canvas,
    color,
    stats: [0, 0, 0, 0, 0],
    multi: false,
    axis: axisColorPickers.map(p => p.value)
  };

  charts.push(cObj);

  const idx = charts.length - 1;
  const btn = document.createElement('button');
  btn.textContent = `Select Chart ${idx + 1}`;
  btn.addEventListener('click', () => selectChart(idx));
  chartButtons.appendChild(btn);
}

function selectChart(index) {
  activeIndex = index;
  chartButtons.querySelectorAll('button').forEach((b, i) => {
    b.style.backgroundColor = i === index ? '#6db5c0' : '#92dfec';
    b.style.color = i === index ? '#fff' : '#000';
  });

  const c = charts[index];
  [powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach(
    (el, i) => (el.value = c.stats[i])
  );
  colorPicker.value = c.color;
  multiColorBtn.textContent = c.multi ? 'Single-color' : 'Multi-color';
  axisColorsDiv.style.display = c.multi ? 'flex' : 'none';
}

/*************************
 * UPDATE
 *************************/
function refreshAll() {
  // Find the highest stat across all charts
  let globalMax = 0;
  charts.forEach(obj => {
    obj.stats.forEach(v => {
      if (v > globalMax) globalMax = v;
    });
  });

  // Main radar scale: at least 10, otherwise up to the highest stat
  const rMax = Math.max(10, globalMax);

  charts.forEach(obj => {
    const ds = obj.chart.data.datasets[0];
    const fill = obj.multi
      ? makeConicGradient(obj.chart, obj.axis, FILL_ALPHA)
      : hexToRGBA(obj.color, FILL_ALPHA);

    // Don't cap at 10 for the main chart; just ensure non-negative
    ds.data = obj.stats.map(v => (v < 0 ? 0 : v));

    ds.borderColor = obj.color;
    ds.pointBorderColor = obj.color;
    ds.backgroundColor = fill;

    // Apply dynamic scale only to main charts
    obj.chart.options.scales.r.min = 0;
    obj.chart.options.scales.r.max = rMax;

    obj.chart.update();
  });
}

function refreshActiveFromInputs() {
  const c = charts[activeIndex];
  c.stats = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  c.color = colorPicker.value;
  c.axis = axisColorPickers.map(p => p.value);
  refreshAll();
}

/*************************
 * LISTENERS
 *************************/
addChartBtn.addEventListener('click', addChart);

[powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach(el =>
  el.addEventListener('input', refreshActiveFromInputs)
);

colorPicker.addEventListener('input', () => {
  charts[activeIndex].color = colorPicker.value;
  refreshAll();
});

axisColorPickers.forEach(p =>
  p.addEventListener('input', () => {
    if (charts[activeIndex].multi) {
      charts[activeIndex].axis = axisColorPickers.map(p => p.value);
      refreshAll();
    }
  })
);

multiColorBtn.addEventListener('click', () => {
  const c = charts[activeIndex];
  c.multi = !c.multi;
  multiColorBtn.textContent = c.multi ? 'Single-color' : 'Multi-color';
  axisColorsDiv.style.display = c.multi ? 'flex' : 'none';
  refreshAll();
});

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => (uploadedImg.src = ev.target.result);
  r.readAsDataURL(file);
});

/*************************
 * POPUP
 *************************/
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  const ctx = document.getElementById('overlayChartCanvas').getContext('2d');

  const ds = charts.map(c => ({
    data: c.stats.map(v => Math.min(v, 10)), // popup always capped at 10
    backgroundColor: hexToRGBA(c.color, FILL_ALPHA),
    borderColor: c.color,
    borderWidth: 2,
    pointRadius: 0
  }));

  if (radarPopup) radarPopup.destroy();
  radarPopup = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: ds
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 36, bottom: 36, left: 36, right: 36 } },
      scales: {
        r: {
          min: 0,
          max: 10,              // popup stays out of 10
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#3a6878', lineWidth: 1 },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: true },
      plugins: { legend: { display: false } }
    },
    plugins: [radarBackgroundPlugin, axisTitlesPlugin]
  });

  requestAnimationFrame(() => {
    radarPopup.data.datasets.forEach((dataset, i) => {
      const src = charts[i];
      dataset.backgroundColor = src.multi
        ? makeConicGradient(radarPopup, src.axis, FILL_ALPHA)
        : hexToRGBA(src.color, FILL_ALPHA);
    });
    radarPopup.update();
  });
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/*************************
 * DOWNLOAD (guaranteed)
 *************************/
downloadBtn.addEventListener('click', async () => {
  const box = document.getElementById('characterBox');
  window.scrollTo(0, 0);
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';

  await html2canvas(box, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    logging: false
  }).then(canvas => {
    const link = document.createElement('a');
    const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
    link.download = `${cleanName}_CharacterChart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  downloadBtn.style.visibility = 'visible';
  closeBtn.style.visibility = 'visible';
});

/*************************
 * DOWNLOAD GIF
 *************************/
document.getElementById('downloadGifBtn').addEventListener('click', async () => {
  const btn = document.getElementById('downloadGifBtn');
  btn.textContent = 'Generating…';
  btn.disabled = true;

  // Animation params
  const DURATION_MS  = 1000;   // grow animation: 1 second
  const REPEAT_DELAY = 5000;   // pause between loops (GIF delay on last frame)
  const FPS          = 30;
  const TOTAL_FRAMES = Math.round(FPS * (DURATION_MS / 1000));
  const SIZE         = 500;    // off-screen canvas size

  // easeOutCubic: fast start, slow end
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // Grab current chart data
  const targetStats = charts.map(c => c.stats.map(v => Math.min(v, 10)));
  const colors      = charts.map(c => c.color);
  const axisColors  = charts.map(c => c.axis);
  const multiFlags  = charts.map(c => c.multi);

  // Create an off-screen canvas + a temporary Chart.js radar chart
  const offCanvas = document.createElement('canvas');
  offCanvas.width  = SIZE;
  offCanvas.height = SIZE;
  const offCtx = offCanvas.getContext('2d');

  // Build datasets at fraction 0
  function buildDatasets(fraction) {
    return targetStats.map((stats, ci) => ({
      data: stats.map(v => v * fraction),
      backgroundColor: hexToRGBA(colors[ci], FILL_ALPHA),
      borderColor: colors[ci],
      borderWidth: 2,
      pointRadius: 0
    }));
  }

  // Build the off-screen chart once
  let offChart = new Chart(offCtx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: buildDatasets(0)
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 48, bottom: 48, left: 48, right: 48 } },
      scales: {
        r: {
          min: 0, max: 10,
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#3a6878', lineWidth: 1 },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: true },
      plugins: { legend: { display: false } }
    },
    plugins: [radarBackgroundPlugin, axisTitlesPlugin]
  });

  // gif.js setup — use inline worker source to avoid CORS issues with CDN
  const gif = new GIF({
    workers: 2,
    quality: 8,
    width: SIZE,
    height: SIZE,
    workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    repeat: 0  // loop forever (delay handled by last frame)
  });

  // Render each frame
  for (let f = 0; f <= TOTAL_FRAMES; f++) {
    const t        = f / TOTAL_FRAMES;
    const fraction = easeOutCubic(t);

    // Update datasets
    offChart.data.datasets = buildDatasets(fraction);

    // Apply multi-color gradients after chart renders
    offChart.data.datasets.forEach((ds, ci) => {
      if (multiFlags[ci]) {
        ds.backgroundColor = makeConicGradient(offChart, axisColors[ci], FILL_ALPHA);
      }
    });

    offChart.update('none');  // no animation, instant

    // White background for GIF frame
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width  = SIZE;
    frameCanvas.height = SIZE;
    const fc = frameCanvas.getContext('2d');
    fc.fillStyle = '#ffffff';
    fc.fillRect(0, 0, SIZE, SIZE);
    fc.drawImage(offCanvas, 0, 0);

    // Last frame gets the long pause (repeat delay); others get normal frame delay
    const delay = f === TOTAL_FRAMES ? REPEAT_DELAY : Math.round(1000 / FPS);
    gif.addFrame(fc, { copy: true, delay });
  }

  offChart.destroy();

  gif.on('finished', blob => {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const name = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
    link.download = name + '_AbilityChart.gif';
    link.href     = url;
    link.click();
    URL.revokeObjectURL(url);

    btn.textContent = '⚡ Download GIF';
    btn.disabled    = false;
  });

  gif.render();
});
