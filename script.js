let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';

const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const colorPicker = document.getElementById('colorPicker');

/* =========================
   CENTER CONTROL (Chart 2)
   =========================
   You can tweak these to nudge the chart’s true center.
   They are in CANVAS PIXELS relative to the radar canvas.
*/
const CHART2_CENTER_DX = 0;     // left/right nudge
const CHART2_CENTER_DY = 12;    // downwards nudge

/* ===== Plugin: fix the radar scale center to a specific anchor ===== */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  afterLayout(chart) {
    const opt = chart?.config?.options?.fixedCenter;
    if (!opt?.enabled) return;

    const rScale = chart.scales.r;
    if (!rScale) return;

    // Default to computed center if x/y not provided, then apply dx/dy.
    const canvas = chart.canvas;
    const desiredX = (opt.x ?? rScale.xCenter) + (opt.dx ?? 0);
    const desiredY = (opt.y ?? rScale.yCenter) + (opt.dy ?? 0);

    // Overwrite the internal center used by the scale (and thus the dataset)
    rScale.xCenter = desiredX;
    rScale.yCenter = desiredY;
  }
};

/* ===== Plugin: draw gradient pentagon + spokes using the same center ===== */
const radarBackgroundPlugin = {
  id: 'customPentagonBackground',
  beforeDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;

    const rScale = chart.scales.r;
    const ctx = chart.ctx;

    // Use the scale's (possibly overridden) true center/radius
    const centerX = rScale.xCenter;
    const centerY = rScale.yCenter;
    const radius = rScale.drawingArea;
    const totalPoints = chart.data.labels.length;
    const angleOffset = -Math.PI / 2; // top

    // Gradient (f8fcff -> 92dfec @ 25%)
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, '#f8fcff');
    gradient.addColorStop(0.25, '#92dfec');
    gradient.addColorStop(1, '#92dfec');

    ctx.save();

    // Pentagon background (max = 10 boundary)
    ctx.beginPath();
    for (let i = 0; i < totalPoints; i++) {
      const angle = angleOffset + (i * 2 * Math.PI / totalPoints);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#184046';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Spokes meeting corners
    ctx.beginPath();
    for (let i = 0; i < totalPoints; i++) {
      const angle = angleOffset + (i * 2 * Math.PI / totalPoints);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#6db5c0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
};

/* ===== Plugin: outlined (stroke) + white-filled point labels ===== */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    if (!chart?.config?.options?.outlinedLabels?.enabled) return;

    const ctx = chart.ctx;
    const rScale = chart.scales.r;
    const labels = chart.data.labels;
    const total = labels.length;
    const centerX = rScale.xCenter;
    const centerY = rScale.yCenter;

    // place labels slightly beyond the radius
    const radius = rScale.drawingArea + 20;
    const baseAngle = -Math.PI / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 16px Candara';
    ctx.lineWidth = 4;
    ctx.strokeStyle = chartColor;  // outline = chosen ability color
    ctx.fillStyle = 'white';       // inside = white

    for (let i = 0; i < total; i++) {
      const angle = baseAngle + (i * 2 * Math.PI / total);
      const x = centerX + (radius * Math.cos(angle));
      const y = centerY + (radius * Math.sin(angle));
      const label = labels[i];
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    }
    ctx.restore();
  }
};

function makeRadar(ctx, maxCap = null, showPoints = true, withBackground = false, useFixedCenter = false) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: 'transparent', // set on update
        borderColor: '#92dfec',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#92dfec',
        pointRadius: showPoints ? 5 : 0
      }]
    },
    options: {
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          suggestedMin: 0,
          suggestedMax: maxCap ?? undefined,
          ticks: { display: false },
          pointLabels: { display: false } // we draw our own labels
        }
      },
      customBackground: { enabled: withBackground },
      outlinedLabels: { enabled: true },
      fixedCenter: {
        enabled: useFixedCenter,
        // anchor at the natural center, but nudge by dx/dy
        x: null,
        y: null,
        dx: CHART2_CENTER_DX,
        dy: CHART2_CENTER_DY
      },
      plugins: { legend: { display: false } },
      animation: { duration: 400 },
      responsive: true,
      maintainAspectRatio: false
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin]
  });
}

/* ========== Chart 1 (main) – transparent background ========== */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, null, true, false, false);
});

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ========== Update button ========== */
document.getElementById('updateBtn').addEventListener('click', () => {
  const vals = [
    parseFloat(powerInput.value) || 0,
    parseFloat(speedInput.value) || 0,
    parseFloat(trickInput.value) || 0,
    parseFloat(recoveryInput.value) || 0,
    parseFloat(defenseInput.value) || 0
  ];
  const capped = vals.map(v => Math.min(v, 10));
  chartColor = colorPicker.value;
  const fillColor = hexToRGBA(chartColor, 0.75);

  radar1.data.datasets[0].data = vals;
  radar1.data.datasets[0].borderColor = chartColor;
  radar1.data.datasets[0].backgroundColor = fillColor;
  radar1.update();

  if (radar2Ready) {
    radar2.data.datasets[0].data = capped;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fillColor;
    radar2.update();
  }

  document.getElementById('dispName').textContent = nameInput.value || '-';
  document.getElementById('dispAbility').textContent = abilityInput.value || '-';
  document.getElementById('dispLevel').textContent = levelInput.value || '-';
});

/* ========== Overlay controls ========== */
const overlay = document.getElementById('overlay');
const viewBtn = document.getElementById('viewBtn');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');

viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');

  document.getElementById('overlayImg').src = document.getElementById('uploadedImg').src || '';
  document.getElementById('overlayName').textContent = nameInput.value || '-';
  document.getElementById('overlayAbility').textContent = abilityInput.value || '-';
  document.getElementById('overlayLevel').textContent = levelInput.value || '-';

  setTimeout(() => {
    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      // withBackground + useFixedCenter TRUE for Chart 2
      radar2 = makeRadar(ctx2, 10, false, true, true);
      radar2Ready = true;
    } else {
      radar2.resize();
    }

    const vals = [
      parseFloat(powerInput.value) || 0,
      parseFloat(speedInput.value) || 0,
      parseFloat(trickInput.value) || 0,
      parseFloat(recoveryInput.value) || 0,
      parseFloat(defenseInput.value) || 0
    ].map(v => Math.min(v, 10));

    const fillColor = hexToRGBA(chartColor, 0.75);
    radar2.data.datasets[0].data = vals;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fillColor;
    radar2.update();
  }, 150);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

downloadBtn.addEventListener('click', () => {
  html2canvas(document.getElementById('characterBox')).then(canvas => {
    const link = document.createElement('a');
    link.download = 'character_chart.png';
    link.href = canvas.toDataURL();
    link.click();
  });
});

/* ========== Image upload ========== */
document.getElementById('imgInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('uploadedImg').src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
