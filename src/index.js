import './style.css';
import { EQ } from './eq';
import {
    MAX_AMP_DB,
    LOG_MIN_FREQ,
    LOG_MAX_FREQ,
    FFT_SIZE,
    FG_COLOR,
    BG_COLOR,
    CURVE_COLOR,
    LINE_COLOR,
} from './constants';

const canvas = document.getElementById('canvas');
const width = canvas.width;
const height = canvas.height;

// audio

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const source = audioCtx.createMediaElementSource(
    document.getElementById('audio')
);
const eq = new EQ(audioCtx, width);

[
    ['low-shelf-gain', 'lowShelfGain'],
    ['mid-gain', 'midGain'],
    ['high-shelf-gain', 'highShelfGain'],
    ['output-gain', 'outputGain'],
].forEach(([id, prop]) => {
    document.getElementById(id).addEventListener('input', (e) => {
        eq[prop] = e.target.value;
    });
});

document
    .getElementById('highpass-filter-on')
    .addEventListener('change', (e) => {
        eq.highpassEnabled = e.target.checked;
    });

const midFreq = document.getElementById('mid-frequency');
const midFreqIndicator = document.getElementById('mid-frequency-indicator');
midFreq.min = Math.log2(120);
midFreq.max = Math.log2(7500);
midFreq.value = Math.log2(1500);
midFreq.addEventListener('input', () => {
    const freq = Math.pow(2, midFreq.value);
    eq.midFrequency = freq;
    midFreqIndicator.innerHTML =
        freq < 1000
            ? Math.floor(freq) + 'Hz'
            : (freq / 1000).toFixed(2) + 'kHz';
});

const analyser = audioCtx.createAnalyser();
analyser.maxDecibels = -10;
analyser.minDecibels = -96;
analyser.fftSize = FFT_SIZE;

source.connect(eq.input);
eq.connect(analyser);
eq.connect(audioCtx.destination);

// visualization

const canvasCtx = canvas.getContext('2d');

function dbToY(db) {
    return (height / 2) * (1 - db / MAX_AMP_DB);
}

function drawHLine(db) {
    const y = dbToY(db);
    canvasCtx.fillStyle = FG_COLOR;
    canvasCtx.fillText(db, 15, y + 5);
    canvasCtx.beginPath();
    canvasCtx.moveTo(30, y);
    canvasCtx.lineTo(width, y);
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = LINE_COLOR;
    canvasCtx.stroke();
}

function drawVLine(exp) {
    const x = ((exp - LOG_MIN_FREQ) / (LOG_MAX_FREQ - LOG_MIN_FREQ)) * width;

    canvasCtx.beginPath();
    canvasCtx.moveTo(x, 0);
    canvasCtx.lineTo(x, height - 10);
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = LINE_COLOR;
    canvasCtx.stroke();

    canvasCtx.fillStyle = BG_COLOR;
    canvasCtx.fillRect(x - 15, height - 20, 30, 20);

    let value = Math.pow(10, exp);
    if (value >= 1000) {
        value = Math.floor(value / 1000) + 'k';
    }
    canvasCtx.fillStyle = FG_COLOR;
    canvasCtx.fillText(value, x, height - 5);
}

const freqData = new Uint8Array(FFT_SIZE / 2);

function drawSpectrum() {
    analyser.getByteFrequencyData(freqData);
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, ((255 - freqData[0]) / 255) * height);
    const binWidth = LOG_MAX_FREQ - Math.log10(freqData.length);
    for (let i = 1; i < freqData.length; ++i) {
        const x =
            ((Math.log10(i) + binWidth - LOG_MIN_FREQ) /
                (LOG_MAX_FREQ - LOG_MIN_FREQ)) *
            width;
        const y = ((255 - freqData[i]) / 255) * height;
        canvasCtx.lineTo(x, y);
    }
    canvasCtx.lineTo(width, height);
    canvasCtx.lineTo(0, height);
    canvasCtx.closePath();
    canvasCtx.fillStyle = FG_COLOR + '90';
    canvasCtx.fill();
}

function drawCurve() {
    const freqResponse = eq.getFrequencyResponse();

    canvasCtx.beginPath();
    canvasCtx.moveTo(0, dbToY(freqResponse[0]));
    for (let i = 0; i < width; ++i) {
        canvasCtx.lineTo(i, dbToY(freqResponse[i]));
    }
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = CURVE_COLOR;
    canvasCtx.stroke();
}

function draw() {
    canvasCtx.font = 'bold 14px Inter';
    canvasCtx.textAlign = 'center';

    canvasCtx.fillStyle = BG_COLOR;
    canvasCtx.fillRect(0, 0, width, height);

    drawHLine(0);
    drawHLine(12);
    drawHLine(-12);

    // 100Hz to MAX_FREQ
    for (let i = 2; i <= LOG_MAX_FREQ; ++i) {
        drawVLine(i);
    }

    drawSpectrum();
    drawCurve();

    requestAnimationFrame(draw);
}

draw();

function resume() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

document.addEventListener('mousedown', resume);
document.addEventListener('keydown', resume);
