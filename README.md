# 🥷 Hardcore Ninja Browser Cheat

Hardcore Ninja oyunu için tarayıcı hilesi. Sadece **eğitim ve CTF amaçlı** kullanılmalıdır.

## 🎮 Hedef Oyun

- **Repo:** https://github.com/Orkuncakilkaya/hardcore-ninja
- **Teknoloji:** React, Three.js, PeerJS (WebRTC)
- **Mimari:** P2P - HOST tam kontrole sahip

## 📦 Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `ninja-cheat.js` | Ana hile scripti - temel özellikler |
| `ninja-cheat-advanced.js` | Gelişmiş modül - bot, radar, network manipulation |

## 🚀 Kullanım

### 1. Ana Script

Tarayıcı konsolunu açın (F12) ve `ninja-cheat.js` içeriğini yapıştırın:

```javascript
// ninja-cheat.js içeriğini buraya yapıştırın
```

### 2. Gelişmiş Modül (Opsiyonel)

Ana script yüklendikten sonra `ninja-cheat-advanced.js` içeriğini yapıştırın.

## ⌨️ Kısayol Tuşları

| Tuş | Özellik | Not |
|-----|---------|-----|
| `Numpad 1` | God Mode | HOST only |
| `Numpad 2` | Infinite Cooldown | Görsel |
| `Numpad 3` | Speed Hack | 2x hız |
| `Numpad 4` | ESP | Duvar arkası görüş |
| `Numpad 5` | Auto Aim | Otomatik nişan |
| `Numpad 6` | Rapid Fire | Hızlı ateş |
| `Numpad 7` | Kill All | HOST only |
| `Numpad 0` | Menü Göster | - |
| `Insert` | Tümünü Aç/Kapat | - |

## 💻 Konsol Komutları

### Temel

```javascript
// Menüyü göster
cheat.showMenu()

// Debug bilgisi
cheat.debug()

// Oyun durumunu göster
cheat.printGameState()

// Koordinata ışınlan
cheat.teleportTo(10, 20)

// Tüm düşmanları öldür (HOST only)
cheat.killAllEnemies()

// Hız çarpanını ayarla
cheat.enableSpeedHack(3) // 3x hız
```

### Gelişmiş (Advanced modül gerekli)

```javascript
// Görsel özellikler
cheat.showOverlay()    // Bilgi paneli
cheat.showRadar()      // Mini harita
cheat.hideVisuals()    // Görselleri kapat

// Bot modu
cheat.startBot()       // Otomatik oyna
cheat.stopBot()        // Botu durdur

// Network
cheat.intercept()      // Mesajları izle
cheat.network.showLog() // Log göster

// Memory
cheat.scan()           // Objeleri tara
cheat.memory.listSceneMeshes()
```

## 🎯 Özellikler

### HOST Hileleri (Tam Kontrol)
- ✅ **God Mode** - Hasar almayı tamamen engeller
- ✅ **One Hit Kill** - Tek vuruşta öldür
- ✅ **Kill All** - Tüm düşmanları anında öldür

### Client Hileleri
- ⚡ **Infinite Cooldown** - Yetenek bekleme süresini görsel olarak sıfırla
- 🏃 **Speed Hack** - Hareket hızını artır
- 👁️ **ESP** - Duvarların arkasını gör, düşmanları vurgula
- 🎯 **Auto Aim** - Otomatik hedefleme
- 🔫 **Rapid Fire** - Hızlı yetenek kullanımı

### Gelişmiş
- 📡 **Network Intercept** - Mesajları izle ve manipüle et
- 🗺️ **Radar** - Mini harita
- 📊 **Overlay** - Oyuncu bilgileri
- 🤖 **Bot Mode** - Otomatik oyun

## ⚠️ Önemli Notlar

1. **HOST vs CLIENT**: Bazı hileler sadece HOST olduğunuzda çalışır (oyunu siz oluşturduysanız)

2. **Sunucu Doğrulaması**: Oyun P2P olduğu için HOST tarafı sunucu görevini üstlenir. Client hileleri sunucu tarafından reddedilebilir.

3. **Tespit**: Bu hileler kolayca tespit edilebilir. Gerçek oyunlarda kullanmayın.

## 🔧 Teknik Detaylar

### Oyun Mimarisi
```
┌─────────────────┐         ┌─────────────────┐
│   HOST (P1)     │◄───────►│  CLIENT (P2)    │
│  ┌───────────┐  │  PeerJS │  ┌───────────┐  │
│  │GameServer │  │◄───────►│  │GameClient │  │
│  │GameClient │  │ WebRTC  │  └───────────┘  │
│  └───────────┘  │         │                 │
└─────────────────┘         └─────────────────┘
```

### Yetenekler
| Yetenek | Cooldown | Hasar | Menzil |
|---------|----------|-------|--------|
| Teleport (Q) | 5s | - | 22 birim |
| Homing Missile (W) | 5s | 100 | ∞ (takip) |
| Laser Beam (E) | 8s | - | 15 birim |
| Invincibility (R) | 10s | - | 3s süre |

### Mesaj Tipleri
- `PLAYER_INPUT` - Hareket
- `SKILL_REQUEST` - Yetenek kullanımı
- `GAME_STATE_UPDATE` - State senkronizasyonu
- `JOIN_REQUEST/RESPONSE` - Oyuna katılma

## 📜 Lisans

Bu proje yalnızca eğitim amaçlıdır. Kötüye kullanımdan kullanıcı sorumludur.

---

*Made for educational purposes only* 🎓
