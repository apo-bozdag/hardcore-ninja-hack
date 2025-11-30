/**
 * Hardcore Ninja - Browser Cheat Script
 * =====================================
 *
 * Bu script, Hardcore Ninja oyunu için tarayıcı hilesidir.
 * Sadece eğitim ve CTF amaçlı kullanılmalıdır.
 *
 * Kullanım: Tarayıcı konsoluna (F12) yapıştırın ve çalıştırın.
 *
 * Önemli: Bazı hileler sadece HOST oyuncu için çalışır!
 */

(function() {
    'use strict';

    const CHEAT_VERSION = '1.0.0';

    // ==================== UTILITIES ====================

    const log = (msg, type = 'info') => {
        const styles = {
            info: 'color: #00ff00; font-weight: bold;',
            warn: 'color: #ffff00; font-weight: bold;',
            error: 'color: #ff0000; font-weight: bold;',
            success: 'color: #00ffff; font-weight: bold;'
        };
        console.log(`%c[NinjaCheat] ${msg}`, styles[type] || styles.info);
    };

    // ==================== GAME ACCESS ====================

    /**
     * React Fiber üzerinden GameClient instance'ına erişim
     */
    function findReactFiberRoot() {
        const container = document.getElementById('root');
        if (!container) return null;

        const key = Object.keys(container).find(k => k.startsWith('__reactFiber'));
        return container[key];
    }

    function findGameClient() {
        // Yöntem 1: Window üzerinde expose edilmiş objeler
        if (window.gameClient) return window.gameClient;
        if (window.game) return window.game;

        // Yöntem 2: React state içinde ara
        const fiber = findReactFiberRoot();
        if (fiber) {
            let current = fiber;
            while (current) {
                if (current.memoizedState?.gameClient) {
                    return current.memoizedState.gameClient;
                }
                if (current.stateNode?.gameClient) {
                    return current.stateNode.gameClient;
                }
                current = current.child || current.sibling || current.return;
            }
        }

        // Yöntem 3: Global değişkenleri tara
        for (const key of Object.keys(window)) {
            const obj = window[key];
            if (obj && typeof obj === 'object') {
                if (obj.networkManager && obj.renderer && obj.inputManager) {
                    return obj;
                }
            }
        }

        return null;
    }

    function findGameServer() {
        // GameServer HOST tarafında çalışır
        if (window.gameServer) return window.gameServer;

        const client = findGameClient();
        if (client?.gameServer) return client.gameServer;

        for (const key of Object.keys(window)) {
            const obj = window[key];
            if (obj && typeof obj === 'object') {
                if (obj.entityManager?.players && obj.networkManager) {
                    if (obj.handlePlayerInput || obj.handleSkillRequest) {
                        return obj;
                    }
                }
            }
        }

        return null;
    }

    // ==================== CHEAT CLASS ====================

    class NinjaCheat {
        constructor() {
            this.enabled = false;
            this.gameClient = null;
            this.gameServer = null;
            this.features = {
                godMode: false,
                infiniteCooldown: false,
                speedHack: false,
                autoAim: false,
                esp: false,
                oneHitKill: false,
                autoTeleport: false,
                rapidFire: false
            };
            this.speedMultiplier = 2.0;
            this.originalMethods = {};
            this.intervalIds = [];
        }

        init() {
            log(`Hardcore Ninja Cheat v${CHEAT_VERSION} başlatılıyor...`);

            this.gameClient = findGameClient();
            this.gameServer = findGameServer();

            if (this.gameClient) {
                log('GameClient bulundu!', 'success');
            } else {
                log('GameClient bulunamadı. Oyun yüklendikten sonra tekrar deneyin.', 'warn');
            }

            if (this.gameServer) {
                log('GameServer bulundu! (HOST modu aktif)', 'success');
            } else {
                log('GameServer bulunamadı. HOST değilsiniz veya henüz yüklenmedi.', 'warn');
            }

            this.enabled = true;
            this.setupHotkeys();
            this.showMenu();

            return this;
        }

        // ==================== HOST CHEATS ====================

        /**
         * God Mode - Hasar almayı engeller (HOST only)
         */
        enableGodMode() {
            if (!this.gameServer) {
                log('God Mode için HOST olmalısınız!', 'error');
                return;
            }

            const entityManager = this.gameServer.entityManager;
            if (!entityManager) return;

            const localId = this.gameClient?.localPlayerId;
            if (!localId) return;

            const player = entityManager.players?.get(localId);
            if (player) {
                // Original takeDamage metodunu sakla
                if (!this.originalMethods.takeDamage) {
                    this.originalMethods.takeDamage = player.takeDamage.bind(player);
                }

                // takeDamage'ı override et
                player.takeDamage = (damage, attackerId) => {
                    log(`Hasar engellendi: ${damage} (from ${attackerId})`);
                    return; // Hasar almayı engelle
                };

                // Sağlığı maksimumda tut
                player.health = player.maxHealth || 100;

                this.features.godMode = true;
                log('God Mode AKTİF!', 'success');
            }
        }

        disableGodMode() {
            if (this.originalMethods.takeDamage && this.gameServer) {
                const localId = this.gameClient?.localPlayerId;
                const player = this.gameServer.entityManager?.players?.get(localId);
                if (player) {
                    player.takeDamage = this.originalMethods.takeDamage;
                }
            }
            this.features.godMode = false;
            log('God Mode KAPALI', 'warn');
        }

        /**
         * One Hit Kill - Tek vuruşta öldür (HOST only)
         */
        enableOneHitKill() {
            if (!this.gameServer) {
                log('One Hit Kill için HOST olmalısınız!', 'error');
                return;
            }

            const entityManager = this.gameServer.entityManager;
            const localId = this.gameClient?.localPlayerId;

            if (entityManager?.players) {
                entityManager.players.forEach((player, id) => {
                    if (id !== localId) {
                        // Rakiplerin maxHealth'ini düşür
                        if (!player._originalMaxHealth) {
                            player._originalMaxHealth = player.maxHealth;
                        }
                        player.maxHealth = 1;
                        player.health = Math.min(player.health, 1);
                    }
                });
            }

            this.features.oneHitKill = true;
            log('One Hit Kill AKTİF!', 'success');
        }

        /**
         * Tüm rakipleri öldür (HOST only)
         */
        killAllEnemies() {
            if (!this.gameServer) {
                log('Kill All için HOST olmalısınız!', 'error');
                return;
            }

            const entityManager = this.gameServer.entityManager;
            const localId = this.gameClient?.localPlayerId;

            if (entityManager?.players) {
                entityManager.players.forEach((player, id) => {
                    if (id !== localId && player.health > 0) {
                        player.takeDamage(9999, localId);
                        log(`Oyuncu öldürüldü: ${id}`);
                    }
                });
            }

            log('Tüm rakipler öldürüldü!', 'success');
        }

        // ==================== CLIENT CHEATS ====================

        /**
         * Infinite Cooldown Bypass - Yetenek bekleme süresini sıfırla
         */
        enableInfiniteCooldown() {
            const gameState = this.gameClient?.currentGameState;
            const localId = this.gameClient?.localPlayerId;

            if (!gameState || !localId) {
                log('Game state bulunamadı!', 'error');
                return;
            }

            // Cooldown'ları sürekli sıfırla
            const intervalId = setInterval(() => {
                const playerState = gameState.players?.[localId];
                if (playerState) {
                    playerState.teleportCooldown = 0;
                    playerState.missileCooldown = 0;
                    playerState.laserCooldown = 0;
                    playerState.invincibilityCooldown = 0;
                }
            }, 100);

            this.intervalIds.push(intervalId);
            this.features.infiniteCooldown = true;
            log('Infinite Cooldown AKTİF! (Görsel - sunucu hala kontrol eder)', 'success');
        }

        /**
         * Speed Hack - Hareket hızını artır
         */
        enableSpeedHack(multiplier = 2.0) {
            this.speedMultiplier = multiplier;

            // Client-side hareket hızı manipülasyonu
            // Not: Sunucu pozisyonu doğrulayabilir

            const intervalId = setInterval(() => {
                const gameState = this.gameClient?.currentGameState;
                const localId = this.gameClient?.localPlayerId;

                if (gameState?.players?.[localId]) {
                    // Hız çarpanı uygula (eğer velocity varsa)
                    const player = gameState.players[localId];
                    if (player.velocity) {
                        player.velocity.x *= this.speedMultiplier;
                        player.velocity.z *= this.speedMultiplier;
                    }
                }
            }, 16);

            this.intervalIds.push(intervalId);
            this.features.speedHack = true;
            log(`Speed Hack AKTİF! (${multiplier}x)`, 'success');
        }

        /**
         * ESP - Duvarların arkasını gör
         */
        enableESP() {
            const scene = this.gameClient?.renderer?.scene;

            if (!scene) {
                log('Scene bulunamadı!', 'error');
                return;
            }

            // Tüm mesh'leri yarı-saydam yap (duvarlar dahil)
            scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    if (!object._originalOpacity) {
                        object._originalOpacity = object.material.opacity;
                        object._originalTransparent = object.material.transparent;
                    }

                    // Duvarları ve kutuları yarı-saydam yap
                    if (object.name?.includes('wall') || object.name?.includes('box')) {
                        object.material.transparent = true;
                        object.material.opacity = 0.3;
                    }
                }
            });

            // Düşman oyuncuları vurgula
            const intervalId = setInterval(() => {
                this.highlightEnemies();
            }, 100);

            this.intervalIds.push(intervalId);
            this.features.esp = true;
            log('ESP AKTİF!', 'success');
        }

        highlightEnemies() {
            const entityManager = this.gameClient?.entityManager;
            const localId = this.gameClient?.localPlayerId;

            if (!entityManager?.players) return;

            entityManager.players.forEach((playerData, id) => {
                if (id !== localId && playerData.mesh) {
                    // Düşmanlara parlak renk ver
                    playerData.mesh.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.emissive?.setHex(0xff0000);
                            child.material.emissiveIntensity = 0.5;
                        }
                    });
                }
            });
        }

        /**
         * Auto Aim - Otomatik hedefleme
         */
        enableAutoAim() {
            const inputManager = this.gameClient?.inputManager;

            if (!inputManager) {
                log('InputManager bulunamadı!', 'error');
                return;
            }

            // Mouse pozisyonunu en yakın düşmana yönlendir
            const intervalId = setInterval(() => {
                const target = this.findNearestEnemy();
                if (target) {
                    // InputManager'ın mouse pozisyonunu güncelle
                    const camera = this.gameClient?.renderer?.camera;
                    if (camera) {
                        const screenPos = target.clone().project(camera);
                        inputManager.mousePosition.x = (screenPos.x + 1) / 2;
                        inputManager.mousePosition.y = (-screenPos.y + 1) / 2;
                    }
                }
            }, 50);

            this.intervalIds.push(intervalId);
            this.features.autoAim = true;
            log('Auto Aim AKTİF!', 'success');
        }

        findNearestEnemy() {
            const gameState = this.gameClient?.currentGameState;
            const localId = this.gameClient?.localPlayerId;

            if (!gameState?.players || !localId) return null;

            const myPos = gameState.players[localId]?.position;
            if (!myPos) return null;

            let nearest = null;
            let nearestDist = Infinity;

            Object.entries(gameState.players).forEach(([id, player]) => {
                if (id !== localId && player.health > 0) {
                    const pos = player.position;
                    if (pos) {
                        const dist = Math.sqrt(
                            Math.pow(pos.x - myPos.x, 2) +
                            Math.pow(pos.z - myPos.z, 2)
                        );
                        if (dist < nearestDist) {
                            nearestDist = dist;
                            nearest = new THREE.Vector3(pos.x, pos.y || 0, pos.z);
                        }
                    }
                }
            });

            return nearest;
        }

        /**
         * Teleport Hack - İstediğin yere ışınlan
         */
        teleportTo(x, z) {
            const networkManager = this.gameClient?.networkManager;

            if (!networkManager) {
                log('NetworkManager bulunamadı!', 'error');
                return;
            }

            // SKILL_REQUEST mesajı gönder (teleport)
            const message = {
                type: 'SKILL_REQUEST',
                skillType: 'TELEPORT',
                targetPosition: { x, y: 0, z },
                timestamp: Date.now()
            };

            if (networkManager.isHost) {
                networkManager.broadcast(message);
            } else {
                networkManager.sendToHost(message);
            }

            log(`Teleport: (${x}, ${z})`, 'success');
        }

        /**
         * Rapid Fire - Hızlı ateş (spam yetenekler)
         */
        enableRapidFire() {
            const networkManager = this.gameClient?.networkManager;

            if (!networkManager) {
                log('NetworkManager bulunamadı!', 'error');
                return;
            }

            // Her 100ms'de skill request spam'le
            const intervalId = setInterval(() => {
                const target = this.findNearestEnemy();
                if (!target) return;

                const localPos = this.getMyPosition();
                if (!localPos) return;

                const direction = {
                    x: target.x - localPos.x,
                    y: 0,
                    z: target.z - localPos.z
                };

                // Normalize
                const len = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
                direction.x /= len;
                direction.z /= len;

                // Homing missile spam
                const message = {
                    type: 'SKILL_REQUEST',
                    skillType: 'HOMING_MISSILE',
                    targetPosition: target,
                    direction,
                    timestamp: Date.now()
                };

                if (networkManager.isHost) {
                    networkManager.broadcast(message);
                } else {
                    networkManager.sendToHost(message);
                }
            }, 100);

            this.intervalIds.push(intervalId);
            this.features.rapidFire = true;
            log('Rapid Fire AKTİF!', 'success');
        }

        getMyPosition() {
            const gameState = this.gameClient?.currentGameState;
            const localId = this.gameClient?.localPlayerId;
            return gameState?.players?.[localId]?.position;
        }

        // ==================== CONTROL ====================

        setupHotkeys() {
            document.addEventListener('keydown', (e) => {
                if (!this.enabled) return;

                // Numpad tuşları
                switch(e.code) {
                    case 'Numpad1':
                        this.toggleFeature('godMode');
                        break;
                    case 'Numpad2':
                        this.toggleFeature('infiniteCooldown');
                        break;
                    case 'Numpad3':
                        this.toggleFeature('speedHack');
                        break;
                    case 'Numpad4':
                        this.toggleFeature('esp');
                        break;
                    case 'Numpad5':
                        this.toggleFeature('autoAim');
                        break;
                    case 'Numpad6':
                        this.toggleFeature('rapidFire');
                        break;
                    case 'Numpad7':
                        this.killAllEnemies();
                        break;
                    case 'Numpad0':
                        this.showMenu();
                        break;
                    case 'Insert':
                        this.toggleAll();
                        break;
                }
            });

            log('Hotkey\'ler ayarlandı! Numpad tuşlarını kullanın.', 'info');
        }

        toggleFeature(feature) {
            switch(feature) {
                case 'godMode':
                    this.features.godMode ? this.disableGodMode() : this.enableGodMode();
                    break;
                case 'infiniteCooldown':
                    if (!this.features.infiniteCooldown) this.enableInfiniteCooldown();
                    else this.disableFeature('infiniteCooldown');
                    break;
                case 'speedHack':
                    if (!this.features.speedHack) this.enableSpeedHack();
                    else this.disableFeature('speedHack');
                    break;
                case 'esp':
                    if (!this.features.esp) this.enableESP();
                    else this.disableFeature('esp');
                    break;
                case 'autoAim':
                    if (!this.features.autoAim) this.enableAutoAim();
                    else this.disableFeature('autoAim');
                    break;
                case 'rapidFire':
                    if (!this.features.rapidFire) this.enableRapidFire();
                    else this.disableFeature('rapidFire');
                    break;
            }
        }

        disableFeature(feature) {
            this.features[feature] = false;
            log(`${feature} KAPALI`, 'warn');
        }

        toggleAll() {
            this.enabled = !this.enabled;
            if (!this.enabled) {
                this.cleanup();
                log('Tüm hileler KAPALI', 'warn');
            } else {
                log('Hileler AKTİF', 'success');
            }
        }

        cleanup() {
            // Tüm interval'ları temizle
            this.intervalIds.forEach(id => clearInterval(id));
            this.intervalIds = [];

            // Orijinal metodları geri yükle
            if (this.originalMethods.takeDamage && this.gameServer) {
                const localId = this.gameClient?.localPlayerId;
                const player = this.gameServer.entityManager?.players?.get(localId);
                if (player) {
                    player.takeDamage = this.originalMethods.takeDamage;
                }
            }

            // Feature'ları sıfırla
            Object.keys(this.features).forEach(key => {
                this.features[key] = false;
            });
        }

        showMenu() {
            console.log(`
%c╔══════════════════════════════════════════════════════════════╗
║             🥷 HARDCORE NINJA CHEAT v${CHEAT_VERSION} 🥷              ║
╠══════════════════════════════════════════════════════════════╣
║  [Numpad 1] God Mode         ${this.features.godMode ? '✅ ON' : '❌ OFF'}  (HOST only)           ║
║  [Numpad 2] Infinite CD      ${this.features.infiniteCooldown ? '✅ ON' : '❌ OFF'}                       ║
║  [Numpad 3] Speed Hack       ${this.features.speedHack ? '✅ ON' : '❌ OFF'}  (${this.speedMultiplier}x)                  ║
║  [Numpad 4] ESP              ${this.features.esp ? '✅ ON' : '❌ OFF'}                       ║
║  [Numpad 5] Auto Aim         ${this.features.autoAim ? '✅ ON' : '❌ OFF'}                       ║
║  [Numpad 6] Rapid Fire       ${this.features.rapidFire ? '✅ ON' : '❌ OFF'}                       ║
║  [Numpad 7] Kill All         (HOST only)                     ║
║  [Numpad 0] Show Menu                                        ║
║  [Insert]   Toggle All                                       ║
╠══════════════════════════════════════════════════════════════╣
║  Komutlar:                                                   ║
║  cheat.teleportTo(x, z)  - Koordinata ışınlan                ║
║  cheat.killAllEnemies()  - Tüm düşmanları öldür              ║
║  cheat.enableSpeedHack(3) - 3x hız                           ║
╚══════════════════════════════════════════════════════════════╝`,
            'color: #00ff00; font-family: monospace; font-size: 12px;');
        }

        // ==================== DEBUG ====================

        debug() {
            console.log('=== DEBUG INFO ===');
            console.log('GameClient:', this.gameClient);
            console.log('GameServer:', this.gameServer);
            console.log('LocalPlayerId:', this.gameClient?.localPlayerId);
            console.log('GameState:', this.gameClient?.currentGameState);
            console.log('NetworkManager:', this.gameClient?.networkManager);
            console.log('IsHost:', this.gameClient?.networkManager?.isHost);
            console.log('Features:', this.features);
        }

        /**
         * Oyun state'ini konsola yazdır
         */
        printGameState() {
            const state = this.gameClient?.currentGameState;
            if (state) {
                console.log('=== GAME STATE ===');
                console.log('Mode:', state.gameMode);
                console.log('Round:', state.currentRound);
                console.log('Players:');
                Object.entries(state.players || {}).forEach(([id, player]) => {
                    console.log(`  ${id}: HP=${player.health}, Pos=(${player.position?.x?.toFixed(2)}, ${player.position?.z?.toFixed(2)})`);
                });
            }
        }
    }

    // ==================== INITIALIZATION ====================

    // Global erişim için
    window.NinjaCheat = NinjaCheat;
    window.cheat = new NinjaCheat().init();

    log('Cheat yüklendi! "cheat" objesi kullanılabilir.', 'success');
    log('Menüyü görmek için Numpad 0 tuşuna basın.', 'info');

})();
