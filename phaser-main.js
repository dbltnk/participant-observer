console.log('Phaser main loaded');
// Alpine Sustainability - Phaser Migration Entry Point
// Phaser best practices: MainScene class, all state/UI on this, config from GameConfig, no DOM overlays

(function () {
    if (typeof Phaser === 'undefined') {
        throw new Error('Phaser 3 is not loaded. Please check the CDN link in index.html.');
    }
    if (!window.GameConfig || !window.GameConfig.world) {
        throw new Error('GameConfig or GameConfig.world is not defined! Make sure config/GameConfig.js is loaded before phaser-main.js.');
    }
    const GameConfig = window.GameConfig;
    function assert(condition, message) {
        if (!condition) throw new Error('ASSERTION FAILED: ' + message);
    }
    function distance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // === BEGIN: Logging System ===
    let logTransmissionInterval;
    let domSnapshotInterval;
    let lastDomSnapshot = '';

    // Initialize logging system
    function initLogging() {
        console.log('[Logging] Initializing browser logging system...');

        // Start log transmission (every 2 seconds)
        logTransmissionInterval = setInterval(sendLogsToServer, 2000);

        // Start DOM snapshots (every 5 seconds)
        domSnapshotInterval = setInterval(sendDomSnapshot, 5000);

        console.log('[Logging] Logging system initialized');
    }

    // Send captured logs to server
    function sendLogsToServer() {
        if (!window.earlyLogs || window.earlyLogs.length === 0) return;

        const logsToSend = window.earlyLogs.splice(0); // Take all logs and clear array

        // Format logs for server
        const formattedLogs = logsToSend.map(log => ({
            type: log.type,
            message: log.args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '),
            timestamp: log.timestamp,
            callStack: log.callStack
        }));

        // Send to server
        fetch('http://localhost:3000/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: formattedLogs })
        }).catch(err => {
            console.warn('[Logging] Failed to send logs to server:', err.message);
        });
    }

    // Send DOM snapshot to server
    function sendDomSnapshot() {
        try {
            const snapshot = captureDomSnapshot();
            const snapshotString = JSON.stringify(snapshot);

            // Only send if DOM has changed
            if (snapshotString !== lastDomSnapshot) {
                lastDomSnapshot = snapshotString;

                fetch('http://localhost:3000/dom-snapshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: snapshotString
                }).catch(err => {
                    console.warn('[Logging] Failed to send DOM snapshot:', err.message);
                });
            }
        } catch (err) {
            console.warn('[Logging] Failed to capture DOM snapshot:', err.message);
        }
    }

    // Capture DOM snapshot
    function captureDomSnapshot() {
        const elements = [];
        const allElements = document.querySelectorAll('*');

        allElements.forEach((el, index) => {
            if (index > 1000) return; // Limit to prevent memory issues

            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);

            const elementData = {
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                classes: Array.from(el.classList),
                computedStyles: {
                    'background-color': styles.backgroundColor,
                    'color': styles.color,
                    'display': styles.display,
                    'visibility': styles.visibility,
                    'position': styles.position,
                    'width': styles.width,
                    'height': styles.height
                },
                position: { x: rect.x, y: rect.y },
                dimensions: { width: rect.width, height: rect.height },
                cssConflicts: []
            };

            // Detect CSS conflicts
            if (styles.display === 'none' && styles.visibility === 'visible') {
                elementData.cssConflicts.push('Element hidden by display:none but visibility:visible');
            }

            elements.push(elementData);
        });

        return {
            timestamp: new Date().toTimeString().split(' ')[0],
            url: window.location.href,
            elements: elements
        };
    }

    // Cleanup logging on page unload
    window.addEventListener('beforeunload', () => {
        if (logTransmissionInterval) clearInterval(logTransmissionInterval);
        if (domSnapshotInterval) clearInterval(domSnapshotInterval);
    });
    // === END: Logging System ===

    // === BEGIN: PerlinNoise and utility functions (copied from game/Utils.js) ===
    class PerlinNoise {
        constructor(seed) {
            this.seed = seed;
            this.permutation = this.generatePermutation();
        }
        generatePermutation() {
            const p = new Array(256);
            for (let i = 0; i < 256; i++) p[i] = i;
            for (let i = 255; i > 0; i--) {
                const j = this.hash(this.seed + i) % (i + 1);
                [p[i], p[j]] = [p[j], p[i]];
            }
            return [...p, ...p];
        }
        hash(x) {
            x = ((x >> 16) ^ x) * 0x45d9f3b;
            x = ((x >> 16) ^ x) * 0x45d9f3b;
            x = (x >> 16) ^ x;
            return x;
        }
        fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
        lerp(t, a, b) { return a + t * (b - a); }
        grad(hash, x, y) {
            const h = hash & 15;
            const grad1 = 1 + (h & 7);
            return ((h & 8) === 0 ? grad1 : -grad1) * x + ((h & 4) === 0 ? grad1 : -grad1) * y;
        }
        noise2D(x, y) {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            x -= Math.floor(x);
            y -= Math.floor(y);
            const u = this.fade(x);
            const v = this.fade(y);
            const A = this.permutation[X] + Y;
            const AA = this.permutation[A];
            const AB = this.permutation[A + 1];
            const B = this.permutation[X + 1] + Y;
            const BA = this.permutation[B];
            const BB = this.permutation[B + 1];
            return this.lerp(v, this.lerp(u, this.grad(AA, x, y), this.grad(BA, x - 1, y)),
                this.lerp(u, this.grad(AB, x, y - 1), this.grad(BB, x - 1, y - 1)));
        }
    }
    // === END: PerlinNoise and utility functions ===
    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
        }
        preload() { }
        create() {
            // Set world and game size to fill the browser window
            GameConfig.world.width = window.innerWidth;
            GameConfig.world.height = window.innerHeight;

            // --- World/entities ---
            this.entities = [];
            const currentSeed = getCurrentSeed();
            console.log(`[World Generation] Using seed: ${currentSeed}`);
            this.noise = new PerlinNoise(currentSeed);
            this.seededRandom = new SeededRandom(currentSeed);
            const cfg = GameConfig.world;
            const centerX = cfg.width / 2;
            const centerY = cfg.height / 2;
            // --- Village ---
            const village = { position: { x: centerX, y: centerY }, type: 'village', emoji: '🏘️' };
            this.entities.push(village);
            // --- Village well ---
            const villageWell = {
                position: { x: centerX + cfg.villageCenterOffset.x, y: centerY + cfg.villageCenterOffset.y },
                type: 'well', emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel
            };
            this.entities.push(villageWell);
            // --- Communal storage ---
            const communalStorage = {
                position: { x: centerX - cfg.villageCenterOffset.x, y: centerY + cfg.villageCenterOffset.y },
                type: 'storage_box', emoji: '📦', capacity: GameConfig.storage.communalCapacity, items: []
            };
            this.entities.push(communalStorage);
            // --- Camps and facilities ---
            this.camps = [];
            for (let i = 0; i < cfg.villagerCount; i++) {
                const angle = (i / cfg.villagerCount) * 2 * Math.PI;
                const x = centerX + Math.cos(angle) * cfg.campRadius;
                const y = centerY + Math.sin(angle) * cfg.campRadius;
                const camp = { position: { x, y }, type: 'camp', emoji: '🏕️', villagerId: i };
                this.camps.push(camp);
                this.entities.push(camp);
                // Fireplace
                this.entities.push({ position: { x: x + cfg.campSpacing.x, y: y }, type: 'fireplace', emoji: '🔥', isBurning: false, wood: 0, maxWood: GameConfig.fires.maxWood });
                // Sleeping bag
                this.entities.push({ position: { x: x - cfg.campSpacing.x, y: y }, type: 'sleeping_bag', emoji: '🛏️', isOccupied: false });
                // Personal storage
                this.entities.push({ position: { x: x, y: y + cfg.campSpacing.y }, type: 'storage_box', emoji: '📦', capacity: GameConfig.storage.personalCapacity, items: [], isPersonal: true, villagerId: i });
            }
            // --- Player start position (near camp 0) ---
            const playerCamp = this.camps[0];
            this.playerStartPosition = {
                x: playerCamp.position.x + cfg.playerStartOffset.x,
                y: playerCamp.position.y + cfg.playerStartOffset.y
            };
            // --- Additional wells ---
            this.wells = [villageWell];
            for (let i = 0; i < cfg.wellCount; i++) {
                let attempts = 0, pos;
                do {
                    pos = { x: this.seededRandom.randomRange(0, cfg.width), y: this.seededRandom.randomRange(0, cfg.height) };
                    attempts++;
                } while (this.isTooCloseToExistingWell(pos) && attempts < cfg.wellMaxAttempts);
                if (attempts < cfg.wellMaxAttempts) {
                    const well = { position: pos, type: 'well', emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel };
                    this.entities.push(well);
                    this.wells.push(well);
                }
            }
            // --- Resources (Perlin noise placement) ---
            const resourceTypes = ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'];
            const totalResources = (cfg.villagerCount + 1) * cfg.resourcesPerVillager;
            for (let i = 0; i < totalResources; i++) {
                let attempts = 0, pos;
                do {
                    const noiseX = this.seededRandom.randomRange(0, cfg.noiseScale);
                    const noiseY = this.seededRandom.randomRange(0, cfg.noiseScale);
                    const noiseValue = this.noise.noise2D(noiseX, noiseY);
                    const biasX = (noiseValue + 1) * cfg.noiseBias;
                    const biasY = (this.noise.noise2D(noiseX + cfg.noiseScale / 2, noiseY + cfg.noiseScale / 2) + 1) * cfg.noiseBias;
                    pos = { x: biasX * cfg.width, y: biasY * cfg.height };
                    attempts++;
                } while (this.isTooCloseToVillage(pos) && attempts < cfg.wellMaxAttempts);
                const resourceType = resourceTypes[i % resourceTypes.length];
                const emoji = this.getResourceEmoji(resourceType);
                this.entities.push({ position: pos, type: resourceType, emoji, collected: false, propagationChance: GameConfig.resources.propagationChance });
            }
            // --- Render all entities as Phaser text objects ---
            this.worldEntities = [];
            for (const entity of this.entities) {
                const fontSize = entity.type === 'village' ? 32 : entity.type === 'camp' ? 28 : entity.type === 'fireplace' || entity.type === 'sleeping_bag' ? 24 : entity.type === 'storage_box' ? 24 : ['well', 'blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'].includes(entity.type) ? 22 : 22;
                const textObj = this.add.text(entity.position.x, entity.position.y, entity.emoji, { fontSize: fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
                entity._phaserText = textObj;
                this.worldEntities.push(textObj);
                // --- Resource collection: make resources interactive ---
                if (["blackberry", "mushroom", "herb", "rabbit", "deer", "tree"].includes(entity.type)) {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        if (entity.collected) return;
                        // Check player is near
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to collect resource out of range');
                        // Find first empty inventory slot
                        const slot = this.playerState.inventory.findIndex(i => i === null);
                        if (slot === -1) {
                            // Show message (future: use UI)
                            this.showTempMessage('Inventory full!', 1500);
                            return;
                        }
                        // Mark as collected, hide emoji, add to inventory
                        entity.collected = true;
                        textObj.setVisible(false);
                        this.playerState.inventory[slot] = { type: entity.type, emoji: entity.emoji };
                        this.updatePhaserUI();
                        this.showTempMessage(`Collected ${entity.type}!`, 1200);
                    });
                }
                // --- Well interaction: click to drink if near ---
                if (entity.type === 'well') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to drink from well out of range');
                        if (this.playerState.needs.water >= GameConfig.needs.fullValue) {
                            this.showTempMessage('Already fully hydrated!', 1200);
                            return;
                        }
                        this.playerState.needs.water = GameConfig.needs.fullValue;
                        this.updatePhaserUI();
                        this.showTempMessage('Drank from well!', 1200);
                    });
                }
                // --- Fire interaction: click to interact if near (stub) ---
                if (entity.type === 'fireplace') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with fire out of range');
                        this.showTempMessage('TODO: Fire interaction (cook, warm up)', 1200);
                    });
                }
                // --- Sleeping bag interaction: click to interact if near (stub) ---
                if (entity.type === 'sleeping_bag') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with sleeping bag out of range');
                        this.showTempMessage('TODO: Sleeping (skip night)', 1200);
                    });
                }
                // --- Storage box interaction: click to interact if near (stub) ---
                if (entity.type === 'storage_box') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with storage box out of range');
                        this.showTempMessage('TODO: Storage interaction', 1200);
                    });
                }
            }
            // --- Player ---
            this.playerState = {
                position: { ...this.playerStartPosition },
                needs: {
                    temperature: GameConfig.needs.fullValue,
                    water: GameConfig.needs.fullValue,
                    calories: GameConfig.needs.fullValue,
                    vitamins: new Array(GameConfig.needs.vitaminCount).fill(GameConfig.needs.fullValue)
                },
                inventory: new Array(GameConfig.player.inventorySize).fill(null),
                selectedSlot: 0,
                currentTime: GameConfig.time.gameStartTime
            };
            this.player = this.add.text(this.playerState.position.x, this.playerState.position.y, '👤', { fontSize: GameConfig.player.fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
            assert(this.player, 'Failed to create player emoji.');
            // Camera
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            this.cameras.main.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
            // Input
            this.cursors = this.input.keyboard.addKeys({
                up: Phaser.Input.Keyboard.KeyCodes.W,
                down: Phaser.Input.Keyboard.KeyCodes.S,
                left: Phaser.Input.Keyboard.KeyCodes.A,
                right: Phaser.Input.Keyboard.KeyCodes.D
            });
            // --- UI ---
            this.ui = {};
            this.uiContainer = this.add.container(0, 0).setScrollFactor(0);
            // Use margin for all UI elements
            const margin = GameConfig.ui.uiMargin;
            // Needs bars (top left)
            this.ui.needsBars = [];
            const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
            const needLabels = ['🌡️', '💧', '🍽️', 'A', 'B', 'C', 'D', 'E'];
            const iconWidth = 25; // Width reserved for icons
            const barStartX = margin + iconWidth + 5; // Start bars after icons with 5px spacing

            for (let i = 0; i < needLabels.length; i++) {
                const barBg = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, 0x333333).setOrigin(0.5, 0);
                const barFill = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, getPhaserBarColor(needTypes[i])).setOrigin(0.5, 0);
                const label = this.add.text(margin, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, needLabels[i], { fontSize: '16px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0, 0.5);
                const value = this.add.text(barStartX + GameConfig.ui.barWidth + 10, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, '100', { fontSize: '12px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0, 0.5);
                this.uiContainer.add([barBg, barFill, label, value]);
                this.ui.needsBars.push({ barBg, barFill, label, value });
            }
            // Inventory (bottom center)
            const inventoryWidth = GameConfig.player.inventorySize * 56;
            const inventoryStartX = (GameConfig.world.width - inventoryWidth) / 2;
            const inventoryY = GameConfig.world.height - margin - 30; // Add 30px more space from bottom
            this.ui.inventorySlots = [];
            for (let i = 0; i < GameConfig.player.inventorySize; i++) {
                const slot = this.add.rectangle(inventoryStartX + i * 56, inventoryY, 50, 50, 0x222222).setOrigin(0.5).setStrokeStyle(2, 0x666666);
                const emoji = this.add.text(inventoryStartX + i * 56, inventoryY, '', { fontSize: '24px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
                this.uiContainer.add([slot, emoji]);
                this.ui.inventorySlots.push({ slot, emoji });
                // --- Inventory slot selection: click to select ---
                slot.setInteractive({ useHandCursor: true });
                slot.on('pointerdown', () => {
                    this.playerState.selectedSlot = i;
                    this.updatePhaserUI();
                });
                // --- Inventory slot right-click: remove item ---
                slot.on('pointerup', (pointer) => {
                    if (pointer.rightButtonDown()) {
                        if (this.playerState.inventory[i]) {
                            const removed = this.playerState.inventory[i];
                            this.playerState.inventory[i] = null;
                            this.updatePhaserUI();
                            this.showTempMessage(`Removed ${removed.type}`, 1200);
                        }
                    }
                });
            }
            // --- Inventory slot selection: 1-6 keys ---
            this.input.keyboard.on('keydown', (event) => {
                const idx = parseInt(event.key, 10) - 1;
                if (idx >= 0 && idx < GameConfig.player.inventorySize) {
                    this.playerState.selectedSlot = idx;
                    this.updatePhaserUI();
                }
            });
            // Time display (top right)
            this.ui.timeText = this.add.text(GameConfig.world.width - margin, margin, '', { fontSize: '18px', fontFamily: 'monospace', color: '#fff' }).setOrigin(1, 0);
            this.uiContainer.add(this.ui.timeText);
            // Info box (bottom left)
            this.ui.infoBox = this.add.text(margin, GameConfig.world.height - margin, 'Alpine Sustainability v1.0\nControls: WASD to move\nClick inventory slots to select', { fontSize: '13px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#222', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1);
            this.uiContainer.add(this.ui.infoBox);
            // Log spam toggle (bottom left, above info box)
            this.ui.logSpamBtn = this.add.text(margin, GameConfig.world.height - margin - 90, '⚪ Log Spam: OFF', { fontSize: '13px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#444', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1).setInteractive();
            this.ui.logSpamBtn.on('pointerdown', () => {
                window.summaryLoggingEnabled = !window.summaryLoggingEnabled;
                updateLogSpamBtn.call(this);
            });
            function updateLogSpamBtn() {
                if (window.summaryLoggingEnabled) {
                    this.ui.logSpamBtn.setText('🟢 Log Spam: ON').setColor('#fff').setBackgroundColor('#228B22');
                } else {
                    this.ui.logSpamBtn.setText('⚪ Log Spam: OFF').setColor('#ccc').setBackgroundColor('#444');
                }
            }
            updateLogSpamBtn.call(this);
            this.uiContainer.add(this.ui.logSpamBtn);

            // Seed control box (bottom right)
            const seedBoxY = GameConfig.world.height - margin;
            const seedBoxWidth = 200;
            const seedBoxX = GameConfig.world.width - margin - seedBoxWidth;

            // Seed label
            this.ui.seedLabel = this.add.text(seedBoxX, seedBoxY - 25, '🌱 Seed:', { fontSize: '13px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0, 1);
            this.uiContainer.add(this.ui.seedLabel);

            // Seed input background
            this.ui.seedInputBg = this.add.rectangle(seedBoxX + 30, seedBoxY - 15, 60, 20, 0x333333).setOrigin(0, 1).setStrokeStyle(1, 0x666666);
            this.uiContainer.add(this.ui.seedInputBg);

            // Seed input text
            this.ui.seedInputText = this.add.text(seedBoxX + 56, seedBoxY - 17, getCurrentSeed().toString(), { fontSize: '12px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5, 1);
            this.uiContainer.add(this.ui.seedInputText);

            // Decrement button (-)
            this.ui.seedDecrementBtn = this.add.text(seedBoxX + 25, seedBoxY - 15, '-', { fontSize: '14px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 6, right: 6, top: 2, bottom: 2 } }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
            this.ui.seedDecrementBtn.on('pointerdown', () => {
                console.log('[Seed] Decrement button clicked');
                this.decrementSeed();
            });
            this.uiContainer.add(this.ui.seedDecrementBtn);

            // Increment button (+)
            this.ui.seedIncrementBtn = this.add.text(seedBoxX + 85, seedBoxY - 15, '+', { fontSize: '14px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 6, right: 6, top: 2, bottom: 2 } }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
            this.ui.seedIncrementBtn.on('pointerdown', () => {
                console.log('[Seed] Increment button clicked');
                this.incrementSeed();
            });
            this.uiContainer.add(this.ui.seedIncrementBtn);

            // New Game button
            this.ui.newGameBtn = this.add.text(seedBoxX + 100, seedBoxY - 15, '🔄 New Game', { fontSize: '12px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#228B22', padding: { left: 8, right: 8, top: 4, bottom: 4 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
            this.ui.newGameBtn.on('pointerdown', () => this.showNewGameConfirmation());
            this.uiContainer.add(this.ui.newGameBtn);

            // Initialize current seed value
            this.currentSeedValue = getCurrentSeed();
        }
        update(time, delta) {
            // Advance game time
            const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
            const gameTimeDelta = (delta / 1000) * timeAcceleration;
            this.playerState.currentTime += gameTimeDelta;
            // Needs
            updateNeeds(this.playerState, delta);
            // UI update
            this.updatePhaserUI();
            // Game over
            const reason = checkGameOver(this.playerState);
            if (reason) {
                this.showGameOverOverlay(reason);
                this.scene.pause();
                return;
            }
            // Player movement
            let vx = 0, vy = 0;
            if (this.cursors.left.isDown) vx -= 1;
            if (this.cursors.right.isDown) vx += 1;
            if (this.cursors.up.isDown) vy -= 1;
            if (this.cursors.down.isDown) vy += 1;
            if (vx !== 0 && vy !== 0) {
                vx *= GameConfig.player.diagonalMovementFactor;
                vy *= GameConfig.player.diagonalMovementFactor;
            }
            const moveSpeed = GameConfig.player.moveSpeed;
            this.playerState.position.x += vx * moveSpeed * (delta / 1000);
            this.playerState.position.y += vy * moveSpeed * (delta / 1000);
            this.playerState.position.x = Math.max(0, Math.min(GameConfig.world.width, this.playerState.position.x));
            this.playerState.position.y = Math.max(0, Math.min(GameConfig.world.height, this.playerState.position.y));
            this.player.setPosition(this.playerState.position.x, this.playerState.position.y);
        }
        updatePhaserUI() {
            // Needs bars
            const needs = this.playerState.needs;
            const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
            for (let i = 0; i < needTypes.length; i++) {
                let v = 0;
                if (needTypes[i] === 'vitaminA') v = needs.vitamins[0];
                else if (needTypes[i] === 'vitaminB') v = needs.vitamins[1];
                else if (needTypes[i] === 'vitaminC') v = needs.vitamins[2];
                else if (needTypes[i] === 'vitaminD') v = needs.vitamins[3];
                else if (needTypes[i] === 'vitaminE') v = needs.vitamins[4];
                else v = needs[needTypes[i]];
                const pct = Math.max(0, Math.min(1, v / GameConfig.needs.fullValue));
                this.ui.needsBars[i].barFill.width = GameConfig.ui.barWidth * pct;
                this.ui.needsBars[i].value.setText(Math.round(v));
            }
            // Inventory
            for (let i = 0; i < GameConfig.player.inventorySize; i++) {
                const item = this.playerState.inventory[i];
                this.ui.inventorySlots[i].emoji.setText(item && item.emoji ? item.emoji : '');
                this.ui.inventorySlots[i].slot.setStrokeStyle(this.playerState.selectedSlot === i ? 3 : 2, this.playerState.selectedSlot === i ? 0xffffff : 0x666666);
            }
            // Time display
            const t = getCurrentTime(this.playerState);
            let timeEmoji = '🌅';
            if (t.hour >= 6 && t.hour < 12) timeEmoji = '🌞';
            else if (t.hour >= 12 && t.hour < GameConfig.time.nightStartHour) timeEmoji = '☀️';
            else if (t.hour >= GameConfig.time.nightStartHour && t.hour < 22) timeEmoji = '🌆';
            else timeEmoji = '🌙';
            this.ui.timeText.setText(`📅 Day ${t.day}\n${timeEmoji} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}\n👥 Neighbours: ${GameConfig.world.villagerCount}`);
            // Seed UI
            const currentSeed = this.currentSeedValue || getCurrentSeed();
            this.ui.seedInputText.setText(currentSeed.toString());
        }
        isTooCloseToVillage(pos) {
            const centerX = GameConfig.world.width / 2;
            const centerY = GameConfig.world.height / 2;
            return distance(pos, { x: centerX, y: centerY }) < GameConfig.world.resourceVillageMinDistance;
        }
        isTooCloseToExistingWell(pos) {
            if (!this.wells) return false;
            for (const well of this.wells) {
                if (distance(pos, well.position) < GameConfig.world.wellMinDistance) return true;
            }
            return false;
        }
        getResourceEmoji(type) {
            const emojis = {
                'blackberry': '🫐', 'mushroom': '🍄', 'herb': '🌿', 'rabbit': '🐰', 'deer': '🦌', 'tree': '🌲'
            };
            return emojis[type] || '❓';
        }
        showTempMessage(msg, duration = 2000) {
            if (this._tempMsg) this._tempMsg.destroy();
            this._tempMsg = this.add.text(this.player.x, this.player.y - 40, msg, { fontSize: '18px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#222', padding: { left: 8, right: 8, top: 4, bottom: 4 } }).setOrigin(0.5);
            this.time.delayedCall(duration, () => { if (this._tempMsg) { this._tempMsg.destroy(); this._tempMsg = null; } });
        }
        showGameOverOverlay(reason) {
            if (this._gameOverOverlay) return;
            const w = this.cameras.main.width;
            const h = this.cameras.main.height;
            const bg = this.add.rectangle(w / 2, h / 2, 400, 200, 0x222222, 0.95).setOrigin(0.5).setDepth(1000);
            const text = this.add.text(w / 2, h / 2 - 40, 'Game Over', { fontSize: '32px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5).setDepth(1001);
            const reasonText = this.add.text(w / 2, h / 2, reason, { fontSize: '18px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5).setDepth(1001);
            const btn = this.add.text(w / 2, h / 2 + 60, 'New Game', { fontSize: '20px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#228B22', padding: { left: 16, right: 16, top: 8, bottom: 8 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1001);
            btn.on('pointerdown', () => { window.location.reload(); });
            this._gameOverOverlay = [bg, text, reasonText, btn];
        }

        incrementSeed() {
            let currentSeed = parseInt(this.ui.seedInputText.text, 10);
            if (isNaN(currentSeed)) currentSeed = GameConfig.ui.seedInputMinValue;
            currentSeed = Math.min(GameConfig.ui.seedInputMaxValue, currentSeed + 1);
            this.ui.seedInputText.setText(currentSeed.toString());
            // Store the new seed value for when New Game is clicked
            this.currentSeedValue = currentSeed;
        }

        decrementSeed() {
            let currentSeed = parseInt(this.ui.seedInputText.text, 10);
            if (isNaN(currentSeed)) currentSeed = GameConfig.ui.seedInputMinValue;
            currentSeed = Math.max(GameConfig.ui.seedInputMinValue, currentSeed - 1);
            this.ui.seedInputText.setText(currentSeed.toString());
            // Store the new seed value for when New Game is clicked
            this.currentSeedValue = currentSeed;
        }

        showNewGameConfirmation() {
            if (this._confirmDialog) return;

            const w = this.cameras.main.width;
            const h = this.cameras.main.height;

            // Get current seed from stored value or UI
            let seed = this.currentSeedValue;
            if (!seed) {
                const seedText = this.ui.seedInputText.text;
                seed = parseInt(seedText, 10);
            }
            if (isNaN(seed) || seed < GameConfig.ui.seedInputMinValue) {
                seed = 23; // Default to seed 23
            } else if (seed > GameConfig.ui.seedInputMaxValue) {
                seed = GameConfig.ui.seedInputMaxValue;
            }

            // Background overlay
            const bg = this.add.rectangle(w / 2, h / 2, 400, 200, 0x222222, 0.95).setOrigin(0.5).setDepth(1000);

            // Title
            const title = this.add.text(w / 2, h / 2 - 60, 'Start New Game?', { fontSize: '24px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5).setDepth(1001);

            // Message
            const message = this.add.text(w / 2, h / 2 - 20, `Seed: ${seed}`, { fontSize: '16px', fontFamily: 'monospace', color: '#ccc' }).setOrigin(0.5).setDepth(1001);

            // Buttons
            const yesBtn = this.add.text(w / 2 - 60, h / 2 + 30, 'Yes', { fontSize: '16px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#228B22', padding: { left: 12, right: 12, top: 6, bottom: 6 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1001);

            const noBtn = this.add.text(w / 2 + 60, h / 2 + 30, 'No', { fontSize: '16px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 12, right: 12, top: 6, bottom: 6 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1001);

            // Button handlers
            yesBtn.on('pointerdown', () => {
                localStorage.setItem(GameConfig.storage.localStorageKey, seed.toString());
                window.location.reload();
            });

            noBtn.on('pointerdown', () => {
                this._confirmDialog.forEach(obj => obj.destroy());
                this._confirmDialog = null;
            });

            this._confirmDialog = [bg, title, message, yesBtn, noBtn];
        }
    }
    function getPhaserBarColor(type) {
        const colors = {
            temperature: 0xff6b6b,
            water: 0x4ecdc4,
            calories: 0x45b7d1,
            vitaminA: 0x96ceb4,
            vitaminB: 0xfeca57,
            vitaminC: 0xff9ff3,
            vitaminD: 0x54a0ff,
            vitaminE: 0x5f27cd
        };
        return colors[type] || 0x666666;
    }
    // Seeded random number generator for consistent world generation
    class SeededRandom {
        constructor(seed) {
            this.seed = seed;
        }

        // Simple but effective seeded random number generator
        random() {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280;
        }

        // Get random number between min and max
        randomRange(min, max) {
            return min + this.random() * (max - min);
        }

        // Get random integer between min and max (inclusive)
        randomInt(min, max) {
            return Math.floor(this.randomRange(min, max + 1));
        }
    }

    function getCurrentSeed() {
        let currentSeed = parseInt(localStorage.getItem(GameConfig.storage.localStorageKey), 10);
        if (!currentSeed || isNaN(currentSeed)) {
            // Default to seed 23 for consistency
            currentSeed = 23;
            // Store it for consistency
            localStorage.setItem(GameConfig.storage.localStorageKey, currentSeed.toString());
        }
        return currentSeed;
    }
    function updateNeeds(playerState, delta) {
        const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
        const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
        const inGameMinutes = delta * inGameMinutesPerMs;
        const t = getCurrentTime(playerState);
        const isNight = (t.hour < GameConfig.time.gameStartHour || t.hour >= GameConfig.time.nightStartHour);

        // Calculate decay rates from config (per in-game minute)
        if (!playerState.dailyDecay) {
            playerState.dailyDecay = {
                temperature: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.needs.minutesPerHour),
                water: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.water * GameConfig.needs.minutesPerHour),
                calories: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.calories * GameConfig.needs.minutesPerHour),
                vitamins: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.vitamins * GameConfig.needs.minutesPerHour)
            };
        }

        // Apply decay based on config values
        if (isNight) playerState.needs.temperature -= playerState.dailyDecay.temperature * inGameMinutes;
        playerState.needs.water -= playerState.dailyDecay.water * inGameMinutes;
        playerState.needs.calories -= playerState.dailyDecay.calories * inGameMinutes;
        for (let i = 0; i < playerState.needs.vitamins.length; i++) {
            playerState.needs.vitamins[i] -= playerState.dailyDecay.vitamins * inGameMinutes;
        }

        // Clamp values to valid range
        playerState.needs.temperature = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, playerState.needs.temperature));
        playerState.needs.water = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, playerState.needs.water));
        playerState.needs.calories = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, playerState.needs.calories));
        for (let i = 0; i < playerState.needs.vitamins.length; i++) {
            playerState.needs.vitamins[i] = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, playerState.needs.vitamins[i]));
        }

        // Assert bounds
        assert(playerState.needs.temperature >= GameConfig.needs.minValue && playerState.needs.temperature <= GameConfig.needs.maxValue, 'Temperature out of bounds');
        assert(playerState.needs.water >= GameConfig.needs.minValue && playerState.needs.water <= GameConfig.needs.maxValue, 'Water out of bounds');
        assert(playerState.needs.calories >= GameConfig.needs.minValue && playerState.needs.calories <= GameConfig.needs.maxValue, 'Calories out of bounds');
    }
    function checkGameOver(playerState) {
        const n = playerState.needs;
        if (n.temperature <= 0) return 'You died from cold.';
        if (n.water <= 0) return 'You died from dehydration.';
        if (n.calories <= 0) return 'You died from starvation.';
        for (let i = 0; i < n.vitamins.length; i++) {
            if (n.vitamins[i] <= 0) return `You died from vitamin ${String.fromCharCode(65 + i)} deficiency.`;
        }
        return null;
    }
    function getCurrentTime(playerState) {
        const totalSeconds = playerState.currentTime || GameConfig.time.gameStartTime;
        const day = Math.floor(totalSeconds / GameConfig.time.secondsPerDay) + 1;
        const hour = Math.floor((totalSeconds % GameConfig.time.secondsPerDay) / GameConfig.time.secondsPerHour);
        const minute = Math.floor((totalSeconds % GameConfig.time.secondsPerHour) / GameConfig.time.secondsPerMinute);
        return { day, hour, minute };
    }
    // Initialize logging system
    initLogging();

    // Phaser boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.phaserGame = new Phaser.Game({
                type: Phaser.AUTO,
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: '#2d3748',
                scene: MainScene,
                parent: 'game-area',
                fps: { target: 60, forceSetTimeOut: true }
            });
        });
    } else {
        window.phaserGame = new Phaser.Game({
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: '#2d3748',
            scene: MainScene,
            parent: 'game-area',
            fps: { target: 60, forceSetTimeOut: true }
        });
    }
})(); 