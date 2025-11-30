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

    const CHEAT_VERSION = '1.2.0';

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
        if (window._gameClient) return window._gameClient;

        // Yöntem 2: NetworkManager üzerinden (oyun bunu expose ediyor!)
        if (window.networkManager) {
            // NetworkManager'dan GameClient'a referans bulmaya çalış
            const nm = window.networkManager;
            // GameClient referansını bul - parent scope veya callback'lerden
            for (const key of Object.keys(nm)) {
                const val = nm[key];
                if (val && typeof val === 'object' && val.renderer && val.entityManager) {
                    return val;
                }
            }
        }

        // Yöntem 3: React Fiber - daha derin arama
        const fiber = findReactFiberRoot();
        if (fiber) {
            const queue = [fiber];
            const visited = new Set();

            while (queue.length > 0) {
                const node = queue.shift();
                if (!node || visited.has(node)) continue;
                visited.add(node);

                // memoizedState zincirini tara (React hooks)
                let hookState = node.memoizedState;
                while (hookState) {
                    // useState hook'larını kontrol et
                    if (hookState.memoizedState && typeof hookState.memoizedState === 'object') {
                        const state = hookState.memoizedState;
                        // GameClient özellikleri
                        if (state.renderer && state.networkManager) return state;
                        if (state.entityManager && state.inputManager) return state;
                        // Array ise [value, setter] şeklinde
                        if (Array.isArray(state) && state[0]?.renderer) return state[0];
                    }
                    hookState = hookState.next;
                }

                // Alt düğümleri ekle
                if (node.child) queue.push(node.child);
                if (node.sibling) queue.push(node.sibling);
            }
        }

        // Yöntem 4: Global değişkenleri tara
        for (const key of Object.keys(window)) {
            if (key.startsWith('_') || key.startsWith('webkit')) continue;
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object') {
                    if (obj.networkManager && obj.renderer && obj.inputManager) {
                        return obj;
                    }
                    if (obj.entityManager && obj.currentGameState) {
                        return obj;
                    }
                }
            } catch(e) {}
        }

        return null;
    }

    function findNetworkManager() {
        // Oyun bunu window.networkManager olarak expose ediyor!
        if (window.networkManager) return window.networkManager;
        if (window._networkManager) return window._networkManager;

        // Fallback - peer objesi ara
        for (const key of Object.keys(window)) {
            try {
                const obj = window[key];
                if (obj && obj.peer && obj.connections !== undefined) {
                    return obj;
                }
            } catch(e) {}
        }
        return null;
    }

    function findGameServer() {
        // GameServer HOST tarafında çalışır
        if (window.gameServer) return window.gameServer;
        if (window._gameServer) return window._gameServer;

        // NetworkManager üzerinden (isHost kontrolü)
        const nm = findNetworkManager();
        if (nm && nm._isHost) {
            // Host ise GameServer da aynı scope'ta olabilir
            for (const key of Object.keys(window)) {
                try {
                    const obj = window[key];
                    if (obj && obj.entityManager?.players && obj.networkManager === nm) {
                        return obj;
                    }
                } catch(e) {}
            }
        }

        const client = findGameClient();
        if (client?.gameServer) return client.gameServer;

        // React Fiber'dan ara
        const fiber = findReactFiberRoot();
        if (fiber) {
            const queue = [fiber];
            const visited = new Set();

            while (queue.length > 0) {
                const node = queue.shift();
                if (!node || visited.has(node)) continue;
                visited.add(node);

                let hookState = node.memoizedState;
                while (hookState) {
                    if (hookState.memoizedState && typeof hookState.memoizedState === 'object') {
                        const state = hookState.memoizedState;
                        if (state.entityManager?.players && state.handleSkillRequest) return state;
                        if (Array.isArray(state) && state[0]?.entityManager?.players) return state[0];
                    }
                    hookState = hookState.next;
                }

                if (node.child) queue.push(node.child);
                if (node.sibling) queue.push(node.sibling);
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
            this.networkManager = null;
            this.capturedGameState = null;  // NetworkManager'dan yakalanan state
            this.localPlayerId = null;
            this.isHost = false;
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
            this.messageHooked = false;
        }

        init() {
            log(`Hardcore Ninja Cheat v${CHEAT_VERSION} başlatılıyor...`);

            this.rescan();

            this.enabled = true;
            this.setupHotkeys();
            this.showMenu();

            // Eğer objeler bulunamadıysa 2 saniye sonra tekrar dene
            if (!this.gameClient && !this.networkManager) {
                log('Objeler bulunamadı, 2 saniye sonra tekrar taranacak...', 'warn');
                setTimeout(() => this.rescan(), 2000);
            }

            return this;
        }

        /** Oyun objelerini yeniden tara */
        rescan() {
            log('Oyun objeleri taranıyor...', 'info');

            // NetworkManager - oyun bunu window.networkManager olarak expose ediyor!
            this.networkManager = findNetworkManager();
            if (this.networkManager) {
                log('NetworkManager bulundu! (window.networkManager)', 'success');
                log(`  Peer ID: ${this.networkManager.peer?.id || 'N/A'}`, 'info');
                this.isHost = this.networkManager._isHost || false;
                this.localPlayerId = this.networkManager.peer?.id;
                log(`  isHost: ${this.isHost}`, 'info');

                // Mesaj hook'u kur
                this.hookNetworkMessages();
            }

            // GameClient
            this.gameClient = findGameClient();
            if (this.gameClient) {
                log('GameClient bulundu!', 'success');
            }

            // GameServer (sadece HOST için)
            this.gameServer = findGameServer();
            if (this.gameServer) {
                log('GameServer bulundu! (HOST modu aktif)', 'success');
            }

            // Özet
            if (!this.gameClient && !this.networkManager) {
                log('Hiçbir oyun objesi bulunamadı!', 'error');
                log('Oyunun tam yüklenmesini bekleyin ve cheat.rescan() çalıştırın', 'warn');
            }

            return {
                networkManager: !!this.networkManager,
                gameClient: !!this.gameClient,
                gameServer: !!this.gameServer,
                isHost: this.isHost
            };
        }

        /** NetworkManager mesajlarını hook'la - game state'i yakala */
        hookNetworkMessages() {
            if (this.messageHooked || !this.networkManager) return;

            const nm = this.networkManager;
            const self = this;

            // Peer bağlantılarındaki data event'lerini dinle
            if (nm.peer) {
                // Mevcut bağlantıları hook'la
                nm.connections?.forEach(conn => {
                    this.hookConnection(conn);
                });

                // Yeni bağlantıları da hook'la
                const originalOnConnection = nm.peer.on?.bind(nm.peer);
                if (originalOnConnection) {
                    nm.peer.on = function(event, callback) {
                        if (event === 'connection') {
                            const wrappedCallback = (conn) => {
                                self.hookConnection(conn);
                                callback(conn);
                            };
                            return originalOnConnection(event, wrappedCallback);
                        }
                        return originalOnConnection(event, callback);
                    };
                }
            }

            // broadcast fonksiyonunu hook'la (HOST için)
            if (nm.broadcast && !nm._originalBroadcast) {
                nm._originalBroadcast = nm.broadcast.bind(nm);
                nm.broadcast = (data) => {
                    this.onMessage(data, 'out');
                    return nm._originalBroadcast(data);
                };
            }

            // sendToHost fonksiyonunu hook'la (CLIENT için)
            if (nm.sendToHost && !nm._originalSendToHost) {
                nm._originalSendToHost = nm.sendToHost.bind(nm);
                nm.sendToHost = (data) => {
                    this.onMessage(data, 'out');
                    return nm._originalSendToHost(data);
                };
            }

            this.messageHooked = true;
            log('Network mesajları hook\'landı!', 'success');
        }

        hookConnection(conn) {
            if (!conn || conn._cheatHooked) return;

            const self = this;
            const originalOnData = conn.on?.bind(conn);

            if (originalOnData) {
                conn.on = function(event, callback) {
                    if (event === 'data') {
                        const wrappedCallback = (data) => {
                            self.onMessage(data, 'in');
                            callback(data);
                        };
                        return originalOnData(event, wrappedCallback);
                    }
                    return originalOnData(event, callback);
                };
            }

            conn._cheatHooked = true;
        }

        /** Mesaj yakalandığında */
        onMessage(data, direction) {
            if (!data || typeof data !== 'object') return;

            // GAME_STATE_UPDATE mesajını yakala
            if (data.type === 'GAME_STATE_UPDATE' && data.gameState) {
                this.capturedGameState = data.gameState;
            }

            // JOIN_RESPONSE mesajını yakala
            if (data.type === 'JOIN_RESPONSE' && data.playerId) {
                this.localPlayerId = data.playerId;
                log(`Player ID yakalandı: ${data.playerId}`, 'success');
            }
        }

        /** Aktif game state'i al */
        getGameState() {
            return this.capturedGameState ||
                   this.gameClient?.currentGameState ||
                   window._gameState;
        }

        /** Kendi player ID'mizi al */
        getLocalPlayerId() {
            return this.localPlayerId ||
                   this.gameClient?.localPlayerId ||
                   this.networkManager?.peer?.id;
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
            // Cooldown'ları sürekli sıfırla
            const intervalId = setInterval(() => {
                const gameState = this.getGameState();
                const localId = this.getLocalPlayerId();
                if (!gameState || !localId) return;

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
            const intervalId = setInterval(() => {
                const gameState = this.getGameState();
                const localId = this.getLocalPlayerId();

                if (gameState?.players?.[localId]) {
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
            const gameState = this.getGameState();
            const localId = this.getLocalPlayerId();

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
                            // THREE.Vector3 yerine basit obje döndür
                            nearest = { x: pos.x, y: pos.y || 0, z: pos.z };
                        }
                    }
                }
            });

            return nearest;
        }

        /** NetworkManager'ı al */
        getNetworkManager() {
            return this.networkManager || this.gameClient?.networkManager || window.networkManager;
        }

        /**
         * Teleport Hack - İstediğin yere ışınlan
         */
        teleportTo(x, z) {
            const networkManager = this.getNetworkManager();

            if (!networkManager) {
                log('NetworkManager bulunamadı! cheat.rescan() deneyin.', 'error');
                return;
            }

            // SKILL_REQUEST mesajı gönder (teleport)
            const message = {
                type: 'SKILL_REQUEST',
                skillType: 'TELEPORT',
                targetPosition: { x, y: 0, z },
                timestamp: Date.now()
            };

            if (networkManager._isHost || networkManager.isHost) {
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
            const networkManager = this.getNetworkManager();

            if (!networkManager) {
                log('NetworkManager bulunamadı! cheat.rescan() deneyin.', 'error');
                return;
            }

            // Her 100ms'de skill request spam'le
            const intervalId = setInterval(() => {
                const nm = this.getNetworkManager();
                if (!nm) return;

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

                if (nm._isHost || nm.isHost) {
                    nm.broadcast(message);
                } else {
                    nm.sendToHost(message);
                }
            }, 100);

            this.intervalIds.push(intervalId);
            this.features.rapidFire = true;
            log('Rapid Fire AKTİF!', 'success');
        }

        getMyPosition() {
            const gameState = this.getGameState();
            const localId = this.getLocalPlayerId();
            return gameState?.players?.[localId]?.position;
        }

        // ==================== CONTROL ====================

        setupHotkeys() {
            document.addEventListener('keydown', (e) => {
                if (!this.enabled) return;

                // Input alanlarında çalışmasın
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                // Numpad tuşları (tam klavye için)
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

                // %60 klavye için: Shift + rakam tuşları
                if (e.shiftKey) {
                    switch(e.code) {
                        case 'Digit1':
                            e.preventDefault();
                            this.toggleFeature('godMode');
                            break;
                        case 'Digit2':
                            e.preventDefault();
                            this.toggleFeature('infiniteCooldown');
                            break;
                        case 'Digit3':
                            e.preventDefault();
                            this.toggleFeature('speedHack');
                            break;
                        case 'Digit4':
                            e.preventDefault();
                            this.toggleFeature('esp');
                            break;
                        case 'Digit5':
                            e.preventDefault();
                            this.toggleFeature('autoAim');
                            break;
                        case 'Digit6':
                            e.preventDefault();
                            this.toggleFeature('rapidFire');
                            break;
                        case 'Digit7':
                            e.preventDefault();
                            this.killAllEnemies();
                            break;
                        case 'Digit0':
                            e.preventDefault();
                            this.showMenu();
                            break;
                    }
                }

                // Backtick (`) ile menü göster
                if (e.code === 'Backquote' && !e.shiftKey) {
                    e.preventDefault();
                    this.showMenu();
                }

                // Shift + Backtick ile tümünü aç/kapat
                if (e.code === 'Backquote' && e.shiftKey) {
                    e.preventDefault();
                    this.toggleAll();
                }
            });

            log('Hotkey\'ler ayarlandı!', 'info');
            log('Shift+1-7: Hileler | `: Menü | Shift+`: Toggle All', 'info');
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
%c╔════════════════════════════════════════════════════════════════════╗
║               🥷 HARDCORE NINJA CHEAT v${CHEAT_VERSION} 🥷                  ║
╠════════════════════════════════════════════════════════════════════╣
║  HOTKEYS (%60 klavye uyumlu)                                       ║
║  ─────────────────────────────────────────────────────────────     ║
║  Shift+1  God Mode         ${this.features.godMode ? '✅ ON ' : '❌ OFF'}  │  Shift+5  Auto Aim    ${this.features.autoAim ? '✅ ON ' : '❌ OFF'}  ║
║  Shift+2  Infinite CD      ${this.features.infiniteCooldown ? '✅ ON ' : '❌ OFF'}  │  Shift+6  Rapid Fire  ${this.features.rapidFire ? '✅ ON ' : '❌ OFF'}  ║
║  Shift+3  Speed Hack       ${this.features.speedHack ? '✅ ON ' : '❌ OFF'}  │  Shift+7  Kill All    ⚡     ║
║  Shift+4  ESP              ${this.features.esp ? '✅ ON ' : '❌ OFF'}  │  \`         Menü             ║
╠════════════════════════════════════════════════════════════════════╣
║  CONSOLE KOMUTLARI (cheat.X)                                       ║
║  ─────────────────────────────────────────────────────────────     ║
║  .god() .g()   → God Mode      │  .aim() .a()   → Auto Aim        ║
║  .esp() .e()   → ESP/Wallhack  │  .fire() .f()  → Rapid Fire      ║
║  .speed(N) .s()→ Hız (Nx)      │  .cd() .c()    → Infinite CD     ║
║  .ohk()        → One Hit Kill  │  .kill() .k()  → Kill All        ║
║  ─────────────────────────────────────────────────────────────     ║
║  .tp(x,z)      → Işınlan       │  .players()    → Oyuncu listesi  ║
║  .status()     → Aktif hileler │  .debug()      → Debug bilgisi   ║
║  .on() / .off()→ Tümünü aç/kapat                                   ║
║  .help() .h()  → Bu menü                                           ║
╚════════════════════════════════════════════════════════════════════╝`,
            'color: #00ff00; font-family: monospace; font-size: 11px;');
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

        // ==================== KISA KOMUTLAR ====================
        // Console'dan kolay erişim için

        /** God Mode toggle - cheat.god() veya cheat.g() */
        god() { this.toggleFeature('godMode'); return this.features.godMode ? 'ON' : 'OFF'; }
        g() { return this.god(); }

        /** ESP toggle - cheat.esp() veya cheat.e() */
        esp() { this.toggleFeature('esp'); return this.features.esp ? 'ON' : 'OFF'; }
        e() { return this.esp(); }

        /** Speed Hack toggle - cheat.speed() veya cheat.s() */
        speed(multiplier) {
            if (multiplier && !this.features.speedHack) {
                this.enableSpeedHack(multiplier);
            } else {
                this.toggleFeature('speedHack');
            }
            return this.features.speedHack ? `ON (${this.speedMultiplier}x)` : 'OFF';
        }
        s(m) { return this.speed(m); }

        /** Auto Aim toggle - cheat.aim() veya cheat.a() */
        aim() { this.toggleFeature('autoAim'); return this.features.autoAim ? 'ON' : 'OFF'; }
        a() { return this.aim(); }

        /** Infinite Cooldown toggle - cheat.cd() veya cheat.c() */
        cd() { this.toggleFeature('infiniteCooldown'); return this.features.infiniteCooldown ? 'ON' : 'OFF'; }
        c() { return this.cd(); }

        /** Rapid Fire toggle - cheat.fire() veya cheat.f() */
        fire() { this.toggleFeature('rapidFire'); return this.features.rapidFire ? 'ON' : 'OFF'; }
        f() { return this.fire(); }

        /** One Hit Kill toggle - cheat.ohk() */
        ohk() {
            if (!this.features.oneHitKill) {
                this.enableOneHitKill();
            } else {
                this.features.oneHitKill = false;
                log('One Hit Kill KAPALI', 'warn');
            }
            return this.features.oneHitKill ? 'ON' : 'OFF';
        }

        /** Kill All - cheat.kill() veya cheat.k() */
        kill() { this.killAllEnemies(); }
        k() { return this.kill(); }

        /** Teleport - cheat.tp(x, z) */
        tp(x, z) { this.teleportTo(x, z); }

        /** Tümünü aç - cheat.on() */
        on() {
            this.enabled = true;
            log('Cheat sistemi AKTİF', 'success');
            return 'Cheat ON';
        }

        /** Tümünü kapat - cheat.off() */
        off() {
            this.cleanup();
            this.enabled = false;
            log('Tüm hileler KAPALI', 'warn');
            return 'Cheat OFF';
        }

        /** Yardım - cheat.help() veya cheat.h() */
        help() { this.showMenu(); }
        h() { return this.help(); }

        /** Durum - cheat.status() */
        status() {
            const active = Object.entries(this.features)
                .filter(([k, v]) => v)
                .map(([k]) => k);
            console.log('Aktif hileler:', active.length ? active.join(', ') : 'Yok');
            return active;
        }

        /** Oyuncuları listele - cheat.players() */
        players() {
            const state = this.getGameState();
            const localId = this.getLocalPlayerId();
            if (!state?.players) {
                log('Oyuncu bulunamadı. Oyun state yakalanmadı.', 'warn');
                log('Biraz bekleyip tekrar deneyin.', 'info');
                return;
            }
            console.table(
                Object.entries(state.players).map(([id, p]) => ({
                    id: id.substring(0, 8) + '...',
                    isMe: id === localId ? '👤' : '',
                    name: p.name || 'N/A',
                    health: p.health,
                    x: p.position?.x?.toFixed(1),
                    z: p.position?.z?.toFixed(1)
                }))
            );
        }

        /** Game state'i göster */
        state() {
            const gs = this.getGameState();
            if (gs) {
                console.log('=== GAME STATE ===');
                console.log('Mode:', gs.gameMode);
                console.log('Round:', gs.currentRound);
                console.log('Players:', Object.keys(gs.players || {}).length);
                return gs;
            } else {
                log('Game state henüz yakalanmadı.', 'warn');
                return null;
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
