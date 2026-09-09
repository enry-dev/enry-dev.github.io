(function () {
      // ---------------------------------------------------------------------
      // AUDIO — effetti sonori sintetizzati via Web Audio API (nessun file esterno)
      // ---------------------------------------------------------------------
      let audioCtx = null;
      let sirenOsc = null, sirenLfo = null, sirenGain = null;

      function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // sirena della polizia: tono continuo modulato, volume a 0 finché non serve
        sirenOsc = audioCtx.createOscillator();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;

        sirenLfo = audioCtx.createOscillator();
        sirenLfo.type = 'sine';
        sirenLfo.frequency.value = 0.55; // velocità del "lamento" della sirena
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 260; // ampiezza dell'oscillazione in Hz
        sirenLfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);

        sirenGain = audioCtx.createGain();
        sirenGain.gain.value = 0;

        sirenOsc.connect(sirenGain).connect(audioCtx.destination);
        sirenOsc.start();
        sirenLfo.start();
      }

      function playGunshot(weaponKey) {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;

        // parametri diversi per ogni tipo di arma
        const presets = {
          pistol: {dur: 0.12, hp: 900, oscStart: 160, oscEnd: 45, vol: 0.55},
          smg: {dur: 0.06, hp: 1100, oscStart: 200, oscEnd: 70, vol: 0.4},
          rifle: {dur: 0.09, hp: 700, oscStart: 180, oscEnd: 55, vol: 0.55},
          shotgun: {dur: 0.22, hp: 400, oscStart: 110, oscEnd: 30, vol: 0.7}
        };
        const p = presets[weaponKey] || presets.pistol;

        // scoppio di rumore filtrato (il "crack" dello sparo)
        const bufferSize = Math.floor(audioCtx.sampleRate * p.dur);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = p.hp;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(p.vol, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
        noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
        noise.start(t);

        // colpo grave per dare "corpo" allo sparo
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(p.oscStart, t);
        osc.frequency.exponentialRampToValueAtTime(p.oscEnd, t + p.dur * 0.75);
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(p.vol * 0.9, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + p.dur * 0.8);
        osc.connect(oscGain).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + p.dur * 0.85);
      }

      function playKillSound() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(760, t + 0.14);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.22);
      }

      function playReloadStartSound() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.2);
      }

      function playReloadCompleteSound() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        [420, 620].forEach((frequency, index) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.001, t + index * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.2, t + index * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + index * 0.08 + 0.12);
          osc.connect(gain).connect(audioCtx.destination);
          osc.start(t + index * 0.08); osc.stop(t + index * 0.08 + 0.14);
        });
      }

      function playEmptyAmmoSound() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = 95;
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.08);
      }

      function playWeaponSwitchSound() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(520, t + 0.08);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.11);
      }

      function playCrashSound(strength) {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const vol = Math.min(0.75, 0.35 + (strength || 1) * 0.05);

        // rumore secco filtrato: il "crunch" della lamiera
        const dur = 0.22;
        const bufferSize = Math.floor(audioCtx.sampleRate * dur);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.6);
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(vol, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        noise.connect(filter).connect(noiseGain).connect(audioCtx.destination);
        noise.start(t);

        // colpo grave metallico per dare "peso" all'impatto
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + dur * 0.7);
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(vol * 0.8, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.75);
        osc.connect(oscGain).connect(audioCtx.destination);
        osc.start(t); osc.stop(t + dur * 0.8);
      }

      function updateSiren(dt, context) {
        if (!sirenGain || !audioCtx) return;

        // le unità in perlustrazione hanno la sirena spenta: contano solo quelle attive
        const activeUnits = context.policeCars.filter(p => p.state !== 'patrol');
        if (activeUnits.length === 0) {
          sirenGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
          return;
        }

        // trova la volante più vicina (o i suoi agenti, se sono scesi) al giocatore
        const target = context.mode === 'car' ? context.car.position : context.player.position;
        let minDist = Infinity;
        activeUnits.forEach(p => {
          minDist = Math.min(minDist, context.dist2D(target, p.mesh.position));
          p.officers.forEach(o => minDist = Math.min(minDist, context.dist2D(target, o.mesh.position)));
        });

        const closeDist = 10;   // sotto questa distanza: volume massimo
        const maxHearDist = 75; // oltre questa distanza: non si sente niente

        let vol;
        if (minDist <= closeDist) vol = 0.22;
        else if (minDist >= maxHearDist) vol = 0;
        else {
          const t = 1 - (minDist - closeDist) / (maxHearDist - closeDist);
          vol = 0.22 * t * t; // curva morbida: sale piano da lontano, forte da vicino
        }

        sirenGain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.25);
      }

      function resume() {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      }


  window.GameAudio = { initAudio, playGunshot, playKillSound, playCrashSound, playReloadStartSound, playReloadCompleteSound, playEmptyAmmoSound, playWeaponSwitchSound, updateSiren, resume };
})();

