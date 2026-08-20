// ── Generated ambience ───────────────────────────────────────────────────────
// Everything here is synthesised at runtime with the Web Audio API — no audio
// files, so there is nothing to license or attribute. Two layers:
//   1. a soft drone pad (detuned sines on an open fifth) for continuity
//   2. filtered brown noise that swells and recedes like surf, cued by the
//      breathing phase so the sound paces the breath rather than looping.

const CHORD = [146.83, 220, 293.66]; // D3 · A3 · D4 — open fifth, no third
const DRONE_GAIN = 0.05;
const NOISE_FLOOR = 0.012;
const NOISE_PEAK = 0.075;

function brownNoiseBuffer(ctx, seconds = 4) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

/**
 * Builds an ambience player. Nothing is created until start() is called from a
 * user gesture, which is what browsers require to open an AudioContext.
 */
export function createAmbience() {
  let ctx = null;
  let master = null;
  let noiseGain = null;
  let noiseFilter = null;
  let nodes = [];
  let volume = 0.6;

  function build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Drone pad: each note doubled and slightly detuned so it shimmers.
    const droneGain = ctx.createGain();
    droneGain.gain.value = DRONE_GAIN;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 900;
    droneGain.connect(droneFilter).connect(master);

    CHORD.forEach((freq, i) => {
      [-4, 4].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = cents;
        const voice = ctx.createGain();
        voice.gain.value = 1 / (i + 2); // upper notes quieter
        osc.connect(voice).connect(droneGain);
        osc.start();
        nodes.push(osc);
      });
    });

    // Slow amplitude drift so the pad never sits perfectly still.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = DRONE_GAIN * 0.4;
    lfo.connect(lfoDepth).connect(droneGain.gain);
    lfo.start();
    nodes.push(lfo);

    // Surf layer.
    const noise = ctx.createBufferSource();
    noise.buffer = brownNoiseBuffer(ctx);
    noise.loop = true;
    noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 500;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = NOISE_FLOOR;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();
    nodes.push(noise);

    return true;
  }

  return {
    async start() {
      if (!ctx && !build()) return false;
      if (ctx.state === 'suspended') await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.8);
      return true;
    },

    stop() {
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    },

    setVolume(next) {
      volume = next;
      if (!ctx) return;
      master.gain.setTargetAtTime(next, ctx.currentTime, 0.2);
    },

    /**
     * Rides the surf layer with the breath: rising on the inhale, settling on
     * the exhale, held steady in between.
     * @param {'in'|'hold'|'out'} kind
     * @param {number} secs duration of the phase
     */
    cueBreath(kind, secs) {
      if (!ctx || !noiseGain) return;
      const now = ctx.currentTime;
      const target = kind === 'in' ? NOISE_PEAK : kind === 'out' ? NOISE_FLOOR : null;
      noiseGain.gain.cancelScheduledValues(now);
      noiseGain.gain.setValueAtTime(noiseGain.gain.value, now);
      if (target !== null) {
        noiseGain.gain.linearRampToValueAtTime(target, now + secs);
      }
      // Opening the filter on the inhale makes the swell feel like it lifts.
      noiseFilter.frequency.cancelScheduledValues(now);
      noiseFilter.frequency.setValueAtTime(noiseFilter.frequency.value, now);
      noiseFilter.frequency.linearRampToValueAtTime(
        kind === 'in' ? 900 : 420,
        now + secs
      );
    },

    dispose() {
      if (!ctx) return;
      nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
      nodes = [];
      ctx.close();
      ctx = null;
    },
  };
}

export default createAmbience;
