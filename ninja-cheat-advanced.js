/**
 * Hardcore Ninja - Advanced Cheat Module
 * =======================================
 *
 * Gelişmiş hileler ve network manipulation
 * Ana cheat script'ini yükledikten sonra kullanın.
 */

(function() {
    'use strict';

    if (!window.cheat) {
        console.error('[AdvancedCheat] Ana cheat scripti yüklü değil! Önce ninja-cheat.js yükleyin.');
        return;
    }

    const log = (msg, type = 'info') => {
        const styles = {
            info: 'color: #ff00ff; font-weight: bold;',
            warn: 'color: #ffff00; font-weight: bold;',
            error: 'color: #ff0000; font-weight: bold;',
            success: 'color: #00ffff; font-weight: bold;'
        };
        console.log(`%c[AdvancedCheat] ${msg}`, styles[type] || styles.info);
    };

    // ==================== NETWORK MANIPULATION ====================

    class NetworkManipulator {
        constructor(cheat) {
            this.cheat = cheat;
            this.originalSend = null;
            this.originalOnData = null;
            this.intercepting = false;
            this.messageLog = [];
        }

        /**
         * Network mesajlarını intercept et
         */
        startIntercepting() {
            const nm = this.cheat.gameClient?.networkManager;
            if (!nm) {
                log('NetworkManager bulunamadı!', 'error');
                return;
            }

            // broadcast metodunu intercept et
            if (!this.originalSend && nm.broadcast) {
                this.originalSend = nm.broadcast.bind(nm);
                nm.broadcast = (data) => {
                    this.onOutgoingMessage(data);
                    return this.originalSend(data);
                };
            }

            // sendToHost metodunu intercept et
            if (nm.sendToHost) {
                const originalSendToHost = nm.sendToHost.bind(nm);
                nm.sendToHost = (data) => {
                    this.onOutgoingMessage(data);
                    return originalSendToHost(data);
                };
            }

            this.intercepting = true;
            log('Network interception başladı!', 'success');
        }

        onOutgoingMessage(data) {
            this.messageLog.push({
                direction: 'OUT',
                timestamp: Date.now(),
                data: JSON.parse(JSON.stringify(data))
            });

            // Mesaj manipülasyonu
            if (data.type === 'SKILL_REQUEST') {
                // Cooldown bypass - timestamp manipülasyonu
                data.timestamp = Date.now() - 10000; // 10 saniye önce gibi göster
            }
        }

        /**
         * Fake mesaj gönder
         */
        sendFakeMessage(message) {
            const nm = this.cheat.gameClient?.networkManager;
            if (!nm) return;

            if (nm.isHost) {
                nm.broadcast(message);
            } else {
                nm.sendToHost(message);
            }

            log(`Fake mesaj gönderildi: ${message.type}`, 'success');
        }

        /**
         * Fake oyuncu hareketi gönder
         */
        sendFakeMovement(x, z) {
            this.sendFakeMessage({
                type: 'PLAYER_INPUT',
                position: { x, y: 0, z },
                rotation: 0,
                timestamp: Date.now()
            });
        }

        /**
         * Fake skill request gönder
         */
        sendFakeSkill(skillType, targetX, targetZ) {
            const localPos = this.cheat.getMyPosition();
            const direction = {
                x: targetX - (localPos?.x || 0),
                y: 0,
                z: targetZ - (localPos?.z || 0)
            };

            // Normalize
            const len = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
            direction.x /= len;
            direction.z /= len;

            this.sendFakeMessage({
                type: 'SKILL_REQUEST',
                skillType: skillType,
                targetPosition: { x: targetX, y: 0, z: targetZ },
                direction: direction,
                timestamp: Date.now()
            });
        }

        /**
         * Message log'u göster
         */
        showLog() {
            console.table(this.messageLog.slice(-20));
        }
    }

    // ==================== MEMORY SCANNER ====================

    class MemoryScanner {
        constructor(cheat) {
            this.cheat = cheat;
        }

        /**
         * Window üzerindeki tüm oyun objelerini bul
         */
        scanWindow() {
            const results = {
                gameClients: [],
                gameServers: [],
                networkManagers: [],
                renderers: [],
                scenes: [],
                threeObjects: []
            };

            for (const key of Object.keys(window)) {
                try {
                    const obj = window[key];
                    if (!obj || typeof obj !== 'object') continue;

                    // GameClient benzeri objeler
                    if (obj.networkManager && obj.renderer) {
                        results.gameClients.push({ key, obj });
                    }

                    // NetworkManager benzeri objeler
                    if (obj.peer && obj.connections) {
                        results.networkManagers.push({ key, obj });
                    }

                    // THREE.js objeler
                    if (obj.isScene) {
                        results.scenes.push({ key, obj });
                    }
                    if (obj.isWebGLRenderer) {
                        results.renderers.push({ key, obj });
                    }

                } catch (e) {
                    // Erişilemeyen objeler için sessizce devam et
                }
            }

            console.log('=== MEMORY SCAN RESULTS ===');
            console.log('GameClients:', results.gameClients);
            console.log('NetworkManagers:', results.networkManagers);
            console.log('Scenes:', results.scenes);
            console.log('Renderers:', results.renderers);

            return results;
        }

        /**
         * THREE.js sahnesindeki tüm mesh'leri listele
         */
        listSceneMeshes() {
            const scene = this.cheat.gameClient?.renderer?.scene;
            if (!scene) {
                log('Scene bulunamadı!', 'error');
                return;
            }

            const meshes = [];
            scene.traverse((obj) => {
                if (obj.isMesh) {
                    meshes.push({
                        name: obj.name,
                        type: obj.type,
                        position: obj.position.clone(),
                        visible: obj.visible
                    });
                }
            });

            console.table(meshes);
            return meshes;
        }
    }

    // ==================== VISUAL CHEATS ====================

    class VisualCheats {
        constructor(cheat) {
            this.cheat = cheat;
            this.overlayDiv = null;
            this.radarCanvas = null;
        }

        /**
         * Ekran üstü bilgi paneli
         */
        createOverlay() {
            if (this.overlayDiv) return;

            this.overlayDiv = document.createElement('div');
            this.overlayDiv.id = 'ninja-cheat-overlay';
            this.overlayDiv.innerHTML = `
                <style>
                    #ninja-cheat-overlay {
                        position: fixed;
                        top: 10px;
                        left: 10px;
                        background: rgba(0, 0, 0, 0.8);
                        color: #00ff00;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        padding: 10px;
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        z-index: 99999;
                        min-width: 200px;
                    }
                    #ninja-cheat-overlay .title {
                        color: #ff00ff;
                        font-weight: bold;
                        border-bottom: 1px solid #00ff00;
                        margin-bottom: 5px;
                        padding-bottom: 5px;
                    }
                    #ninja-cheat-overlay .enemy {
                        color: #ff0000;
                    }
                    #ninja-cheat-overlay .me {
                        color: #00ffff;
                    }
                </style>
                <div class="title">🥷 NINJA CHEAT</div>
                <div id="cheat-info"></div>
            `;

            document.body.appendChild(this.overlayDiv);

            // Güncelleme loop'u
            setInterval(() => this.updateOverlay(), 100);

            log('Overlay oluşturuldu!', 'success');
        }

        updateOverlay() {
            const infoDiv = document.getElementById('cheat-info');
            if (!infoDiv) return;

            const gameState = this.cheat.gameClient?.currentGameState;
            const localId = this.cheat.gameClient?.localPlayerId;

            if (!gameState) {
                infoDiv.innerHTML = 'Oyun yükleniyor...';
                return;
            }

            let html = '';

            // Oyun modu
            html += `<div>Mode: ${gameState.gameMode || 'N/A'}</div>`;
            html += `<div>Round: ${gameState.currentRound || 0}</div>`;
            html += '<hr style="border-color: #00ff00; margin: 5px 0;">';

            // Oyuncular
            Object.entries(gameState.players || {}).forEach(([id, player]) => {
                const isMe = id === localId;
                const className = isMe ? 'me' : 'enemy';
                const prefix = isMe ? '👤' : '🎯';

                html += `<div class="${className}">`;
                html += `${prefix} ${player.name || id.substring(0, 8)}`;
                html += ` | HP: ${player.health || 0}`;

                if (!isMe && player.position) {
                    const myPos = gameState.players[localId]?.position;
                    if (myPos) {
                        const dist = Math.sqrt(
                            Math.pow(player.position.x - myPos.x, 2) +
                            Math.pow(player.position.z - myPos.z, 2)
                        ).toFixed(1);
                        html += ` | ${dist}m`;
                    }
                }

                html += '</div>';
            });

            // Aktif hileler
            html += '<hr style="border-color: #00ff00; margin: 5px 0;">';
            html += '<div style="color: #ffff00;">Aktif:</div>';
            Object.entries(this.cheat.features).forEach(([key, val]) => {
                if (val) {
                    html += `<div style="color: #00ff00;">✓ ${key}</div>`;
                }
            });

            infoDiv.innerHTML = html;
        }

        /**
         * Mini radar/harita
         */
        createRadar() {
            if (this.radarCanvas) return;

            const container = document.createElement('div');
            container.id = 'ninja-radar';
            container.innerHTML = `
                <style>
                    #ninja-radar {
                        position: fixed;
                        bottom: 10px;
                        right: 10px;
                        z-index: 99999;
                    }
                    #ninja-radar canvas {
                        background: rgba(0, 0, 0, 0.7);
                        border: 2px solid #00ff00;
                        border-radius: 50%;
                    }
                </style>
                <canvas id="radar-canvas" width="150" height="150"></canvas>
            `;

            document.body.appendChild(container);
            this.radarCanvas = document.getElementById('radar-canvas');

            // Radar güncelleme loop'u
            setInterval(() => this.updateRadar(), 50);

            log('Radar oluşturuldu!', 'success');
        }

        updateRadar() {
            if (!this.radarCanvas) return;

            const ctx = this.radarCanvas.getContext('2d');
            const gameState = this.cheat.gameClient?.currentGameState;
            const localId = this.cheat.gameClient?.localPlayerId;

            if (!gameState || !localId) return;

            const myPos = gameState.players[localId]?.position;
            if (!myPos) return;

            const centerX = 75;
            const centerY = 75;
            const scale = 3; // 1 birim = 3 pixel

            // Temizle
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 73, 0, Math.PI * 2);
            ctx.fill();

            // Grid çizgileri
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.beginPath();
            ctx.moveTo(centerX, 0);
            ctx.lineTo(centerX, 150);
            ctx.moveTo(0, centerY);
            ctx.lineTo(150, centerY);
            ctx.stroke();

            // Daireler
            ctx.beginPath();
            ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
            ctx.stroke();

            // Oyuncuları çiz
            Object.entries(gameState.players).forEach(([id, player]) => {
                if (!player.position || player.health <= 0) return;

                const relX = (player.position.x - myPos.x) * scale;
                const relZ = (player.position.z - myPos.z) * scale;

                const drawX = centerX + relX;
                const drawY = centerY + relZ;

                // Radar sınırları içinde mi?
                const dist = Math.sqrt(relX * relX + relZ * relZ);
                if (dist > 70) return;

                ctx.beginPath();
                ctx.arc(drawX, drawY, 4, 0, Math.PI * 2);

                if (id === localId) {
                    ctx.fillStyle = '#00ffff';
                } else {
                    ctx.fillStyle = '#ff0000';
                }

                ctx.fill();
            });

            // Merkez (ben)
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        removeAll() {
            this.overlayDiv?.remove();
            this.overlayDiv = null;

            document.getElementById('ninja-radar')?.remove();
            this.radarCanvas = null;
        }
    }

    // ==================== BOT MODE ====================

    class BotMode {
        constructor(cheat) {
            this.cheat = cheat;
            this.running = false;
            this.intervalId = null;
        }

        /**
         * Otomatik oyun modu
         */
        start() {
            if (this.running) return;

            this.running = true;
            this.intervalId = setInterval(() => this.tick(), 100);

            log('Bot Mode başladı!', 'success');
        }

        stop() {
            this.running = false;
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            log('Bot Mode durdu', 'warn');
        }

        tick() {
            const gameState = this.cheat.gameClient?.currentGameState;
            const localId = this.cheat.gameClient?.localPlayerId;

            if (!gameState || !localId) return;

            const myPlayer = gameState.players[localId];
            if (!myPlayer || myPlayer.health <= 0) return;

            // En yakın düşmanı bul
            const target = this.findBestTarget(gameState, localId);

            if (target) {
                // Hedefe doğru hareket et
                this.moveTowards(target.position);

                // Yetenek kullan
                this.useSkillIfReady(myPlayer, target);
            }
        }

        findBestTarget(gameState, localId) {
            const myPos = gameState.players[localId]?.position;
            if (!myPos) return null;

            let best = null;
            let bestScore = -Infinity;

            Object.entries(gameState.players).forEach(([id, player]) => {
                if (id === localId || player.health <= 0) return;

                const dist = Math.sqrt(
                    Math.pow(player.position.x - myPos.x, 2) +
                    Math.pow(player.position.z - myPos.z, 2)
                );

                // Düşük HP'li ve yakın düşmanları tercih et
                const score = (100 - player.health) + (50 - dist);

                if (score > bestScore) {
                    bestScore = score;
                    best = { id, ...player };
                }
            });

            return best;
        }

        moveTowards(targetPos) {
            const nm = this.cheat.gameClient?.networkManager;
            if (!nm) return;

            const myPos = this.cheat.getMyPosition();
            if (!myPos) return;

            // Hedefe doğru yavaşça ilerle
            const dx = targetPos.x - myPos.x;
            const dz = targetPos.z - myPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 5) return; // Çok yakınsa hareket etme

            const speed = 0.5;
            const newX = myPos.x + (dx / dist) * speed;
            const newZ = myPos.z + (dz / dist) * speed;

            const message = {
                type: 'PLAYER_INPUT',
                position: { x: newX, y: 0, z: newZ },
                timestamp: Date.now()
            };

            if (nm.isHost) {
                nm.broadcast(message);
            } else {
                nm.sendToHost(message);
            }
        }

        useSkillIfReady(myPlayer, target) {
            const nm = this.cheat.gameClient?.networkManager;
            if (!nm) return;

            const myPos = this.cheat.getMyPosition();
            if (!myPos) return;

            const dist = Math.sqrt(
                Math.pow(target.position.x - myPos.x, 2) +
                Math.pow(target.position.z - myPos.z, 2)
            );

            let skillType = null;

            // Mesafeye göre yetenek seç
            if (myPlayer.missileCooldown === 0 && dist < 30) {
                skillType = 'HOMING_MISSILE';
            } else if (myPlayer.laserCooldown === 0 && dist < 15) {
                skillType = 'LASER_BEAM';
            } else if (myPlayer.teleportCooldown === 0 && dist > 20) {
                skillType = 'TELEPORT';
            }

            if (!skillType) return;

            const direction = {
                x: target.position.x - myPos.x,
                y: 0,
                z: target.position.z - myPos.z
            };
            const len = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1;
            direction.x /= len;
            direction.z /= len;

            const message = {
                type: 'SKILL_REQUEST',
                skillType: skillType,
                targetPosition: target.position,
                direction: direction,
                timestamp: Date.now()
            };

            if (nm.isHost) {
                nm.broadcast(message);
            } else {
                nm.sendToHost(message);
            }
        }
    }

    // ==================== INITIALIZATION ====================

    // Ana cheat objesine ekle
    window.cheat.network = new NetworkManipulator(window.cheat);
    window.cheat.memory = new MemoryScanner(window.cheat);
    window.cheat.visual = new VisualCheats(window.cheat);
    window.cheat.bot = new BotMode(window.cheat);

    // Kısayol fonksiyonları
    window.cheat.startBot = () => window.cheat.bot.start();
    window.cheat.stopBot = () => window.cheat.bot.stop();
    window.cheat.showOverlay = () => window.cheat.visual.createOverlay();
    window.cheat.showRadar = () => window.cheat.visual.createRadar();
    window.cheat.hideVisuals = () => window.cheat.visual.removeAll();
    window.cheat.intercept = () => window.cheat.network.startIntercepting();
    window.cheat.scan = () => window.cheat.memory.scanWindow();

    log('Advanced modül yüklendi!', 'success');
    console.log(`
%c╔══════════════════════════════════════════════════════════════╗
║           🔮 ADVANCED CHEAT MODULE LOADED 🔮                 ║
╠══════════════════════════════════════════════════════════════╣
║  Yeni Komutlar:                                              ║
║                                                              ║
║  cheat.showOverlay()  - Bilgi paneli göster                  ║
║  cheat.showRadar()    - Mini radar göster                    ║
║  cheat.hideVisuals()  - Tüm görselleri kapat                 ║
║                                                              ║
║  cheat.startBot()     - Bot modu başlat                      ║
║  cheat.stopBot()      - Bot modu durdur                      ║
║                                                              ║
║  cheat.intercept()    - Network mesajlarını izle             ║
║  cheat.network.showLog() - Mesaj logunu göster               ║
║                                                              ║
║  cheat.scan()         - Memory scan yap                      ║
║  cheat.memory.listSceneMeshes() - 3D objeleri listele        ║
╚══════════════════════════════════════════════════════════════╝`,
    'color: #ff00ff; font-family: monospace; font-size: 11px;');

})();
