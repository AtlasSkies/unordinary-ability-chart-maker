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
    gradient.addColorStop(0.33, BASE_COLOR);
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
    ctx.strokeStyle = '#35727d';
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
    ctx.strokeStyle = '#184046';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
};

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
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      const a = base + (i * 2 * Math.PI / labels.length);
      const x = cx + baseRadius * Math.cos(a);
      let y = cy + baseRadius * Math.sin(a);
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
    ctx.fillStyle = 'black';
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
          angleLines: { color: '#6db5c0', lineWidth: 1 },
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
  const canvas = document.createElement('canvas');
  canvas.className = 'layer';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.zIndex = charts.length + '';
  chartArea.appendChild(canvas);

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
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          min: 0,
          max: 10,              // popup stays out of 10
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
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
