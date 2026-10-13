const TEXT_POOL = [
    "the art of programming is the skill of controlling complexity. great code is not just functional, it is elegant, readable, and structured with intent. simplicity is prerequisite for reliability.",
    "focus is the gateway to mastery. when you immerse yourself in the present moment, distraction fades away, leaving only the rhythm of your hands and the flow of cascading thoughts on screen.",
    "design is not just what it looks like and feels like. design is how it works. every interaction should be deliberate, responsive, and crafted to elevate the human experience.",
    "speed is a byproduct of precision. do not rush the keystrokes; instead, cultivate effortless accuracy and let momentum build naturally from a calm and centered mind.",
    "innovation distinguishes between a leader and a follower. push boundaries by questioning assumptions, experimenting fearlessly, and embracing the iterative journey of creation."
];

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.step = 0;
        this.bassNotes = [110, 98.0, 87.31, 82.41]; // A2, G2, F2, E2
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.init();
        }
        return this.enabled;
    }

    playKey(isError = false) {
        if (!this.enabled || !this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = isError ? 'sawtooth' : 'sine';
        
        if (isError) {
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        } else {
            // Harmonic scale intervals
            const pentatonic = [440, 523.25, 659.25, 783.99, 880, 1046.5];
            const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
            
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        }
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playBeat() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        const bass = this.bassNotes[Math.floor(this.step / 4) % this.bassNotes.length];
        osc.frequency.setValueAtTime(bass, now);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
        this.step++;
    }
}

