let radar1, radar2;
let radar2Ready = false;
let chartColor = 'rgb(135, 71, 230)';

const CHART1_CENTER = { x: 247, y: 250 };
const CHART_SCALE_FACTOR = 1.0;
const CHART_SIZE_MULTIPLIER = 1.0;

function hexToRGBA(hex, alpha) {
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* === FIXED CENTER === */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  beforeLayout(chart) {
    const opt = chart.config.options.fixedCenter;
    if (!opt?.enabled) return;
    const r = chart.scales.r;
    if (opt.centerX && opt.centerY) {
      r.xCenter = opt.centerX;
      r.yCenter = opt.centerY;
    }
  }
};

/* === BACKGROUND + SPOKES === */
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
    gradient.addColorStop(0.33, '#92dfec');
    gradient.addColorStop(1, '#92dfec');

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

/* === OUTLINED LABELS (Speed & Defense slightly lowered) === */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const isOverlayChart = chart.canvas.id === 'radarChart2';
    const baseRadius = r.drawingArea * 1.1;
    const extendedRadius = r.drawingArea * 1.15;
    const base = -Math.PI / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = chartColor;
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      let angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      if (isOverlayChart && (i === 1 || i === 4)) radiusToUse = extendedRadius;
      const x = cx + radiusToUse * Math.cos(angle);
      let y = cy + radiusToUse * Math.sin(angle);

      if (i === 0) y -= 5;
      if (isOverlayChart && (i === 1 || i === 4)) y -= 42; // lowered slightly from -48 → -42

      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* === NUMERIC LABELS (Speed & Defense slightly lowered) === */
const inputValuePlugin = {
  id: 'inputValuePlugin',
  afterDraw(chart) {
    if (chart.config.options.customBackground.enabled) return;
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const baseRadius = r.drawingArea * 1.1;
    const base = -Math.PI / 2;
    const offset = 20;
    ctx.save();
    ctx.font = '15px Candara';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    labels.forEach((label, i) => {
      const angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      if (chart.canvas.id === 'radarChart2' && (i === 1 || i === 4)) radiusToUse = r.drawingArea * 1.15;
      const x = cx + (radiusToUse + offset) * Math.cos(angle);
      let y = cy + (radiusToUse + offset) * Math.sin(angle);

      if (i === 0) y -= 20;
      if (chart.canvas.id === 'radarChart2') {
        if (i === 1 || i === 4) y -= 22; // lowered slightly from -28 → -22
      } else {
        if (i === 1) y += 20;
        if (i === 4) y += 20;
      }
      ctx.fillText(`(${data[i] || 0})`, x, y);
    });
    ctx.restore();
  }
};

/* === CHART CREATOR === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: hexToRGBA(chartColor, 0.65),
        borderColor: chartColor,
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: chartColor,
        pointRadius: showPoints ? 5 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: withBackground },
      fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin, inputValuePlugin]
  });
}

/* === DOM ELEMENTS === */
const viewBtn = document.getElementById('viewBtn');
const imgInput = document.getElementById('imgInput');
const uploadedImg = document.getElementById('uploadedImg');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const colorPicker = document.getElementById('colorPicker');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');

/* === MAIN CHART === */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, true, false, CHART1_CENTER);
  colorPicker.value = chartColor;
  chartColor = colorPicker.value || chartColor;
  updateCharts();
});

/* === UPDATE === */
function updateCharts() {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  const maxVal = Math.max(...vals, 10);
  radar1.options.scales.r.suggestedMax = maxVal;
  const capped = vals.map(v => Math.min(v, 10));
  chartColor = colorPicker.value || chartColor;
  const fill = hexToRGBA(chartColor, 0.65);

  if (radar1) {
    radar1.data.datasets[0].data = vals;
    radar1.data.datasets[0].borderColor = chartColor;
    radar1.data.datasets[0].backgroundColor = fill;
    radar1.update();
  }

  if (radar2Ready && radar2) {
    radar2.data.datasets[0].data = capped;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }
}

/* === INPUT LISTENERS === */
[powerInput, speedInput, trickInput, recoveryInput, defenseInput, colorPicker]
  .forEach(el => {
    el.addEventListener('input', updateCharts);
    el.addEventListener('change', updateCharts);
  });

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});

/* === OVERLAY === */
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  setTimeout(() => {
    const img = document.getElementById('overlayImg');
    const textBox = document.querySelector('.text-box');
    const overlayChart = document.querySelector('.overlay-chart');
    const imgHeight = img.offsetHeight;
    const textHeight = textBox.offsetHeight;
    const targetSize = (imgHeight + textHeight) * CHART_SIZE_MULTIPLIER;

    overlayChart.style.height = `${targetSize}px`;
    overlayChart.style.width = `${targetSize}px`;

    const existingWatermark = document.querySelector('.image-section .watermark-image');
    if (!existingWatermark) {
      const wm = document.createElement('div');
      wm.textContent = 'AS';
      wm.className = 'watermark-image';
      Object.assign(wm.style, {
        position: 'absolute',
        bottom: '8px',
        left: '10px',
        fontFamily: 'Candara',
        fontWeight: 'bold',
        fontSize: '6px',
        color: 'rgba(0,0,0,0.15)',
        pointerEvents: 'none',
        zIndex: '2'
      });
      document.querySelector('.image-section').appendChild(wm);
    }

    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, false, true, { x: targetSize / 2, y: targetSize / 2 });
      radar2.options.scales.r.suggestedMax = 10;
      radar2Ready = true;
    } else {
      radar2.resize();
    }
    updateCharts();
  }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === ALWAYS DOWNLOAD HORIZONTAL LAYOUT === */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';

  const box = document.getElementById('characterBox');
  const originalFlex = box.style.flexDirection;
  const originalWidth = box.style.width;
  const originalHeight = box.style.height;

  box.style.flexDirection = 'row';
  box.style.width = '52vw';
  box.style.height = '64vh';
  box.style.maxHeight = 'none';
  box.style.overflow = 'visible';

  html2canvas(box, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
    link.download = `${cleanName}_CharacterChart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    box.style.flexDirection = originalFlex;
    box.style.width = originalWidth;
    box.style.height = originalHeight;

    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});
