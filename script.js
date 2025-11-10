let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let isMulticolor = false;

// Fixed colors for the spokes and polygon border
const FIXED_BORDER_COLOR = '#493e3b';
const FIXED_SPOKE_COLOR = '#6db5c0';
const DEFAULT_FILL_OPACITY = 0.65;

/* === UTILITIES === */
function hexToRGBA(hex, alpha) {
    if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/* Get current axis colors */
function getAxisColors() {
    return [
        axisColors.power.value,
        axisColors.speed.value,
        axisColors.trick.value,
        axisColors.recovery.value,
        axisColors.defense.value
    ];
}

/* === PLUGINS === */

// Plugin to draw colored wedges (for multicolor mode)
const segmentedFillPlugin = {
    id: 'segmentedFill',
    beforeDatasetsDraw(chart, args, options) {
        if (!options.enabled || chart.data.datasets.length === 0) return;

        const ctx = chart.ctx;
        const r = chart.scales.r;
        const dataset = chart.data.datasets[0];
        const data = dataset.data;
        const N = chart.data.labels.length;
        const cx = r.xCenter, cy = r.yCenter;
        const colors = getAxisColors();

        ctx.save();
        ctx.globalAlpha = 0.6;

        for (let i = 0; i < N; i++) {
            const currentVal = data[i] || 0;
            const nextVal = data[(i + 1) % N] || 0;
            const pt1 = r.getPointPosition(i, currentVal);
            const pt2 = r.getPointPosition((i + 1) % N, nextVal);

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.closePath();
            ctx.fillStyle = colors[i];
            ctx.fill();
        }

        ctx.restore();
    },
};

// Plugin to draw pentagon background and fixed spokes
const radarGridPlugin = {
    id: 'customPentagonBackground',
    beforeDatasetsDraw(chart) {
        const opts = chart.config.options.customBackground;
        if (!opts?.enabled) return;
        const r = chart.scales.r, ctx = chart.ctx;
        const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
        const N = chart.data.labels.length, start = -Math.PI / 2;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, '#f8fcff');
        gradient.addColorStop(0.33, chartColor);
        gradient.addColorStop(1, chartColor);

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
        // spokes
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = FIXED_SPOKE_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();

        // border
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = FIXED_BORDER_COLOR;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
};

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

const outlinedLabelsPlugin = {
    id: 'outlinedLabels',
    afterDraw(chart) {
        const ctx = chart.ctx;
        const r = chart.scales.r;
        const labels = chart.data.labels;
        const cx = r.xCenter, cy = r.yCenter;
        const baseRadius = r.drawingArea * 1.1;
        const base = -Math.PI / 2;
        const currentChartColor = chart.config.options.abilityColor;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'italic 18px Candara';
        ctx.strokeStyle = currentChartColor;
        ctx.fillStyle = 'white';
        ctx.lineWidth = 4;

        labels.forEach((label, i) => {
            const angle = base + (i * 2 * Math.PI / labels.length);
            const x = cx + baseRadius * Math.cos(angle);
            let y = cy + baseRadius * Math.sin(angle);
            if (i === 0) y -= 5;
            ctx.strokeText(label, x, y);
            ctx.fillText(label, x, y);
        });
        ctx.restore();
    }
};

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
        const currentChartColor = chart.config.options.abilityColor;

        ctx.save();
        ctx.font = '15px Candara';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = currentChartColor;
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        labels.forEach((label, i) => {
            const angle = base + (i * 2 * Math.PI / labels.length);
            const x = cx + (baseRadius + offset) * Math.cos(angle);
            let y = cy + (baseRadius + offset) * Math.sin(angle);
            if (i === 0) y -= 20;
            else if (i === 1) y += 10;
            else if (i === 4) y += 10;

            const valueText = `(${data[i] ? data[i].toFixed(1) : '0.0'})`;
            ctx.strokeText(valueText, x, y);
            ctx.fillText(valueText, x, y);
        });
        ctx.restore();
    }
};