class TypingApp {
    constructor() {
        this.sound = new SoundEngine();
        this.mode = 'zen';
        this.state = 'idle'; // idle, running, finished
        this.text = '';
        this.currentIndex = 0;
        this.errors = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.beatInterval = null;

        this.canvas = document.getElementById('rhythm-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];

        this.initDOM();
        this.initEvents();
        this.loadNewText();
        this.setupCanvas();
        this.loop();
    }

    initDOM() {
        this.arena = document.getElementById('arena');
        this.textDisplay = document.getElementById('text-display');
        this.hiddenInput = document.getElementById('hidden-input');
        this.focusOverlay = document.getElementById('focus-overlay');
        this.resultsModal = document.getElementById('results-modal');
        this.audioToggle = document.getElementById('audio-toggle');
        
        this.statWpm = document.getElementById('stat-wpm');
        this.statAcc = document.getElementById('stat-acc');
        this.statStreak = document.getElementById('stat-streak');
        this.statTime = document.getElementById('stat-time');

        this.resWpm = document.getElementById('res-wpm');
        this.resAcc = document.getElementById('res-acc');
        this.resStreak = document.getElementById('res-streak');
        this.resErr = document.getElementById('res-err');
        this.restartBtn = document.getElementById('restart-btn');
    }

    initEvents() {
        this.arena.addEventListener('click', () => {
            this.hiddenInput.focus();
            this.focusOverlay.classList.add('hidden');
        });

        this.hiddenInput.addEventListener('blur', () => {
            if (this.state === 'running') {
                this.focusOverlay.classList.remove('hidden');
            }
        });

        this.hiddenInput.addEventListener('input', (e) => this.handleInput(e));

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
                this.resetSession();
            });
        });

        this.audioToggle.addEventListener('click', () => {
            const active = this.sound.toggle();
            if (active) {
                this.audioToggle.textContent = '🔊 Audio On';
                this.audioToggle.classList.add('active');
                this.startBeatLoop();
            } else {
                this.audioToggle.textContent = '🔇 Audio Off';
                this.audioToggle.classList.remove('active');
                this.stopBeatLoop();
            }
        });

        this.restartBtn.addEventListener('click', () => {
            this.resultsModal.hidden = true;
            this.resetSession();
            this.hiddenInput.focus();
            this.focusOverlay.classList.add('hidden');
        });

        window.addEventListener('resize', () => this.setupCanvas());
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    loadNewText() {
        const randomIndex = Math.floor(Math.random() * TEXT_POOL.length);
        this.text = TEXT_POOL[randomIndex];
        this.renderText();
    }

    renderText() {
        this.textDisplay.innerHTML = '';
        for (let i = 0; i < this.text.length; i++) {
            const span = document.createElement('span');
            span.textContent = this.text[i];
            span.className = 'char' + (i === 0 ? ' current' : '');
            this.textDisplay.appendChild(span);
        }
    }

    startSession() {
        this.state = 'running';
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => this.updateTimer(), 200);
    }

    updateTimer() {
        if (this.state !== 'running') return;
        const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        this.statTime.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        
        // Calculate WPM
        const wordsTyped = (this.currentIndex / 5);
        const timeMins = elapsedSec / 60;
        const wpm = timeMins > 0 ? Math.round(wordsTyped / timeMins) : 0;
        this.statWpm.textContent = wpm;
    }

    startBeatLoop() {
        this.stopBeatLoop();
        // BPM depends on mode or fixed rhythm
        const intervalMs = this.mode === 'sprint' ? 250 : 350;
        this.beatInterval = setInterval(() => {
            if (this.state === 'running') {
                this.sound.playBeat();
                this.addPulseParticle();
            }
        }, intervalMs);
    }

    stopBeatLoop() {
        if (this.beatInterval) {
            clearInterval(this.beatInterval);
            this.beatInterval = null;
        }
    }

    handleInput(e) {
        if (this.state === 'idle') {
            this.startSession();
        }

        if (this.state !== 'running') return;

        const val = this.hiddenInput.value;
        if (!val) return;
        this.hiddenInput.value = '';

        const charTyped = val[val.length - 1];
        const targetChar = this.text[this.currentIndex];

        const spans = this.textDisplay.querySelectorAll('.char');
        
        if (charTyped === targetChar) {
            spans[this.currentIndex].classList.remove('current', 'incorrect');
            spans[this.currentIndex].classList.add('correct');
            this.currentIndex++;
            this.streak++;
            if (this.streak > this.maxStreak) this.maxStreak = this.streak;
            
            this.sound.playKey(false);
            this.addKeyParticle(true);

            if (this.currentIndex < this.text.length) {
                spans[this.currentIndex].classList.add('current');
            } else {
                this.finishSession();
            }
        } else {
            spans[this.currentIndex].classList.add('incorrect');
            this.errors++;
            this.streak = 0;
            this.sound.playKey(true);
            this.addKeyParticle(false);
        }

        this.statStreak.textContent = this.streak;
        const totalAttempts = this.currentIndex + this.errors;
        const accuracy = totalAttempts > 0 ? Math.max(0, Math.round((this.currentIndex / totalAttempts) * 100)) : 100;
        this.statAcc.textContent = `${accuracy}%`;
    }

    addKeyParticle(success) {
        const rect = this.canvas.getBoundingClientRect();
        this.particles.push({
            x: Math.random() * rect.width,
            y: rect.height / 2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            radius: Math.random() * 6 + 4,
            color: success ? '#00f0ff' : '#ff3366',
            alpha: 1
        });
    }

    addPulseParticle() {
        const rect = this.canvas.getBoundingClientRect();
        this.particles.push({
            x: rect.width / 2,
            y: rect.height / 2,
            vx: 0,
            vy: 0,
            radius: 10,
            maxRadius: 150,
            color: '#7000ff',
            alpha: 0.5,
            isPulse: true
        });
    }

    loop() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);

        this.particles.forEach((p, index) => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.strokeStyle = p.color;

            if (p.isPulse) {
                p.radius += 3;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.stroke();
                p.alpha -= 0.03;
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.02;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();

            if (p.alpha <= 0 || (p.isPulse && p.radius >= p.maxRadius)) {
                this.particles.splice(index, 1);
            }
        });

        requestAnimationFrame(() => this.loop());
    }

    finishSession() {
        this.state = 'finished';
        clearInterval(this.timerInterval);
        this.stopBeatLoop();

        const elapsedSec = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
        const timeMins = elapsedSec / 60;
        const wpm = Math.round((this.text.length / 5) / timeMins);
        const totalAttempts = this.text.length + this.errors;
        const accuracy = Math.max(0, Math.round((this.text.length / totalAttempts) * 100));

        this.resWpm.textContent = wpm;
        this.resAcc.textContent = `${accuracy}%`;
        this.resStreak.textContent = this.maxStreak;
        this.resErr.textContent = this.errors;

        this.resultsModal.hidden = false;
    }

    resetSession() {
        this.state = 'idle';
        this.currentIndex = 0;
        this.errors = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.startTime = null;
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.statWpm.textContent = '0';
        this.statAcc.textContent = '100%';
        this.statStreak.textContent = '0';
        this.statTime.textContent = '0:00';

        this.loadNewText();
        if (this.sound.enabled) {
            this.startBeatLoop();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new TypingApp();
});
