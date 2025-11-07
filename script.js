let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';

/* Centers and radii (smaller now) */
const CHART1_CENTER = { x: 225, y: 225 };
const CHART2_CENTER = { x: 250, y: 250 };
const CHART1_RADIUS = 120; // smaller
const CHART2_RADIUS = 130; // smaller for overlay

/* Utility */
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Fixed background plugin */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  beforeDraw(chart) {
    const opt = chart.config.options.fixedCenter;
    if (!opt?.enabled) return;
    const ctx = chart.ctx;
    const labels = chart.data.labels;
    const cx = opt.centerX;
    const cy = opt.centerY;
    const radius = opt.radius;
    const N = labels.length;
    const start = -Math.PI / 2;

    // Gradient background (if enabled)
    if (opt.background) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, '#f8fcff');
      grad.addColorStop(0.25, '#92dfec');
      grad.addColorStop(1, '#92dfec');
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = start + (i * 2 * Math.PI / N);
        const x = cx + radius * Math.cos(a);
        const y = cy + radius * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#184046';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    chart.centerPoint = { cx, cy, radius };
  }
};

/* Outlined Labels */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const labels = chart.data.labels;
    const { cx, cy, radius } = chart.centerPoint;
    const base = -Math.PI / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.lineWidth = 4;
    ctx.strokeStyle = chartColor;
    ctx.fillStyle = 'white';
    labels.forEach((label, i) => {
      const a = base + (i * 2 * Math.PI / labels.length);
      const x = cx + (radius + 30) * Math.cos(a);
      const y = cy + (radius + 30) * Math.sin(a);
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* Create Radar Chart */
function makeRadar(ctx, fixedOpts, interactive = true) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        borderColor: chartColor,
        backgroundColor: hexToRGBA(chartColor, 0.75),
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: chartColor,
        pointRadius: interactive ? 5 : 0
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      events: interactive ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'] : [],
      scales: {
        r: {
          grid: { display: false },
          angleLines: { display: false },
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { display: false }
        }
      },
      fixedCenter: fixedOpts,
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, outlinedLabelsPlugin]
  });
}

/* Chart 1 */
window.addEventListener('load', () => {
  radar1 = makeRadar(document.getElementById('radarChart1').getContext('2d'), {
    enabled: true,
    centerX: CHART1_CENTER.x,
    centerY: CHART1_CENTER.y,
    radius: CHART1_RADIUS,
    background: false
  });
});

/* Update Button */
updateBtn.addEventListener('click', () => {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ].map(v => Math.min(v, 10));
  chartColor = colorPicker.value;
  const fill = hexToRGBA(chartColor, 0.75);

  radar1.data.datasets[0].data = vals;
  radar1.data.datasets[0].borderColor = chartColor;
  radar1.data.datasets[0].backgroundColor = fill;
  radar1.update();

  if (radar2Ready) {
    radar2.data.datasets[0].data = vals;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }

  dispName.textContent = nameInput.value || '-';
  dispAbility.textContent = abilityInput.value || '-';
  dispLevel.textContent = levelInput.value || '-';
});

/* Overlay */
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  setTimeout(() => {
    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, {
        enabled: true,
        centerX: CHART2_CENTER.x,
        centerY: CHART2_CENTER.y,
        radius: CHART2_RADIUS,
        background: true
      }, false); // non-interactive
      radar2Ready = true;
    } else radar2.resize();

    const vals = [
      +powerInput.value || 0,
      +speedInput.value || 0,
      +trickInput.value || 0,
      +recoveryInput.value || 0,
      +defenseInput.value || 0
    ].map(v => Math.min(v, 10));
    const fill = hexToRGBA(chartColor, 0.75);

    radar2.data.datasets[0].data = vals;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }, 150);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* Download (hide buttons) */
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

/* Image Upload */
imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});