/* === CHART CREATOR === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
    const plugins = [
        fixedCenterPlugin,
        radarGridPlugin,
        outlinedLabelsPlugin,
        inputValuePlugin,
        segmentedFillPlugin
    ];

    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: hexToRGBA(chartColor, DEFAULT_FILL_OPACITY),
                borderColor: FIXED_BORDER_COLOR,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: FIXED_BORDER_COLOR,
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
                    angleLines: { color: FIXED_SPOKE_COLOR, lineWidth: 1 },
                    suggestedMin: 0,
                    suggestedMax: 10,
                    ticks: { display: false },
                    pointLabels: { color: 'transparent' }
                }
            },
            customBackground: { enabled: withBackground },
            customFill: { enabled: false },
            fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
            abilityColor: chartColor,
            plugins: { legend: { display: false } }
        },
        plugins: plugins
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
const multiBtn = document.getElementById('multiBtn');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');

const axisColors = {
    power: document.getElementById('powerColor'),
    speed: document.getElementById('speedColor'),
    trick: document.getElementById('trickColor'),
    recovery: document.getElementById('recoveryColor'),
    defense: document.getElementById('defenseColor')
};

const inputElements = [
    powerInput, speedInput, trickInput, recoveryInput, defenseInput,
    colorPicker, ...Object.values(axisColors)
];

/* === INIT === */
window.addEventListener('load', () => {
    chartColor = colorPicker.value || chartColor;
    const ctx1 = document.getElementById('radarChart1').getContext('2d');
    radar1 = makeRadar(ctx1, true, false);

    Object.values(axisColors).forEach(input => {
        input.value = chartColor;
    });

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
    chartColor = colorPicker.value || chartColor;
    const solidFill = hexToRGBA(chartColor, DEFAULT_FILL_OPACITY);
    const capped = vals.map(v => Math.min(v, 10));

    [radar1, radar2].forEach((chart, i) => {
        if (!chart) return;
        chart.options.scales.r.suggestedMax = i === 0 ? maxVal : 10;
        chart.options.abilityColor = chartColor;
        chart.data.datasets[0].data = i === 0 ? vals : capped;

        chart.options.scales.r.angleLines.color = FIXED_SPOKE_COLOR;
        chart.data.datasets[0].borderColor = FIXED_BORDER_COLOR;
        chart.data.datasets[0].pointBorderColor = FIXED_BORDER_COLOR;
        chart.options.customFill.enabled = false;

        if (isMulticolor) {
            chart.options.customFill.enabled = true;
            chart.data.datasets[0].backgroundColor = 'rgba(0,0,0,0)';
        } else {
            Object.values(axisColors).forEach(input => {
                input.value = chartColor;
                input.dataset.userSelected = false;
            });
            chart.data.datasets[0].backgroundColor = solidFill;
        }

        chart.update();
    });
}

/* === INPUT HANDLERS === */
inputElements.forEach(el => {
    el.addEventListener('input', () => updateCharts());
    el.addEventListener('keyup', e => {
        if (e.key === 'Enter') updateCharts();
    });
    el.addEventListener('blur', updateCharts);
});

Object.values(axisColors).forEach(input => {
    input.addEventListener('input', () => {
        input.dataset.userSelected = true;
        updateCharts();
    });
});

colorPicker.addEventListener('input', () => {
    chartColor = colorPicker.value;
    if (!isMulticolor) {
        Object.values(axisColors).forEach(input => {
            input.value = chartColor;
        });
    }
    updateCharts();
});

/* === IMAGE UPLOAD === */
imgInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { uploadedImg.src = ev.target.result; };
    reader.readAsDataURL(file);
});

/* === MULTICOLOR BUTTON === */
multiBtn.addEventListener('click', () => {
    isMulticolor = !isMulticolor;
    const axisColorInputs = document.querySelectorAll('.axisColor');

    if (isMulticolor) {
        multiBtn.textContent = 'Single Color';
        axisColorInputs.forEach(input => input.classList.remove('hidden'));
    } else {
        multiBtn.textContent = 'Multicolor';
        axisColorInputs.forEach(input => input.classList.add('hidden'));
        Object.values(axisColors).forEach(input => {
            input.value = chartColor;
            input.dataset.userSelected = false;
        });
    }
    updateCharts();
});

/* === OVERLAY === */
viewBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    overlayImg.src = uploadedImg.src;
    overlayName.textContent = nameInput.value || 'N/A';
    overlayAbility.textContent = abilityInput.value || 'N/A';
    overlayLevel.textContent = levelInput.value || 'N/A';

    setTimeout(() => {
        const overlayChart = document.querySelector('.overlay-chart');
        const targetSize = 400;
        overlayChart.style.height = `${targetSize}px`;
        overlayChart.style.width = `${targetSize}px`;

        const ctx2 = document.getElementById('radarChart2').getContext('2d');
        if (!radar2Ready) {
            const center = { x: targetSize / 2, y: targetSize / 2 };
            radar2 = makeRadar(ctx2, false, true, center);
            radar2Ready = true;
        } else {
            radar2.resize();
        }
        updateCharts();
    }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === DOWNLOAD === */
downloadBtn.addEventListener('click', () => {
    downloadBtn.style.visibility = 'hidden';
    closeBtn.style.visibility = 'hidden';

    const box = document.getElementById('characterBox');
    html2canvas(box, { scale: 3 }).then(canvas => {
        const link = document.createElement('a');
        const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
        link.download = `${cleanName}_CharacterChart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        downloadBtn.style.visibility = 'visible';
        closeBtn.style.visibility = 'visible';
    });
});
