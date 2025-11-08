let radar1, radar2;
let chartColor = '#92dfec';

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* === PLUGINS === */

// Axis labels + values for MAIN chart
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    if (chart.canvas.id !== 'radarChart1') return;
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    // FIX: Get the true input values (no cap)
    const values = getStatValues(); 
    // Adjust base radius to give space for new label position
    const baseRadius = r.drawingArea * 1.05; 
    const base = -Math.PI / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((label, i) => {
      let a = base + (i * 2 * Math.PI / labels.length);
      // Custom angle adjustments for better label positioning on a pentagon
      if (label === 'Defense') { a -= 0.04; } 
      else if (label === 'Speed') { a += 0.04; }

      const x = r.xCenter + baseRadius * Math.cos(a);
      const y = r.yCenter + baseRadius * Math.sin(a);

      // --- 1. Draw Axis Title (White text, color outline) ---
      ctx.font = '18px Candara';
      ctx.strokeStyle = chartColor; 
      ctx.fillStyle = 'white';
      ctx.lineWidth = 4;
      // Position title slightly above the center point
      ctx.strokeText(label, x, y - 5);
      ctx.fillText(label, x, y - 5);

      // --- 2. Draw Value in Parentheses (Black text, italic, UNDER title) ---
      ctx.font = 'italic 14px Candara';
      ctx.fillStyle = '#000000'; // FIX: Black text
      ctx.lineWidth = 1; // Reset line width for black fill text
      const val = isNaN(values[i]) ? 0.0 : values[i].toFixed(1);
      // Position value slightly below the center point
      ctx.fillText(`(${val})`, x, y + 15); // FIX: Positioned 20px lower than title
    });

    ctx.restore();
  }
};

// Pentagon gradient + border for OVERLAY chart
const radarBackgroundPlugin = {
  id: 'customBackground',
  beforeDraw(chart) {
    if (chart.canvas.id !== 'radarChart2') return;
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const cx = r.xCenter;
    const cy = r.yCenter;
    const radius = r.drawingArea; 
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;
    const outerRadius = radius * 0.9; // Ensures custom drawing stays within bounds

    // Gradient from center → edge
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius);
    // FIX: Ensure gradient colors align with intended UnOrdinary style
    grad.addColorStop(0, '#f8fcff');
    grad.addColorStop(0.4, chartColor); 
    grad.addColorStop(1, chartColor);

    ctx.save();
    // Pentagon fill
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + outerRadius * Math.cos(a);
      const y = cy + outerRadius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Spokes
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + outerRadius * Math.cos(a);
      const y = cy + outerRadius * Math.sin(a);
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#35727d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Border outline
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + outerRadius * Math.cos(a);
      const y = cy + outerRadius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#184046';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
};

// Register both plugins globally
Chart.register(outlinedLabelsPlugin, radarBackgroundPlugin);

/* === CREATE RADAR FUNCTION === */
function makeRadar(ctx, isOverlay = false) {
  const currentColor = document.getElementById('colorPicker').value || '#92dfec';

  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: hexToRGBA(currentColor, 0.7),
        borderColor: currentColor,
        borderWidth: 2,
        pointRadius: isOverlay ? 0 : 4,
        pointHoverRadius: isOverlay ? 5 : 0, // FIX: Enable hover
        pointHoverBorderWidth: isOverlay ? 2 : 0 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 35 },
      elements: { line: { tension: 0 } },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#6db5c0' },
          pointLabels: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        // FIX: Enable tooltip for overlay chart
        tooltip: {
            enabled: isOverlay,
            callbacks: {
                label: function(context) {
                    // Display score as "Stat: X.X"
                    return context.label + ': ' + context.formattedValue;
                }
            }
        }
      }
    },
    // FIX: Ensure the correct plugin is used for each chart
    plugins: isOverlay ? [radarBackgroundPlugin] : [outlinedLabelsPlugin]
  });
}

/* === DOM ELEMENTS === */
const inputs = ['powerInput', 'speedInput', 'trickInput', 'recoveryInput', 'defenseInput'];
const colorPicker = document.getElementById('colorPicker');
const viewBtn = document.getElementById('viewBtn');
const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const uploadedImg = document.getElementById('uploadedImg');
const imgInput = document.getElementById('imgInput');

/* === INITIALIZATION === */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, false);
  updateCharts();
});

/* === FUNCTIONS === */
function getStatValues() {
  return inputs.map(id => +document.getElementById(id).value || 0);
}

function updateCharts() {
  const vals = getStatValues();
  const cappedVals = vals.map(v => Math.min(v, 10)); // Caps at 10 for the visual display boundary
  chartColor = colorPicker.value;
  const fill = hexToRGBA(chartColor, 0.7);

  // Main chart
  // FIX: Set data to VALS (true input) so custom labels can display the correct number
  radar1.data.datasets[0].data = vals; 
  radar1.data.datasets[0].borderColor = chartColor;
  radar1.data.datasets[0].backgroundColor = fill;
  radar1.update();

  // Overlay chart (capped)
  if (radar2) {
    radar2.data.datasets[0].data = cappedVals;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }
}

/* === EVENT LISTENERS === */
inputs.forEach(id => document.getElementById(id).addEventListener('input', updateCharts));
colorPicker.addEventListener('input', updateCharts);
['nameInput', 'abilityInput', 'levelInput'].forEach(id =>
  document.getElementById(id).addEventListener('input', updateCharts)
);

viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  document.getElementById('overlayImg').src = uploadedImg.src;
  document.getElementById('overlayName').textContent = document.getElementById('nameInput').value || '-';
  document.getElementById('overlayAbility').textContent = document.getElementById('abilityInput').value || '-';
  document.getElementById('overlayLevel').textContent = document.getElementById('levelInput').value || '-';

  const ctx2 = document.getElementById('radarChart2').getContext('2d');
  if (radar2) radar2.destroy();
  // FIX: Re-create the overlay chart every time to ensure context is valid
  radar2 = makeRadar(ctx2, true); 
  updateCharts();
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';
  html2canvas(document.getElementById('characterBox'), { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `${document.getElementById('nameInput').value || 'Character'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});
