let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';

// ↓ smaller chart scale but same center
const CHART2_CENTER_DX = 0;
const CHART2_CENTER_DY = 0;
const CHART_SCALE_FACTOR = 0.75; // 25% smaller

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* === Center & radius adjustment === */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  afterLayout(chart) {
    const opt = chart.config.options.fixedCenter;
    if (!opt?.enabled) return;
    const r = chart.scales.r;
    r.xCenter += (opt.dx ?? 0);
    r.yCenter += (opt.dy ?? 0);
    r.drawingArea *= CHART_SCALE_FACTOR;
  }
};

/* === Pentagon background + spokes === */
const radarBackgroundPlugin = {
  id: 'customPentagonBackground',
  beforeDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r;
    const ctx = chart.ctx;
    const cx = r.xCenter;
    const cy = r.yCenter;
    const radius = r.drawingArea;
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, '#f8fcff');
    gradient.addColorStop(0.25, '#92dfec');
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
    ctx.strokeStyle = '#184046';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Spokes
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#6db5c0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
};

/* === Axis Labels === */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    if (!chart?.config?.options?.outlinedLabels?.enabled) return;
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter;
    const cy = r.yCenter;
    const radius = r.drawingArea + 55;
    const base = -Math.PI / 2;

    ctx.save();
    ctx.resetTransform();
    ctx.beginPath();
    ctx.rect(0, 0, chart.canvas.width, chart.canvas.height);
    ctx.clip();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.lineWidth = 4;
    ctx.strokeStyle = chartColor;
    ctx.fillStyle = 'white';

    labels.forEach((label, i) => {
      const a = base + (i * 2 * Math.PI / labels.length);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });

    ctx.restore();
  }
};

/* === Chart Factory === */
function makeRadar(ctx, maxCap = null, showPoints = true, withBackground = false, fixed = false) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: 'transparent',
        borderColor: '#92dfec',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#92dfec',
        pointRadius: showPoints ? 5 : 0
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: { padding: { top: 90, right: 90, bottom: 90, left: 90 } },
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          suggestedMin: 0,
          suggestedMax: maxCap ?? undefined,
          ticks: { display: false },
          pointLabels: { display: false }
        }
      },
      customBackground: { enabled: withBackground },
      outlinedLabels: { enabled: true },
      fixedCenter: { enabled: fixed, dx: CHART2_CENTER_DX, dy: CHART2_CENTER_DY },
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin]
  });
}

/* === Chart 1 === */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, null, true, false, false);
});

/* === Update === */
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
  const fill = hexToRGBA(chartColor, 0.75);

  radar1.data.datasets[0].data = vals;
  radar1.data.datasets[0].borderColor = chartColor;
  radar1.data.datasets[0].backgroundColor = fill;
  radar1.update();

  if (radar2Ready) {
    radar2.data.datasets[0].data = capped;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }

  dispName.textContent = nameInput.value || '-';
  dispAbility.textContent = abilityInput.value || '-';
  dispLevel.textContent = levelInput.value || '-';
});

/* === Overlay === */
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  setTimeout(() => {
    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, 10, false, true, true);
      radar2Ready = true;
    } else radar2.resize();

    const vals = [
      parseFloat(powerInput.value) || 0,
      parseFloat(speedInput.value) || 0,
      parseFloat(trickInput.value) || 0,
      parseFloat(recoveryInput.value) || 0,
      parseFloat(defenseInput.value) || 0
    ].map(v => Math.min(v, 10));

    const fill = hexToRGBA(chartColor, 0.75);
    radar2.data.datasets[0].data = vals;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }, 150);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === Download === */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';
  html2canvas(characterBox).then(canvas => {
    const link = document.createElement('a');
    link.download = 'character_chart.png';
    link.href = canvas.toDataURL();
    link.click();
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});

/* === Upload === */
imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});
