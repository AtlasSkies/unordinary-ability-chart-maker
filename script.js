let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';

// Pre-defined center coordinates for the main chart based on its container size (450x450 max)
const CHART1_CENTER = { x: 225, y: 225 }; 
const CHART_SCALE_FACTOR = 0.8;
// Multiplier for the Character Chart (Chart 2) container size (1.5x larger)
const CHART_SIZE_MULTIPLIER = 1.5; 

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* === Fix radar scale center and radius (to prevent clipping) === */
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
    
    r.drawingArea *= CHART_SCALE_FACTOR;
  }
};

/* === Pentagon background + spokes (Overlay Chart) === */
const radarBackgroundPlugin = {
  id: 'customPentagonBackground',
  // Draw the background fill BEFORE the dataset
  beforeDatasetsDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r;
    const ctx = chart.ctx;
    const cx = r.xCenter;
    const cy = r.yCenter;
    const radius = r.drawingArea;
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;
    
    // Radial Gradient (Fill)
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, '#f8fcff');
    gradient.addColorStop(0.25, '#92dfec');
    gradient.addColorStop(1, '#92dfec');
    
    ctx.save();
    
    // Draw Pentagon Shape (background fill)
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
  
  // Draw the spokes and outer border (outline) AFTER the dataset is drawn (on top of it)
  afterDatasetsDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r;
    const ctx = chart.ctx;
    const cx = r.xCenter;
    const cy = r.yCenter;
    const radius = r.drawingArea;
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;
    
    ctx.save();
    
    // Draw Spokes
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

    // Draw Pentagon Outline
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

/* === Outlined Axis Labels (Prevents Cutoff & uses chartColor) === */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter;
    const cy = r.yCenter;
    
    // Adjust label radius for better positioning outside the chart area
    const radius = r.drawingArea * 1.05 + 15; 
    const base = -Math.PI / 2;
    
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    
    // CORRECTION: Outline color is the selected ability color, fill is white
    ctx.strokeStyle = chartColor; 
    ctx.fillStyle = 'white'; 
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      const angle = base + (i * 2 * Math.PI / labels.length);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* === Create Chart Function === */
function makeRadar(ctx, maxCap = null, showPoints = true, withBackground = false, fixedCenter = null) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: 'transparent',
        borderColor: chartColor, 
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: chartColor, 
        pointRadius: showPoints ? 5 : 0,
        order: 1 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          suggestedMin: 0,
          suggestedMax: maxCap ?? 10, 
          ticks: { display: false },
          pointLabels: { 
            display: true, 
            font: { size: 16 },
            color: 'transparent' 
          } 
        }
      },
      customBackground: { enabled: withBackground },
      fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin]
  });
}

// Get DOM elements
const updateBtn = document.getElementById('updateBtn');
const viewBtn = document.getElementById('viewBtn');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const colorPicker = document.getElementById('colorPicker');
const dispName = document.getElementById('dispName');
const dispAbility = document.getElementById('dispAbility');
const dispLevel = document.getElementById('dispLevel');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const characterBox = document.getElementById('characterBox');
const imgInput = document.getElementById('imgInput');
const uploadedImg = document.getElementById('uploadedImg');


/* === Chart 1 (Main) Initialization === */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, null, true, false, CHART1_CENTER); 
  chartColor = colorPicker.value;
});

/* === Update charts and info === */
updateBtn.addEventListener('click', () => {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  
  const capped = vals.map(v => Math.min(v, 10)); 
  
  chartColor = colorPicker.value;
  const fill = hexToRGBA(chartColor, 0.75);

  // Update Chart 1 (Main) with uncapped values
  radar1.data.datasets[0].data = vals;
  radar1.data.datasets[0].borderColor = chartColor;
  radar1.data.datasets[0].pointBorderColor = chartColor;
  radar1.data.datasets[0].backgroundColor = fill;
  radar1.update();

  // Update Chart 2 (Overlay) if it has been initialized
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

/* === Overlay controls === */
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
    
    // Force a redraw to get accurate dimensions
    const imgHeight = img.offsetHeight; 
    const textHeight = textBox.offsetHeight;
    
    // Calculate required size for alignment (Image Height + Text Box Height)
    const targetVerticalSpan = imgHeight + textHeight; 
    
    // APPLY 1.5x MULTIPLIER to the calculated span (Requested size increase)
    const targetSize = targetVerticalSpan * CHART_SIZE_MULTIPLIER;

    // Apply the calculated size to the chart container
    overlayChart.style.height = `${targetSize}px`;
    overlayChart.style.width = `${targetSize}px`;

    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    
    // Initialize or resize Chart 2
    if (!radar2Ready) {
      // Pass the new targetSize/2 for the center coordinates
      radar2 = makeRadar(ctx2, 10, false, true, { x: targetSize / 2, y: targetSize / 2 });
      radar2Ready = true;
    } else {
      radar2.resize(); 
    }

    // Update Chart 2 data (CAPPED at 10)
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
  }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === Download (hide buttons before capture) === */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';
  
  // Use html2canvas to capture the characterBox
  html2canvas(characterBox, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = (nameInput.value || 'UnOrdinary_Character') + '_chart.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Restore buttons after download
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});

/* === Image upload === */
imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});
