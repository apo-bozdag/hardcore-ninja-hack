/**
 * Hardcore Ninja Cheat v3.0
 * =========================
 * Basit ve çalışan versiyon
 * Laser ve Inv çalıştığına göre skill gönderimi doğru
 */

(function() {
    'use strict';

    const log = (msg) => console.log(`%c[Ninja] ${msg}`, 'color:#0f0;font-weight:bold');
    const warn = (msg) => console.log(`%c[Ninja] ${msg}`, 'color:#ff0;font-weight:bold');

    class Cheat {
        constructor() {
            this.nm = window.networkManager;
            this.autoId = null;
            this.lastTarget = { x: 0, y: 0, z: 10 };
        }

        init() {
            if (!this.nm) {
                warn('NetworkManager yok!');
                return this;
            }

            log(`Host: ${this.nm._isHost}`);
            log('Hazır!');

            // Mouse takibi ekle
            this.setupMouseTracker();

            this.help();
            return this;
        }

        // Mouse pozisyonunu takip et
        setupMouseTracker() {
            document.addEventListener('mousemove', (e) => {
                // Ekran koordinatlarını oyun koordinatlarına çevir (basit yaklaşım)
                const canvas = document.querySelector('canvas');
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width - 0.5) * 50;
                const z = ((e.clientY - rect.top) / rect.height - 0.5) * 50;

                this.lastTarget = { x, y: 0, z };
            });
        }

        // ==================== SKILLS ====================

        /** Teleport - mouse pozisyonuna veya verilen koordinata */
        tp(x, z) {
            const target = (x !== undefined) ? { x, y: 0, z } : this.lastTarget;
            this.sendSkill('TELEPORT', target);
            log(`TP: ${target.x.toFixed(1)}, ${target.z.toFixed(1)}`);
        }

        /** Homing Missile - mouse yönüne */
        m() {
            this.sendSkill('HOMING_MISSILE', this.lastTarget);
            log('Missile!');
        }

        /** Laser - mouse yönüne */
        l() {
            this.sendSkill('LASER_BEAM', this.lastTarget);
            log('Laser!');
        }

        /** Invincibility */
        i() {
            this.sendSkill('INVINCIBILITY', null);
            log('Invincible!');
        }

        // ==================== AUTO ====================

        /** Auto attack - tüm skilleri spam */
        auto(ms = 300) {
            if (this.autoId) {
                clearInterval(this.autoId);
                this.autoId = null;
                warn('Auto OFF');
                return;
            }

            this.autoId = setInterval(() => {
                // Sırayla skill at
                this.m();
            }, ms);

            log(`Auto ON (${ms}ms)`);
        }

        /** Tüm skilleri aynı anda spam */
        spam(ms = 500) {
            if (this.autoId) {
                clearInterval(this.autoId);
                this.autoId = null;
                warn('Spam OFF');
                return;
            }

            let i = 0;
            this.autoId = setInterval(() => {
                const skills = ['HOMING_MISSILE', 'LASER_BEAM', 'TELEPORT'];
                this.sendSkill(skills[i % 3], this.lastTarget);
                i++;
            }, ms);

            log(`Spam ON (${ms}ms)`);
        }

        /** Sadece laser spam */
        laserSpam(ms = 100) {
            if (this.autoId) {
                clearInterval(this.autoId);
                this.autoId = null;
                warn('Laser spam OFF');
                return;
            }

            this.autoId = setInterval(() => {
                this.sendSkill('LASER_BEAM', this.lastTarget);
            }, ms);

            log(`Laser spam ON (${ms}ms)`);
        }

        /** Durdur */
        stop() {
            if (this.autoId) {
                clearInterval(this.autoId);
                this.autoId = null;
                warn('Durduruldu');
            }
        }

        // ==================== CORE ====================

        sendSkill(type, target) {
            const msg = {
                type: 'SKILL_REQUEST',
                skillType: type,
                targetPosition: target || { x: 0, y: 0, z: 0 },
                direction: target ? this.normalize(target) : { x: 0, y: 0, z: 1 },
                timestamp: Date.now()
            };

            if (this.nm._isHost && this.nm.broadcast) {
                this.nm.broadcast(msg);
            } else if (this.nm.sendToHost) {
                this.nm.sendToHost(msg);
            }
        }

        normalize(v) {
            const len = Math.sqrt(v.x*v.x + v.z*v.z) || 1;
            return { x: v.x/len, y: 0, z: v.z/len };
        }

        // ==================== HELP ====================

        help() {
            console.log(`
%c╔═══════════════════════════════════════╗
║       🥷 NINJA CHEAT v3.0 🥷          ║
╠═══════════════════════════════════════╣
║  Skills (mouse yönüne):               ║
║    cheat.m()     → Missile            ║
║    cheat.l()     → Laser              ║
║    cheat.i()     → Invincibility      ║
║    cheat.tp()    → Teleport (mouse)   ║
║    cheat.tp(5,10)→ Teleport (x,z)     ║
║  ─────────────────────────────────    ║
║  Auto:                                ║
║    cheat.auto()  → Missile spam       ║
║    cheat.auto(100) → Daha hızlı       ║
║    cheat.laserSpam() → Laser spam     ║
║    cheat.spam()  → Tüm skill spam     ║
║    cheat.stop()  → Durdur             ║
╚═══════════════════════════════════════╝`,
            'color: #0f0; font-family: monospace');
        }
    }

    window.cheat = new Cheat().init();

})();
