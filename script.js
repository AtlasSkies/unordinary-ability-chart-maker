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

/**
 * Get the color that axis titles should use.
 * Always use the selected ability color of the FIRST chart (charts[0]),
 * falling back to BASE_COLOR if needed.
 */
function getFirstAbilityColor() {
  if (Array.isArray(charts) && charts.length > 0) {
    return charts[0].color || BASE_COLOR;
  }
  return BASE_COLOR;
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

    const isPopup = chart.canvas.closest('#overlay') !== null;
    const cx = r.xCenter,
      cy = r.yCenter,
      base = -Math.PI / 2,
      baseRadius = r.drawingArea * 1.1;

    // 🔹 Use the first chart's ability color for all axis titles
    const axisColor = getFirstAbilityColor();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = axisColor;   // <- was '#8747e6'
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
      for (let i = 0; i < axes; i++)
        maxPerAxis[i] = Math.max(maxPerAxis[i], c.stats[i] || 0);
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
          max: 10,
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

/* … the rest of your code (addChart, selectChart, refreshAll, popup, etc.) stays the same … */
