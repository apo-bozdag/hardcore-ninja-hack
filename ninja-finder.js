/**
 * Ninja Game Object Finder
 * =========================
 * Bu script oyun objelerini bulur ve window'a expose eder.
 * Ana cheat scriptinden ÖNCE çalıştırın!
 */

(function() {
    'use strict';

    const log = (msg, type = 'info') => {
        const colors = { info: '#00ff00', warn: '#ffff00', error: '#ff0000', success: '#00ffff' };
        console.log(`%c[Finder] ${msg}`, `color: ${colors[type]}; font-weight: bold;`);
    };

    log('Oyun objeleri aranıyor...', 'info');

    // ==================== DEEP SCANNER ====================

    const scanned = new WeakSet();
    const results = {
        peers: [],
        scenes: [],
        renderers: [],
        cameras: [],
        gameClients: [],
        gameServers: [],
        networkManagers: [],
        players: [],
        gameStates: []
    };

    function isPeerJS(obj) {
        return obj && (
            obj.constructor?.name === 'Peer' ||
            (obj.id && obj.options && obj.connections && obj._open !== undefined) ||
            (obj.socket && obj._id && obj.peer)
        );
    }

    function isThreeScene(obj) {
        return obj && (
            obj.isScene === true ||
            (obj.type === 'Scene' && obj.children && obj.background !== undefined)
        );
    }

    function isThreeRenderer(obj) {
        return obj && (
            obj.isWebGLRenderer === true ||
            (obj.domElement?.tagName === 'CANVAS' && obj.render && obj.setSize)
        );
    }

    function isThreeCamera(obj) {
        return obj && (
            obj.isCamera === true ||
            obj.isPerspectiveCamera === true ||
            (obj.fov !== undefined && obj.aspect !== undefined && obj.near !== undefined)
        );
    }

    function isGameClient(obj) {
        if (!obj || typeof obj !== 'object') return false;
        // GameClient özellikleri
        const hasRenderer = obj.renderer || obj._renderer;
        const hasNetwork = obj.networkManager || obj.network || obj.peer;
        const hasInput = obj.inputManager || obj.input;
        const hasEntity = obj.entityManager || obj.entities || obj.players;
        const hasState = obj.gameState || obj.currentGameState || obj.state;

        return (hasRenderer && hasNetwork) || (hasNetwork && hasEntity) || (hasState && hasNetwork);
    }

    function isGameServer(obj) {
        if (!obj || typeof obj !== 'object') return false;
        const hasPlayers = obj.players || obj.entityManager?.players;
        const hasHandlers = obj.handlePlayerInput || obj.handleSkillRequest || obj.processMessage;
        return hasPlayers && hasHandlers;
    }

    function isNetworkManager(obj) {
        if (!obj || typeof obj !== 'object') return false;
        return (obj.peer || obj.connections) && (obj.broadcast || obj.send || obj.sendToHost);
    }

    function isGameState(obj) {
        if (!obj || typeof obj !== 'object') return false;
        return obj.players && (obj.gameMode !== undefined || obj.currentRound !== undefined);
    }

    function deepScan(obj, path = 'window', depth = 0) {
        if (depth > 8) return; // Max derinlik
        if (!obj || typeof obj !== 'object') return;
        if (scanned.has(obj)) return;

        try {
            scanned.add(obj);
        } catch (e) {
            return;
        }

        // Kontroller
        if (isPeerJS(obj)) {
            results.peers.push({ path, obj });
            log(`PeerJS bulundu: ${path}`, 'success');
        }
        if (isThreeScene(obj)) {
            results.scenes.push({ path, obj });
            log(`Three.js Scene bulundu: ${path}`, 'success');
        }
        if (isThreeRenderer(obj)) {
            results.renderers.push({ path, obj });
            log(`Three.js Renderer bulundu: ${path}`, 'success');
        }
        if (isThreeCamera(obj)) {
            results.cameras.push({ path, obj });
            log(`Three.js Camera bulundu: ${path}`, 'success');
        }
        if (isGameClient(obj)) {
            results.gameClients.push({ path, obj });
            log(`GameClient bulundu: ${path}`, 'success');
        }
        if (isGameServer(obj)) {
            results.gameServers.push({ path, obj });
            log(`GameServer bulundu: ${path}`, 'success');
        }
        if (isNetworkManager(obj)) {
            results.networkManagers.push({ path, obj });
            log(`NetworkManager bulundu: ${path}`, 'success');
        }
        if (isGameState(obj)) {
            results.gameStates.push({ path, obj });
            log(`GameState bulundu: ${path}`, 'success');
        }

        // Alt objeleri tara
        const keys = Object.keys(obj);
        for (const key of keys) {
            if (key.startsWith('_') && depth > 2) continue; // Private alanları atla (derin taramada)
            try {
                const val = obj[key];
                if (val && typeof val === 'object') {
                    deepScan(val, `${path}.${key}`, depth + 1);
                }
            } catch (e) {
                // Erişilemeyen property
            }
        }
    }

    // ==================== REACT FIBER SCANNER ====================

    function scanReactFiber() {
        const root = document.getElementById('root');
        if (!root) return;

        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber'));
        if (!fiberKey) return;

        const fiber = root[fiberKey];
        log('React Fiber bulundu, taranıyor...', 'info');

        function walkFiber(node, depth = 0) {
            if (!node || depth > 50) return;

            // State ve memoizedState kontrol et
            if (node.memoizedState) {
                deepScan(node.memoizedState, `fiber.memoizedState`, 3);
            }
            if (node.stateNode && typeof node.stateNode === 'object') {
                deepScan(node.stateNode, `fiber.stateNode`, 3);
            }

            // Alt düğümleri tara
            if (node.child) walkFiber(node.child, depth + 1);
            if (node.sibling) walkFiber(node.sibling, depth + 1);
        }

        walkFiber(fiber);
    }

    // ==================== HOOK INTO PEERJS ====================

    function hookPeerJS() {
        // Mevcut Peer instance'larını bul
        if (window.Peer) {
            const originalPeer = window.Peer;
            window.Peer = function(...args) {
                const instance = new originalPeer(...args);
                log('Yeni Peer yakalandı!', 'success');
                window._capturedPeer = instance;
                results.peers.push({ path: 'window._capturedPeer', obj: instance });
                return instance;
            };
            window.Peer.prototype = originalPeer.prototype;
        }
    }

    // ==================== HOOK INTO THREE.JS ====================

    function hookThreeJS() {
        if (window.THREE) {
            const originalScene = window.THREE.Scene;
            window.THREE.Scene = function(...args) {
                const instance = new originalScene(...args);
                log('Yeni Scene yakalandı!', 'success');
                window._capturedScene = instance;
                results.scenes.push({ path: 'window._capturedScene', obj: instance });
                return instance;
            };

            const originalRenderer = window.THREE.WebGLRenderer;
            window.THREE.WebGLRenderer = function(...args) {
                const instance = new originalRenderer(...args);
                log('Yeni Renderer yakalandı!', 'success');
                window._capturedRenderer = instance;
                results.renderers.push({ path: 'window._capturedRenderer', obj: instance });
                return instance;
            };
        }
    }

    // ==================== CANVAS SCANNER ====================

    function scanCanvas() {
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas, i) => {
            // WebGL context'ten renderer bulmaya çalış
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (gl) {
                log(`WebGL Canvas bulundu: canvas[${i}]`, 'info');

                // Canvas'ın parent'larını tara
                let parent = canvas.parentElement;
                let depth = 0;
                while (parent && depth < 10) {
                    const keys = Object.keys(parent);
                    for (const key of keys) {
                        if (key.startsWith('__react')) {
                            deepScan(parent[key], `canvas.parent.${key}`, 3);
                        }
                    }
                    parent = parent.parentElement;
                    depth++;
                }
            }
        });
    }

    // ==================== MAIN ====================

    // Hook'ları kur
    hookPeerJS();
    hookThreeJS();

    // Window'u tara
    log('Window taranıyor...', 'info');
    for (const key of Object.keys(window)) {
        if (key.startsWith('_') || key.startsWith('webkit')) continue;
        try {
            const obj = window[key];
            if (obj && typeof obj === 'object') {
                deepScan(obj, `window.${key}`, 0);
            }
        } catch (e) {}
    }

    // React Fiber'ı tara
    scanReactFiber();

    // Canvas'ları tara
    scanCanvas();

    // Sonuçları window'a expose et
    window._gameObjects = results;

    // En iyi eşleşmeleri seç ve expose et
    if (results.peers.length > 0) {
        window._peer = results.peers[0].obj;
        log(`window._peer ayarlandı`, 'success');
    }
    if (results.scenes.length > 0) {
        window._scene = results.scenes[0].obj;
        log(`window._scene ayarlandı`, 'success');
    }
    if (results.renderers.length > 0) {
        window._renderer = results.renderers[0].obj;
        log(`window._renderer ayarlandı`, 'success');
    }
    if (results.gameClients.length > 0) {
        window._gameClient = results.gameClients[0].obj;
        log(`window._gameClient ayarlandı`, 'success');
    }
    if (results.gameServers.length > 0) {
        window._gameServer = results.gameServers[0].obj;
        log(`window._gameServer ayarlandı`, 'success');
    }
    if (results.networkManagers.length > 0) {
        window._networkManager = results.networkManagers[0].obj;
        log(`window._networkManager ayarlandı`, 'success');
    }
    if (results.gameStates.length > 0) {
        window._gameState = results.gameStates[0].obj;
        log(`window._gameState ayarlandı`, 'success');
    }

    // Özet
    console.log('\n%c=== BULUNAN OBJELER ===', 'color: #ff00ff; font-weight: bold; font-size: 14px;');
    console.log(`Peers: ${results.peers.length}`);
    console.log(`Scenes: ${results.scenes.length}`);
    console.log(`Renderers: ${results.renderers.length}`);
    console.log(`Cameras: ${results.cameras.length}`);
    console.log(`GameClients: ${results.gameClients.length}`);
    console.log(`GameServers: ${results.gameServers.length}`);
    console.log(`NetworkManagers: ${results.networkManagers.length}`);
    console.log(`GameStates: ${results.gameStates.length}`);

    console.log('\n%cErişim:', 'color: #00ffff; font-weight: bold;');
    console.log('window._gameObjects  - Tüm bulunan objeler');
    console.log('window._peer         - PeerJS instance');
    console.log('window._scene        - Three.js Scene');
    console.log('window._gameClient   - GameClient');
    console.log('window._gameState    - Game State');

    // Bulunamadıysa alternatif tarama
    if (results.peers.length === 0 && results.scenes.length === 0) {
        log('Objeler bulunamadı. 2 saniye sonra tekrar taranacak...', 'warn');
        setTimeout(() => {
            scanReactFiber();
            scanCanvas();
            for (const key of Object.keys(window)) {
                try {
                    deepScan(window[key], `window.${key}`, 0);
                } catch (e) {}
            }
            console.log('Tekrar tarama tamamlandı. window._gameObjects kontrol edin.');
        }, 2000);
    }

    // Helper fonksiyonlar
    window.rescan = function() {
        log('Yeniden taranıyor...', 'info');
        scanReactFiber();
        scanCanvas();
        for (const key of Object.keys(window)) {
            try {
                if (window[key] && typeof window[key] === 'object') {
                    deepScan(window[key], `window.${key}`, 0);
                }
            } catch (e) {}
        }
        return results;
    };

    window.findByProperty = function(propName) {
        const found = [];
        for (const key of Object.keys(window)) {
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object' && propName in obj) {
                    found.push({ path: `window.${key}`, obj, value: obj[propName] });
                }
            } catch (e) {}
        }
        return found;
    };

    log('Finder tamamlandı! "window._gameObjects" kontrol edin.', 'success');

})();
