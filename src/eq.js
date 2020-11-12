import { MAX_FREQ, LOG_MAX_FREQ, LOG_MIN_FREQ } from './constants';

export class EQ {
    constructor(context, freqResponseTicks = 256) {
        this._input = context.createGain();

        // first-order highpass filter (80Hz)
        const omega = 2 * Math.PI * 80;
        const k = omega / Math.tan(omega / 2 / context.sampleRate);
        this._highpass = context.createIIRFilter(
            [k, -k],
            [k + omega, -k + omega]
        );
        this._highpassEnabled = false;

        // low
        this._lowShelf = context.createBiquadFilter();
        this._lowShelf.type = 'lowshelf';

        // mid
        this._peaking = context.createBiquadFilter();
        this._peaking.type = 'peaking';
        this._peaking.frequency.value = 1500;
        this._peaking.Q.value = 0.5;

        // high
        this._highShelf = context.createBiquadFilter();
        this._highShelf.type = 'highshelf';
        this._highShelf.frequency.value = 3000;

        this._lowpass = context.createBiquadFilter();
        this._lowpass.type = 'lowpass';
        this._lowpass.frequency.value = MAX_FREQ;
        this._lowpass.Q.value = -2;

        // output
        this._output = context.createGain();

        this._input
            .connect(this._lowShelf)
            .connect(this._peaking)
            .connect(this._highShelf)
            .connect(this._lowpass)
            .connect(this._output);
        this._highpass.connect(this._lowShelf);

        this._freqArray = new Float32Array(freqResponseTicks);
        this._freqResponse = new Float32Array(freqResponseTicks);
        this._magResponse = new Float32Array(freqResponseTicks);
        this._phaseResponse = new Float32Array(freqResponseTicks);

        for (let i = 0; i < freqResponseTicks; ++i) {
            const f = i / freqResponseTicks;
            this._freqArray[i] = Math.pow(
                10,
                (LOG_MAX_FREQ - LOG_MIN_FREQ) * f + LOG_MIN_FREQ
            );
        }
        this._updateFreqResponse();
    }

    get input() {
        return this._input;
    }

    set highpassEnabled(enabled) {
        this._highpassEnabled = enabled;
        this._input.disconnect();
        this._input.connect(enabled ? this._highpass : this._lowShelf);
        this._updateFreqResponse();
    }

    set lowShelfGain(gain) {
        let freq = 100;
        if (gain < 0) {
            freq += (100 * gain) / -15;
        }
        this._lowShelf.gain.value = gain;
        this._lowShelf.frequency.value = freq;
        this._updateFreqResponse();
    }

    set midFrequency(freq) {
        this._peaking.frequency.value = freq;
        this._updateFreqResponse();
    }

    set midGain(gain) {
        this._peaking.gain.value = gain;
        this._updateFreqResponse();
    }

    set highShelfGain(gain) {
        let freq = MAX_FREQ;
        if (gain < 0) {
            freq -= (gain * (MAX_FREQ - 8000)) / -15;
        }
        this._highShelf.gain.value = gain;
        this._lowpass.frequency.value = freq;
        this._updateFreqResponse();
    }

    set outputGain(gain) {
        this._output.gain.value = Math.pow(10, gain / 20);
    }

    connect(node) {
        return this._output.connect(node);
    }

    getFrequencyResponse() {
        return this._freqResponse;
    }

    _updateFreqResponse() {
        const filters = [
            this._lowShelf,
            this._peaking,
            this._highShelf,
            this._lowpass,
        ];
        if (this._highpassEnabled) {
            filters.push(this._highpass);
        }

        this._freqResponse.fill(0);
        for (const filter of filters) {
            filter.getFrequencyResponse(
                this._freqArray,
                this._magResponse,
                this._phaseResponse
            );
            for (let i = 0; i < this._freqResponse.length; ++i) {
                this._freqResponse[i] += 20 * Math.log10(this._magResponse[i]);
            }
        }
    }
}
