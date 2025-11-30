/**
 * Hardcore Ninja Cheat v2.0
 * =========================
 * Düzgün çalışan versiyon - kaynak kod analizi sonrası
 */

(function() {
    'use strict';

    const log = (msg, type = 'info') => {
        const colors = { info: '#0f0', warn: '#ff0', error: '#f00', success: '#0ff' };
        console.log(`%c[Ninja] ${msg}`, `color:${colors[type]};font-weight:bold`);
    };

    // ==================== ANA CHEAT SINIFI ====================

    class NinjaCheat {
        constructor() {
            this.nm = null;           // NetworkManager
            this.gameState = null;    // Yakalanan game state
            this.myId = null;
            this.isHost = false;
            this.hooked = false;

            this.features = {
                rapidSkill: false,
                autoAttack: false
            };
            this.intervals = [];
        }

        init() {
            log('v2.0 başlatılıyor...');

            // NetworkManager'ı al
            this.nm = window.networkManager;
            if (!this.nm) {
                log('NetworkManager bulunamadı!', 'error');
                return this;
            }

            this.myId = this.nm.peer?.id;
            this.isHost = this.nm._isHost || false;

            log(`Peer ID: ${this.myId}`);
            log(`Host: ${this.isHost}`);

            // Mesajları hook'la
            this.hookMessages();

            log('Hazır! Komutlar için: cheat.help()', 'success');
            return this;
        }

        // ==================== NETWORK HOOK ====================

        hookMessages() {
            if (this.hooked) return;
            const self = this;

            // HOST için: broadcast fonksiyonunu hook'la
            if (this.nm.broadcast && !this.nm._origBroadcast) {
                this.nm._origBroadcast = this.nm.broadcast.bind(this.nm);
                this.nm.broadcast = (data) => {
                    self.onData(data, 'out');
                    return self.nm._origBroadcast(data);
                };
                log('Broadcast hook aktif', 'success');
            }

            // CLIENT için: sendToHost fonksiyonunu hook'la
            if (this.nm.sendToHost && !this.nm._origSendToHost) {
                this.nm._origSendToHost = this.nm.sendToHost.bind(this.nm);
                this.nm.sendToHost = (data) => {
                    self.onData(data, 'out');
                    return self.nm._origSendToHost(data);
                };
            }

            // PeerJS data connection'larını hook'la (gelen mesajlar için)
            const peer = this.nm.peer;
            if (peer) {
                // Mevcut bağlantıları hook'la
                if (peer._connections) {
                    Object.values(peer._connections).forEach(conns => {
                        if (Array.isArray(conns)) {
                            conns.forEach(conn => this.hookConn(conn));
                        }
                    });
                }

                // Yeni bağlantıları hook'la
                const origOn = peer.on.bind(peer);
                peer.on = (event, cb) => {
                    if (event === 'connection') {
                        return origOn(event, (conn) => {
                            self.hookConn(conn);
                            cb(conn);
                        });
                    }
                    return origOn(event, cb);
                };
            }

            this.hooked = true;
            log('Network hook aktif', 'success');
        }

        hookConn(conn) {
            if (!conn || conn._hooked) return;
            const self = this;

            // Data event'ini hook'la
            const origOn = conn.on.bind(conn);
            conn.on = (event, cb) => {
                if (event === 'data') {
                    return origOn(event, (data) => {
                        self.onData(data);
                        cb(data);
                    });
                }
                return origOn(event, cb);
            };

            conn._hooked = true;
        }

        onData(data, direction = 'in') {
            if (!data) return;

            // Game state'i yakala
            if (data.type === 'GAME_STATE_UPDATE') {
                if (data.gameState) {
                    this.gameState = data.gameState;
                } else if (data.state) {
                    this.gameState = data.state;
                }
                // İlk yakalamada log
                if (!this._stateLogged) {
                    log('Game state yakalandı!', 'success');
                    this._stateLogged = true;
                }
            }

            // Direkt state objesi de olabilir
            if (data.players && data.gameMode !== undefined) {
                this.gameState = data;
            }
        }

        // ==================== SKILL SPAM ====================

        /**
         * Skill gönder - cooldown sunucuda kontrol ediliyor
         * Ama yine de spam yapabiliriz, belki işe yarar
         */
        sendSkill(skillType, target) {
            if (!this.nm) return;

            const msg = {
                type: 'SKILL_REQUEST',
                skillType: skillType,
                timestamp: Date.now()
            };

            // Skill tipine göre doğru alan adını kullan
            if (skillType === 'TELEPORT' || skillType === 'HOMING_MISSILE') {
                msg.target = target || { x: 0, y: 0, z: 0 };
            } else if (skillType === 'LASER_BEAM') {
                msg.direction = target ? { x: target.x / (Math.sqrt(target.x*target.x + target.z*target.z) || 1), y: 0, z: target.z / (Math.sqrt(target.x*target.x + target.z*target.z) || 1) } : { x: 0, y: 0, z: 1 };
            }
            // INVINCIBILITY için ekstra alan gerekmiyor

            // HOST ise broadcast, değilse sendToHost
            if (this.isHost && this.nm.broadcast) {
                this.nm.broadcast(msg);
            } else if (this.nm.sendToHost) {
                this.nm.sendToHost(msg);
            }
        }

        /**
         * Teleport
         */
        tp(x, z) {
            this.sendSkill('TELEPORT', { x, y: 0, z });
            log(`Teleport: ${x}, ${z}`);
        }

        /**
         * Missile spam
         */
        missile() {
            const target = this.findEnemy();
            if (target) {
                this.sendSkill('HOMING_MISSILE', target);
                log('Missile gönderildi');
            } else {
                log('Hedef yok', 'warn');
            }
        }

        /**
         * Laser
         */
        laser() {
            this.sendSkill('LASER_BEAM', { x: 0, y: 0, z: 10 });
            log('Laser gönderildi');
        }

        /**
         * Invincibility
         */
        inv() {
            this.sendSkill('INVINCIBILITY', null);
            log('Invincibility gönderildi');
        }

        // ==================== AUTO ATTACK ====================

        /**
         * Otomatik saldırı - düşman varsa sürekli missile at
         */
        auto(interval = 500) {
            if (this.features.autoAttack) {
                this.stopAuto();
                return;
            }

            const id = setInterval(() => {
                const target = this.findEnemy();
                if (target) {
                    this.sendSkill('HOMING_MISSILE', target);
                }
            }, interval);

            this.intervals.push(id);
            this.features.autoAttack = true;
            log(`Auto attack ON (${interval}ms)`, 'success');
        }

        stopAuto() {
            this.intervals.forEach(id => clearInterval(id));
            this.intervals = [];
            this.features.autoAttack = false;
            log('Auto attack OFF', 'warn');
        }

        // ==================== HELPERS ====================

        findEnemy() {
            if (!this.gameState?.players) return null;

            const myPos = this.gameState.players[this.myId]?.position;
            if (!myPos) return null;

            let nearest = null;
            let minDist = Infinity;

            for (const [id, p] of Object.entries(this.gameState.players)) {
                if (id === this.myId || p.health <= 0) continue;

                const dx = p.position.x - myPos.x;
                const dz = p.position.z - myPos.z;
                const dist = Math.sqrt(dx*dx + dz*dz);

                if (dist < minDist) {
                    minDist = dist;
                    nearest = p.position;
                }
            }

            return nearest;
        }

        /**
         * Oyuncu listesi
         */
        players() {
            if (!this.gameState?.players) {
                log('State yok - biraz bekle', 'warn');
                return;
            }

            console.table(
                Object.entries(this.gameState.players).map(([id, p]) => ({
                    id: id.slice(0, 8),
                    me: id === this.myId ? '⭐' : '',
                    hp: p.health,
                    x: p.position?.x?.toFixed(1),
                    z: p.position?.z?.toFixed(1)
                }))
            );
        }

        /**
         * State göster
         */
        state() {
            if (this.gameState) {
                console.log('Game State:', this.gameState);
                return this.gameState;
            }
            log('State henüz yakalanmadı', 'warn');
        }

        /**
         * Yardım
         */
        help() {
            console.log(`
%c╔═══════════════════════════════════════╗
║     🥷 NINJA CHEAT v2.0 🥷            ║
╠═══════════════════════════════════════╣
║  cheat.tp(x, z)   → Işınlan           ║
║  cheat.missile()  → Missile at        ║
║  cheat.laser()    → Laser at          ║
║  cheat.inv()      → Invincibility     ║
║  ─────────────────────────────────    ║
║  cheat.auto()     → Auto attack ON    ║
║  cheat.auto(200)  → 200ms aralıkla    ║
║  cheat.stopAuto() → Auto attack OFF   ║
║  ─────────────────────────────────    ║
║  cheat.players()  → Oyuncu listesi    ║
║  cheat.state()    → Game state        ║
╚═══════════════════════════════════════╝`,
            'color: #0f0; font-family: monospace');
        }
    }

    // ==================== INIT ====================

    window.cheat = new NinjaCheat().init();

})();
