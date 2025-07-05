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

    // === GAME UTILITIES ===
    // Centralized utility functions to eliminate code duplication
    const GameUtils = {
        // Distance calculation between two positions
        distance(pos1, pos2) {
            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            return Math.sqrt(dx * dx + dy * dy);
        },

        // All food types extracted from GameConfig for easy access
        ALL_FOOD_TYPES: Object.keys(GameConfig.resources.foodData).filter(type => GameConfig.resources.foodData[type].calories > 0),

        // Check if an item type is food
        isFood(type) {
            return this.ALL_FOOD_TYPES.includes(type);
        },

        // Get nutrition data for a food type
        getNutrition(foodType) {
            if (GameConfig.resources.foodData[foodType]) {
                return GameConfig.resources.foodData[foodType];
            }
            throw new Error(`[getNutrition] Unknown food type: ${foodType}. Please check GameConfig.resources.foodData.`);
        },

        // Apply nutrition to a target (player or villager)
        applyNutrition(target, foodType) {
            const nutrition = this.getNutrition(foodType);
            if (nutrition) {
                target.needs.calories = Math.min(GameConfig.needs.fullValue, target.needs.calories + nutrition.calories);
                target.needs.water = Math.min(GameConfig.needs.fullValue, target.needs.water + nutrition.water);

                for (let i = 0; i < nutrition.vitamins.length; i++) {
                    target.needs.vitamins[i] = Math.min(GameConfig.needs.fullValue, target.needs.vitamins[i] + nutrition.vitamins[i]);
                }
            }
        },

        // Generic function to find nearest entity matching criteria
        findNearestEntity(entities, fromPosition, filterFn) {
            assert(entities && Array.isArray(entities), 'findNearestEntity: entities must be an array');
            assert(fromPosition && typeof fromPosition.x === 'number' && typeof fromPosition.y === 'number', 'findNearestEntity: fromPosition must have x,y coordinates');
            assert(typeof filterFn === 'function', 'findNearestEntity: filterFn must be a function');

            let nearest = null;
            let nearestDistance = Infinity;

            for (const entity of entities) {
                if (filterFn(entity)) {
                    const dist = GameUtils.distance(fromPosition, entity.position);
                    if (dist < nearestDistance) {
                        nearest = entity;
                        nearestDistance = dist;
                    }
                }
            }

            return nearest;
        },

        // Find first empty slot in an array (for inventory/storage)
        findEmptySlot(items) {
            assert(items && Array.isArray(items), 'findEmptySlot: items must be an array');
            return items.findIndex(slot => slot === null);
        },

        // Check if two positions are within interaction distance
        isWithinInteractionDistance(pos1, pos2, threshold = null) {
            assert(pos1 && typeof pos1.x === 'number' && typeof pos1.y === 'number', 'isWithinInteractionDistance: pos1 must have x,y coordinates');
            assert(pos2 && typeof pos2.x === 'number' && typeof pos2.y === 'number', 'isWithinInteractionDistance: pos2 must have x,y coordinates');

            const distance = GameUtils.distance(pos1, pos2);
            const interactionThreshold = threshold || GameConfig.player.interactionThreshold;
            return distance <= interactionThreshold;
        }
    };

    function assert(condition, message) {
        if (!condition) throw new Error('ASSERTION FAILED: ' + message);
    }
    // Distance function now uses GameUtils.distance

    // === BEGIN: Logging System ===
    let logTransmissionInterval;
    let domSnapshotInterval;
    let lastDomSnapshot = '';

    // ALL_FOOD_TYPES now available in GameUtils.ALL_FOOD_TYPES

    // isFood function now uses GameUtils.isFood

    // Initialize logging system
    function initLogging() {
        console.log('[Logging] Initializing browser logging system...');

        // Clear logs on page load
        clearLogsOnPageLoad();

        // Start log transmission (every 2 seconds)
        logTransmissionInterval = setInterval(sendLogsToServer, GameConfig.logging.logTransmissionInterval);

        // Start DOM snapshots (every 5 seconds)
        domSnapshotInterval = setInterval(sendDomSnapshot, GameConfig.logging.domSnapshotInterval);

        console.log('[Logging] Logging system initialized');
    }

    // Clear logs when page loads
    function clearLogsOnPageLoad() {
        fetch(GameConfig.logging.serverUrl + '/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('[Logging] Cleared previous session logs on page load');
                }
            }).catch(err => {
                console.warn('[Logging] Failed to clear logs on page load:', err.message);
            });
    }

    // Send captured logs to server
    function sendLogsToServer() {
        if (!window.earlyLogs || window.earlyLogs.length === 0) return;

        const logsToSend = window.earlyLogs.splice(0); // Take all logs and clear array

        // Format logs for server
        const formattedLogs = logsToSend.map(log => ({
            type: log.type,
            message: log.args.map(arg => {
                if (typeof arg === 'object') {
                    // Handle Error objects specially
                    if (arg instanceof Error || (arg && arg.message && arg.stack)) {
                        return `${arg.name || 'Error'}: ${arg.message}\n  ${arg.stack}`;
                    }
                    // Handle other objects
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' '),
            timestamp: log.timestamp,
            callStack: log.callStack
        }));

        // Send to server
        fetch(GameConfig.logging.serverUrl + '/log', {
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

                fetch(GameConfig.logging.serverUrl + '/dom-snapshot', {
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
            if (index > GameConfig.logging.domElementLimit) return; // Limit to prevent memory issues

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
    // Perlin noise constants - these are technical constants, not configurable game values
    const PERLIN_PERMUTATION_SIZE = 256;
    const PERLIN_MASK = 255;
    const PERLIN_HASH_CONSTANT = 0x45d9f3b;

    class PerlinNoise {
        constructor(seed) {
            this.seed = seed;
            this.permutation = this.generatePermutation();
        }
        generatePermutation() {
            const p = new Array(PERLIN_PERMUTATION_SIZE);
            for (let i = 0; i < PERLIN_PERMUTATION_SIZE; i++) p[i] = i;
            for (let i = PERLIN_PERMUTATION_SIZE - 1; i > 0; i--) {
                const j = this.hash(this.seed + i) % (i + 1);
                [p[i], p[j]] = [p[j], p[i]];
            }
            return [...p, ...p];
        }
        hash(x) {
            x = ((x >> 16) ^ x) * PERLIN_HASH_CONSTANT;
            x = ((x >> 16) ^ x) * PERLIN_HASH_CONSTANT;
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
            const X = Math.floor(x) & PERLIN_MASK;
            const Y = Math.floor(y) & PERLIN_MASK;
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

    // === BEGIN: Villager AI System ===
    class Villager {
        constructor(name, campPosition, villagerId, seededRandom = null) {
            this.name = name;
            this.campPosition = campPosition;
            this.villagerId = villagerId;

            // Position and movement
            this.position = { ...campPosition };
            this.moveSpeed = GameConfig.villager.moveSpeed;

            // Needs system (same as player) - Initialize with random values
            // Use seeded random if provided, otherwise fall back to Math.random
            const random = seededRandom || { randomRange: (min, max) => Math.random() * (max - min) + min };
            this.needs = {
                temperature: random.randomRange(GameConfig.player.startingStats.temperature.min, GameConfig.player.startingStats.temperature.max),
                water: random.randomRange(GameConfig.player.startingStats.water.min, GameConfig.player.startingStats.water.max),
                calories: random.randomRange(GameConfig.player.startingStats.calories.min, GameConfig.player.startingStats.calories.max),
                vitamins: new Array(GameConfig.needs.vitaminCount).fill(0).map(() => random.randomRange(GameConfig.player.startingStats.vitamins.min, GameConfig.player.startingStats.vitamins.max))
            };

            // Inventory (same as player)
            this.inventory = new Array(GameConfig.player.inventorySize).fill(null);

            // State management - using new state machine (must be after needs and inventory are initialized)
            this.stateMachine = new VillagerStateMachine(this);

            // Daily variance for needs (different per villager)
            this.dailyDecay = this.generateDailyDecay();

            // Visual representation
            this.phaserText = null;
            this.nameText = null;
            this.healthEmoji = GameConfig.emojis.health;
            this.visualsCreated = false; // Flag to track if visuals have been created

            // Game entities reference (will be set by update method)
            this.gameEntities = null;

            console.log(`[Villager] Created villager ${name} at camp ${villagerId}`);
        }

        // === ESSENTIAL METHODS ONLY ===

        update(deltaTime, gameTime, entities, storageBoxes) {
            // Store reference to game entities and current game time
            this.gameEntities = entities;
            this.currentGameTime = gameTime;

            // Update needs
            this.updateNeeds(deltaTime, gameTime);

            // Log what villager is trying to do when needs are critically low (behind spam gate)
            const hasCriticalNeeds = this.needs.temperature < 5 || this.needs.water < 5 || this.needs.calories < 5 || this.needs.vitamins.some(v => v < 5);
            if (hasCriticalNeeds && window.summaryLoggingEnabled) {
                const t = this.getCurrentTime(gameTime);
                const currentStateName = this.stateMachine.getStateName(this.stateMachine.currentState);
                console.log(`[Villager] ${this.name} CRITICAL ACTION LOG: State=${currentStateName}, Hour=${t.hour.toFixed(1)}`);
                console.log(`[Villager] ${this.name} CRITICAL ACTION LOG: Position=(${Math.round(this.position.x)}, ${Math.round(this.position.y)}), Camp=(${Math.round(this.campPosition.x)}, ${Math.round(this.campPosition.y)})`);
                console.log(`[Villager] ${this.name} CRITICAL ACTION LOG: Inventory=[${this.inventory.map(item => item ? item.type : 'empty').join(', ')}], IsAtCamp=${this.isAtCamp()}`);
            }

            // Use state machine
            this.stateMachine.update(deltaTime, gameTime, entities, storageBoxes);

            // Update visual representation
            this.updateVisuals();

            // Check for death
            return this.checkDeath();
        }

        generateDailyDecay() {
            // Generate unique daily decay rates for this villager
            const variance = GameConfig.needsVariance;
            return {
                temperature: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.time.minutesPerHour) * (1 + (Math.random() - 0.5) * variance),
                water: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.water * GameConfig.time.minutesPerHour) * (1 + (Math.random() - 0.5) * variance),
                calories: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.calories * GameConfig.time.minutesPerHour) * (1 + (Math.random() - 0.5) * variance),
                vitamins: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.vitamins * GameConfig.time.minutesPerHour) * (1 + (Math.random() - 0.5) * variance)
            };
        }

        updateNeeds(deltaTime, gameTime) {
            const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
            const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
            const inGameMinutes = deltaTime * inGameMinutesPerMs;

            const t = this.getCurrentTime(gameTime);
            const isNight = (t.hour < GameConfig.time.gameStartHour || t.hour >= GameConfig.time.nightStartHour);

            // Store old values for comparison
            const oldNeeds = {
                temperature: this.needs.temperature,
                water: this.needs.water,
                calories: this.needs.calories,
                vitamins: [...this.needs.vitamins]
            };

            // Apply decay based on config values
            if (isNight) this.needs.temperature -= this.dailyDecay.temperature * inGameMinutes;
            this.needs.water -= this.dailyDecay.water * inGameMinutes;
            this.needs.calories -= this.dailyDecay.calories * inGameMinutes;

            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] -= this.dailyDecay.vitamins * inGameMinutes;
            }

            // Apply fire temperature effects for villagers (same as player)
            if (isNight && this.gameEntities) {
                for (const entity of this.gameEntities) {
                    if (entity.type === GameConfig.entityTypes.fireplace && entity.isBurning && entity.wood > 0) {
                        const dist = GameUtils.distance(this.position, entity.position);
                        const fireRange = GameConfig.player.fireHeatingRange; // Use config-defined heating range

                        if (dist <= fireRange) {
                            // Calculate temperature gain (same rate as night decay)
                            const decayRate = GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.time.minutesPerHour);
                            const temperatureGain = decayRate * inGameMinutes;

                            this.needs.temperature = Math.min(GameConfig.needs.fullValue, this.needs.temperature + temperatureGain);

                            // Wood consumption is now handled globally in MainScene.applyFireTemperatureEffects()
                            // No need to consume wood here to avoid double consumption

                            break; // Only apply from one fire
                        }
                    }
                }
            }

            // Clamp values to valid range
            this.needs.temperature = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.temperature));
            this.needs.water = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.water));
            this.needs.calories = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.calories));

            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.vitamins[i]));
            }

            // Check if any need dropped below 2 and log detailed information
            const criticalNeeds = [];
            if (this.needs.temperature < 2 && oldNeeds.temperature >= 2) criticalNeeds.push('temperature');
            if (this.needs.water < 2 && oldNeeds.water >= 2) criticalNeeds.push('water');
            if (this.needs.calories < 2 && oldNeeds.calories >= 2) criticalNeeds.push('calories');
            for (let i = 0; i < this.needs.vitamins.length; i++) {
                if (this.needs.vitamins[i] < 2 && oldNeeds.vitamins[i] >= 2) {
                    criticalNeeds.push(`vitamin${String.fromCharCode(65 + i)}`);
                }
            }

            if (criticalNeeds.length > 0 && window.summaryLoggingEnabled) {
                const t = this.getCurrentTime(gameTime);
                console.log(`[Villager] ${this.name} CRITICAL NEEDS ALERT: ${criticalNeeds.join(', ')} dropped below 2!`);
                console.log(`[Villager] ${this.name} Current stats: T${this.needs.temperature.toFixed(1)} W${this.needs.water.toFixed(1)} C${this.needs.calories.toFixed(1)} V[${this.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                console.log(`[Villager] ${this.name} Current state: ${this.stateMachine.getStateName(this.stateMachine.currentState)}, hour: ${t.hour.toFixed(1)}, position: (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
                console.log(`[Villager] ${this.name} Inventory: [${this.inventory.map(item => item ? item.type : 'empty').join(', ')}]`);
                console.log(`[Villager] ${this.name} Daily decay rates: T${this.dailyDecay.temperature.toFixed(4)} W${this.dailyDecay.water.toFixed(4)} C${this.dailyDecay.calories.toFixed(4)} V${this.dailyDecay.vitamins.toFixed(4)}`);
                console.log(`[Villager] ${this.name} Is night: ${isNight}, inGameMinutes: ${inGameMinutes.toFixed(4)}`);
            }

            // Also log when any need is critically low (below 5) every 10 seconds
            const now = Date.now();
            if (!this.lastCriticalLog || now - this.lastCriticalLog > 10000) { // 10 seconds
                const lowNeeds = [];
                if (this.needs.temperature < 5) lowNeeds.push(`T${this.needs.temperature.toFixed(1)}`);
                if (this.needs.water < 5) lowNeeds.push(`W${this.needs.water.toFixed(1)}`);
                if (this.needs.calories < 5) lowNeeds.push(`C${this.needs.calories.toFixed(1)}`);
                for (let i = 0; i < this.needs.vitamins.length; i++) {
                    if (this.needs.vitamins[i] < 5) {
                        lowNeeds.push(`V${String.fromCharCode(65 + i)}${this.needs.vitamins[i].toFixed(1)}`);
                    }
                }

                if (lowNeeds.length > 0 && window.summaryLoggingEnabled) {
                    const t = this.getCurrentTime(gameTime);
                    console.log(`[Villager] ${this.name} LOW NEEDS WARNING: ${lowNeeds.join(', ')} | State: ${this.stateMachine.getStateName(this.stateMachine.currentState)}, Hour: ${t.hour.toFixed(1)}`);
                    this.lastCriticalLog = now;
                }
            }
        }

        // === UTILITY METHODS FOR STATE MACHINE ===

        moveTowards(target, deltaTime) {
            if (!target) return;

            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            const distance = GameUtils.distance(this.position, target);

            if (distance > 0) {
                const speed = this.moveSpeed * deltaTime / 1000;
                const moveDistance = Math.min(speed, distance);
                const ratio = moveDistance / distance;

                this.position.x += dx * ratio;
                this.position.y += dy * ratio;

                // Log movement occasionally (1% chance per frame, behind spam gate)
                if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} MOVEMENT: Moving towards (${Math.round(target.x)}, ${Math.round(target.y)}), Distance: ${Math.round(distance)}px, Speed: ${this.moveSpeed}px/s, Delta: ${deltaTime}ms, MoveDistance: ${Math.round(moveDistance)}px`);
                }
            }
        }

        isAtCamp() {
            return GameUtils.distance(this.position, this.campPosition) <= GameConfig.technical.distances.campRadius;
        }

        getCurrentTime(gameTime) {
            // Use the global getCurrentTime function for consistency
            // Create a temporary playerState-like object with currentTime
            const tempPlayerState = { currentTime: gameTime };
            return getCurrentTime(tempPlayerState);
        }

        isInventoryFull() {
            return this.inventory.every(item => item !== null);
        }

        updateVisuals() {
            // Skip if visuals haven't been created yet
            if (!this.visualsCreated) {
                return;
            }

            // Defensive check - ensure visuals are created before updating
            if (!this.phaserText || !this.nameText || !this.stateText) {
                console.warn(`[Villager] ${this.name} updateVisuals called but visuals are null`);
                return;
            }

            // Update villager emoji
            this.phaserText.setPosition(this.position.x, this.position.y);

            // Update name text (always show just the name, no stats)
            this.nameText.setPosition(this.position.x, this.position.y - 20);
            this.nameText.setText(this.name);

            // Update state text with action and task emojis (only show if debug enabled)
            this.stateText.setPosition(this.position.x, this.position.y + 30);
            if (window.villagerDebugEnabled) {
                const currentState = this.stateMachine.getStateName(this.stateMachine.currentState);
                this.stateText.setText(currentState);
                this.stateText.setVisible(true);
            } else {
                this.stateText.setVisible(false);
            }

            // Update stats debug text when debug is enabled
            if (window.villagerDebugEnabled) {
                if (!this.statsText) {
                    // Create stats text if it doesn't exist
                    this.statsText = this.phaserText.scene.add.text(this.position.x, this.position.y - 40, '', {
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: '#ffff00',
                        backgroundColor: '#000',
                        padding: { left: 2, right: 2, top: 1, bottom: 1 }
                    }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug);
                }

                // Show stats: T W C V[A,B,C,D,E]
                const stats = `T${this.needs.temperature.toFixed(2)} W${this.needs.water.toFixed(2)} C${this.needs.calories.toFixed(2)} V[${this.needs.vitamins.map(v => v.toFixed(2)).join(',')}]`;
                this.statsText.setText(stats);
                this.statsText.setPosition(this.position.x, this.position.y - 40);
                this.statsText.setVisible(true);
            } else {
                // Hide stats text when debug is disabled
                if (this.statsText) {
                    this.statsText.setVisible(false);
                }
            }

            // Update inventory text when debug is enabled
            if (window.villagerDebugEnabled) {
                if (!this.inventoryText) {
                    // Create inventory text if it doesn't exist
                    this.inventoryText = this.phaserText.scene.add.text(this.position.x, this.position.y + 50, '', {
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: '#00ff00',
                        backgroundColor: '#000',
                        padding: { left: 2, right: 2, top: 1, bottom: 1 }
                    }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug);
                }

                // Show inventory slots as emojis (empty slots show nothing)
                const inventoryEmojis = this.inventory.map(item => item ? item.emoji : ' ').join('');
                this.inventoryText.setText(inventoryEmojis);
                this.inventoryText.setPosition(this.position.x, this.position.y + 50);
                this.inventoryText.setVisible(true);
            } else {
                // Hide inventory text when debug is disabled
                if (this.inventoryText) {
                    this.inventoryText.setVisible(false);
                }
            }
        }

        checkDeath() {
            // Check if any need is critically low
            const criticalNeeds = this.needs.temperature < 1 || this.needs.water < 1 || this.needs.calories < 1 || this.needs.vitamins.some(v => v < 1);

            if (criticalNeeds && window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.name} has died from critical needs!`);
                console.log(`[Villager] ${this.name} Final stats: T${this.needs.temperature.toFixed(1)} W${this.needs.water.toFixed(1)} C${this.needs.calories.toFixed(1)} V[${this.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                console.log(`[Villager] ${this.name} Final position: (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
                console.log(`[Villager] ${this.name} Final state: ${this.stateMachine.getStateName(this.stateMachine.currentState)}`);
                return true; // Villager has died
            }

            return false; // Villager is alive
        }

        createVisuals(scene) {
            // Create villager emoji
            this.phaserText = scene.add.text(this.position.x, this.position.y, this.healthEmoji, {
                fontSize: '22px',
                fontFamily: 'Arial'
            }).setOrigin(0.5);

            // Create name text
            this.nameText = scene.add.text(this.position.x, this.position.y - 20, this.name, {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5);

            // Create state text (hidden by default)
            this.stateText = scene.add.text(this.position.x, this.position.y + 30, '', {
                fontSize: '10px',
                fontFamily: 'Arial',
                color: '#ffff00',
                backgroundColor: '#000',
                padding: { left: 2, right: 2, top: 1, bottom: 1 }
            }).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);

            // Create stats text (hidden by default, will be shown when debug is enabled)
            this.statsText = scene.add.text(this.position.x, this.position.y - 40, '', {
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#ffff00',
                backgroundColor: '#000',
                padding: { left: 2, right: 2, top: 1, bottom: 1 }
            }).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);

            // Create inventory text (hidden by default, will be shown when debug is enabled)
            this.inventoryText = scene.add.text(this.position.x, this.position.y + 50, '', {
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#00ff00',
                backgroundColor: '#000',
                padding: { left: 2, right: 2, top: 1, bottom: 1 }
            }).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);

            // Mark visuals as created
            this.visualsCreated = true;

            // Return the expected structure for MainScene
            return {
                entity: this.phaserText,
                nameText: this.nameText,
                stateText: this.stateText,
                statsText: this.statsText,
                inventoryText: this.inventoryText
            };
        }

        destroy() {
            if (this.phaserText) {
                this.phaserText.destroy();
                this.phaserText = null;
            }
            if (this.nameText) {
                this.nameText.destroy();
                this.nameText = null;
            }
            if (this.stateText) {
                this.stateText.destroy();
                this.stateText = null;
            }
            if (this.statsText) {
                this.statsText.destroy();
                this.statsText = null;
            }
            if (this.inventoryText) {
                this.inventoryText.destroy();
                this.inventoryText = null;
            }
        }
    }

    // === VILLAGER STATE MACHINE ===
    // Implements priority-based state management
    // 
    // DESIGN: This state machine evaluates states every frame and executes the highest priority
    // state that should be active. States can interrupt lower priority states (emergencies).
    // All resource gathering/usage is instant (no duration) as per design requirements.

    // State definitions with priority order (lower number = higher priority)
    const VILLAGER_STATES = {
        SLEEP: 1,                    // Highest priority - sleep during night
        EMERGENCY_DRINK: 2,          // Hard interrupt - water <20%
        EMERGENCY_EAT: 3,            // Hard interrupt - calories <20%
        EMERGENCY_WARM_UP: 4,        // Hard interrupt - temperature <20%
        EMERGENCY_FIRE_REFILL: 5,    // Hard interrupt - own fire <3 logs
        REGULAR_DRINK: 6,            // Normal need - water <50%
        REGULAR_WARM_UP: 7,          // Normal need - temperature <70%
        REGULAR_EAT: 8,              // Normal need - calories <60%
        REGULAR_FIRE_REFILL: 9,      // Normal need - own fire <10 logs
        FORAGE: 10,                  // Village task - collect and store resources
        IDLE: 11                     // Default state - stay near fire
    };

    class VillagerStateMachine {
        constructor(villager) {
            this.villager = villager;
            this.currentState = VILLAGER_STATES.IDLE;
            this.stateData = {}; // State-specific data storage

            // Assert we have required villager properties
            assert(villager.needs, 'Villager must have needs object');
            assert(villager.inventory, 'Villager must have inventory array');
            assert(villager.position, 'Villager must have position');
            assert(villager.campPosition, 'Villager must have campPosition');

            // Log initial state
            console.log(`[VillagerStateMachine] ${villager.name} initialized with state: ${this.getStateName(this.currentState)}`);
            console.log(`[VillagerStateMachine] ${villager.name} starting needs: T${villager.needs.temperature.toFixed(1)} W${villager.needs.water.toFixed(1)} C${villager.needs.calories.toFixed(1)} V[${villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
            console.log(`[VillagerStateMachine] ${villager.name} starting position: (${Math.round(villager.position.x)}, ${Math.round(villager.position.y)})`);

            // Log nearby objects for initial state (but only after game entities are available)
            // This will be called later when the game starts
        }

        // Main update method - called every frame
        update(deltaTime, gameTime, entities, storageBoxes) {
            // Evaluate which state should be active (highest priority)
            const newState = this.evaluateState(gameTime, entities, storageBoxes);

            // Handle state transition
            if (newState !== this.currentState) {
                const oldStateName = this.getStateName(this.currentState);
                const newStateName = this.getStateName(newState);

                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} STATE TRANSITION: ${oldStateName} → ${newStateName}`);
                    console.log(`[VillagerStateMachine] ${this.villager.name} needs at transition: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                    console.log(`[VillagerStateMachine] ${this.villager.name} position at transition: (${Math.round(this.villager.position.x)}, ${Math.round(this.villager.position.y)})`);
                }

                // Log nearby objects for state transitions
                this.logNearbyObjects();

                this.exitState(this.currentState);
                this.enterState(newState);
                this.currentState = newState;
            }

            // Execute current state behavior
            this.executeState(deltaTime, entities, storageBoxes);
        }

        // Evaluate which state should be active based on priority
        evaluateState(gameTime, entities, storageBoxes) {
            const t = this.getCurrentTime(gameTime);
            const hour = t.hour;

            // Log evaluation context (but only occasionally to avoid spam, behind spam gate)
            const shouldLogEvaluation = Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled; // 1% chance per frame
            if (shouldLogEvaluation) {
                console.log(`[VillagerStateMachine] ${this.villager.name} evaluating state at hour ${hour.toFixed(1)}`);
                console.log(`[VillagerStateMachine] ${this.villager.name} current needs: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
            }

            // 1. SLEEP - Highest priority (during sleep hours)
            if (this.shouldSleep(hour)) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing SLEEP (hour ${hour.toFixed(1)})`);
                return VILLAGER_STATES.SLEEP;
            }

            // 2. EMERGENCY_DRINK - Hard interrupt
            if (this.villager.needs.water < GameConfig.villager.emergencyThresholds.water) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing EMERGENCY_DRINK (water ${this.villager.needs.water.toFixed(1)} < ${GameConfig.villager.emergencyThresholds.water})`);
                return VILLAGER_STATES.EMERGENCY_DRINK;
            }

            // 3. EMERGENCY_EAT - Hard interrupt
            if (this.villager.needs.calories < GameConfig.villager.emergencyThresholds.calories) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing EMERGENCY_EAT (calories ${this.villager.needs.calories.toFixed(1)} < ${GameConfig.villager.emergencyThresholds.calories})`);
                return VILLAGER_STATES.EMERGENCY_EAT;
            }

            // 4. EMERGENCY_WARM_UP - Hard interrupt
            if (this.villager.needs.temperature < GameConfig.villager.emergencyThresholds.temperature) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing EMERGENCY_WARM_UP (temperature ${this.villager.needs.temperature.toFixed(1)} < ${GameConfig.villager.emergencyThresholds.temperature})`);
                return VILLAGER_STATES.EMERGENCY_WARM_UP;
            }

            // 5. EMERGENCY_FIRE_REFILL - Hard interrupt
            if (this.shouldEmergencyRefillFire(entities)) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing EMERGENCY_FIRE_REFILL`);
                return VILLAGER_STATES.EMERGENCY_FIRE_REFILL;
            }

            // 6. REGULAR_DRINK - Normal need
            if (this.villager.needs.water < GameConfig.villager.regularThresholds.water) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing REGULAR_DRINK (water ${this.villager.needs.water.toFixed(1)} < ${GameConfig.villager.regularThresholds.water})`);
                return VILLAGER_STATES.REGULAR_DRINK;
            }

            // 7. REGULAR_WARM_UP - Normal need
            if (this.villager.needs.temperature < GameConfig.villager.regularThresholds.temperature) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing REGULAR_WARM_UP (temperature ${this.villager.needs.temperature.toFixed(1)} < ${GameConfig.villager.regularThresholds.temperature})`);
                return VILLAGER_STATES.REGULAR_WARM_UP;
            }

            // 8. REGULAR_EAT - Normal need
            if (this.villager.needs.calories < GameConfig.villager.regularThresholds.calories) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing REGULAR_EAT (calories ${this.villager.needs.calories.toFixed(1)} < ${GameConfig.villager.regularThresholds.calories})`);
                return VILLAGER_STATES.REGULAR_EAT;
            }

            // 9. REGULAR_FIRE_REFILL - Normal need
            if (this.shouldRegularRefillFire(entities)) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing REGULAR_FIRE_REFILL`);
                return VILLAGER_STATES.REGULAR_FIRE_REFILL;
            }

            // 10. FORAGE - Village task
            if (this.shouldForage(storageBoxes)) {
                if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing FORAGE`);
                return VILLAGER_STATES.FORAGE;
            }

            // 11. IDLE - Default state
            if (shouldLogEvaluation) console.log(`[VillagerStateMachine] ${this.villager.name} choosing IDLE (default)`);
            return VILLAGER_STATES.IDLE;
        }

        // State entry logic
        enterState(state) {
            this.stateData = {}; // Clear state data

            switch (state) {
                case VILLAGER_STATES.SLEEP:
                    this.enterSleep();
                    break;
                case VILLAGER_STATES.EMERGENCY_DRINK:
                    this.enterEmergencyDrink();
                    break;
                case VILLAGER_STATES.EMERGENCY_EAT:
                    this.enterEmergencyEat();
                    break;
                case VILLAGER_STATES.EMERGENCY_WARM_UP:
                    this.enterEmergencyWarmUp();
                    break;
                case VILLAGER_STATES.EMERGENCY_FIRE_REFILL:
                    this.enterEmergencyFireRefill();
                    break;
                case VILLAGER_STATES.REGULAR_DRINK:
                    this.enterRegularDrink();
                    break;
                case VILLAGER_STATES.REGULAR_WARM_UP:
                    this.enterRegularWarmUp();
                    break;
                case VILLAGER_STATES.REGULAR_EAT:
                    this.enterRegularEat();
                    break;
                case VILLAGER_STATES.REGULAR_FIRE_REFILL:
                    this.enterRegularFireRefill();
                    break;
                case VILLAGER_STATES.FORAGE:
                    this.enterForage();
                    break;
                case VILLAGER_STATES.IDLE:
                    this.enterIdle();
                    break;
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} entered state: ${this.getStateName(state)}`);
            }
        }

        // State exit logic
        exitState(state) {
            switch (state) {
                case VILLAGER_STATES.SLEEP:
                    this.exitSleep();
                    break;
                // Add other state exits as needed
            }
        }

        // State execution logic
        executeState(deltaTime, entities, storageBoxes) {
            switch (this.currentState) {
                case VILLAGER_STATES.SLEEP:
                    this.executeSleep(deltaTime);
                    break;
                case VILLAGER_STATES.EMERGENCY_DRINK:
                    this.executeEmergencyDrink(deltaTime, entities);
                    break;
                case VILLAGER_STATES.EMERGENCY_EAT:
                    this.executeEmergencyEat(deltaTime, entities, storageBoxes);
                    break;
                case VILLAGER_STATES.EMERGENCY_WARM_UP:
                    this.executeEmergencyWarmUp(deltaTime, entities);
                    break;
                case VILLAGER_STATES.EMERGENCY_FIRE_REFILL:
                    this.executeEmergencyFireRefill(deltaTime, entities, storageBoxes);
                    break;
                case VILLAGER_STATES.REGULAR_DRINK:
                    this.executeRegularDrink(deltaTime, entities);
                    break;
                case VILLAGER_STATES.REGULAR_WARM_UP:
                    this.executeRegularWarmUp(deltaTime, entities);
                    break;
                case VILLAGER_STATES.REGULAR_EAT:
                    this.executeRegularEat(deltaTime, entities, storageBoxes);
                    break;
                case VILLAGER_STATES.REGULAR_FIRE_REFILL:
                    this.executeRegularFireRefill(deltaTime, entities, storageBoxes);
                    break;
                case VILLAGER_STATES.FORAGE:
                    this.executeForage(deltaTime, entities, storageBoxes);
                    break;
                case VILLAGER_STATES.IDLE:
                    this.executeIdle(deltaTime, entities, storageBoxes);
                    break;
            }
        }

        // === SLEEP STATE ===
        shouldSleep(hour) {
            // Check if within sleep window (22:00-07:00 with variance)
            const sleepStart = GameConfig.villager.sleepSchedule.startHour - GameConfig.villager.sleepSchedule.variance;
            const sleepEnd = GameConfig.villager.sleepSchedule.endHour + GameConfig.villager.sleepSchedule.variance;

            // Debug logging for sleep logic (behind spam gate)
            if (window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} SLEEP_CHECK: Hour=${hour.toFixed(1)}, SleepWindow=${sleepStart}-${sleepEnd}, ShouldSleep=${sleepStart <= hour || hour <= sleepEnd}`);
            }

            // Handle wrap-around (22:00 to 07:00)
            if (sleepStart <= hour || hour <= sleepEnd) {
                // Emergency interrupts: only wake if needs are critical
                const hasEmergency =
                    this.villager.needs.water < GameConfig.villager.emergencyThresholds.water ||
                    this.villager.needs.calories < GameConfig.villager.emergencyThresholds.calories ||
                    this.villager.needs.temperature < GameConfig.villager.emergencyThresholds.temperature;

                const shouldSleep = !hasEmergency;
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} SLEEP_DECISION: HasEmergency=${hasEmergency}, FinalDecision=${shouldSleep}`);
                }
                return shouldSleep;
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} SLEEP_DECISION: Outside sleep window, FinalDecision=false`);
            }
            return false;
        }

        enterSleep() {
            // Find sleeping bag at camp
            this.stateData.sleepingBag = this.findCampSleepingBag();
            if (this.stateData.sleepingBag) {
                this.stateData.sleepingBag.isOccupied = true;
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ENTER_SLEEP: Found sleeping bag at (${Math.round(this.stateData.sleepingBag.position.x)}, ${Math.round(this.stateData.sleepingBag.position.y)})`);
                }
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ENTER_SLEEP: No sleeping bag found, will sleep at camp`);
                }
            }
        }

        executeSleep(deltaTime) {
            // Stay at sleeping bag position
            if (this.stateData.sleepingBag) {
                this.villager.moveTowards(this.stateData.sleepingBag.position, deltaTime);
                // Log occasionally to see if they're moving (behind spam gate)
                if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) { // 1% chance per frame
                    console.log(`[VillagerStateMachine] ${this.villager.name} SLEEPING: Moving to sleeping bag at (${Math.round(this.stateData.sleepingBag.position.x)}, ${Math.round(this.stateData.sleepingBag.position.y)})`);
                }
            } else {
                // No sleeping bag, stay at camp
                this.villager.moveTowards(this.villager.campPosition, deltaTime);
                // Log occasionally to see if they're moving (behind spam gate)
                if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) { // 1% chance per frame
                    console.log(`[VillagerStateMachine] ${this.villager.name} SLEEPING: Moving to camp at (${Math.round(this.villager.campPosition.x)}, ${Math.round(this.villager.campPosition.y)})`);
                }
            }
        }

        exitSleep() {
            // Free sleeping bag
            if (this.stateData.sleepingBag) {
                this.stateData.sleepingBag.isOccupied = false;
                this.stateData.sleepingBag = null;
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} EXIT_SLEEP: Freed sleeping bag`);
                }
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} EXIT_SLEEP: No sleeping bag to free`);
                }
            }
        }

        // === EMERGENCY DRINK STATE ===
        enterEmergencyDrink() {
            // Find nearest well
            this.stateData.targetWell = this.findNearestWell();
        }

        executeEmergencyDrink(deltaTime, entities) {
            this.executeDrink(deltaTime, entities);
        }

        // === EMERGENCY EAT STATE ===
        enterEmergencyEat() {
            // Will find food in execute
        }

        executeEmergencyEat(deltaTime, entities, storageBoxes) {
            this.executeEat(true, deltaTime, entities, storageBoxes);
        }

        // === EMERGENCY WARM UP STATE ===
        enterEmergencyWarmUp() {
            // Find nearest burning fire
            this.stateData.targetFire = this.findNearestBurningFire();
        }

        executeEmergencyWarmUp(deltaTime, entities) {
            this.executeWarmUp(deltaTime, entities);
        }

        // === EMERGENCY FIRE REFILL STATE ===
        shouldEmergencyRefillFire(entities) {
            return this.shouldRefillFire(true, entities);
        }

        enterEmergencyFireRefill() {
            // Find own fireplace (wood will be found in execute phase)
            this.stateData.ownFire = this.findOwnFireplace();
            this.stateData.targetWood = null; // Will be set in execute phase
            this.stateData.woodTarget = 1; // Need 1 piece of wood to refill fire
        }

        executeEmergencyFireRefill(deltaTime, entities, storageBoxes) {
            this.executeFireRefill(true, deltaTime, entities, storageBoxes);
        }

        // === REGULAR DRINK STATE ===
        enterRegularDrink() {
            this.stateData.targetWell = this.findNearestWell();
        }

        executeRegularDrink(deltaTime, entities) {
            this.executeDrink(deltaTime, entities);
        }

        // === REGULAR WARM UP STATE ===
        enterRegularWarmUp() {
            this.stateData.targetFire = this.findNearestBurningFire();
        }

        executeRegularWarmUp(deltaTime, entities) {
            this.executeWarmUp(deltaTime, entities);
        }

        // === REGULAR EAT STATE ===
        enterRegularEat() {
            // Will find food in execute
        }

        executeRegularEat(deltaTime, entities, storageBoxes) {
            this.executeEat(false, deltaTime, entities, storageBoxes);
        }

        // === REGULAR FIRE REFILL STATE ===
        shouldRegularRefillFire(entities) {
            return this.shouldRefillFire(false, entities);
        }

        enterRegularFireRefill() {
            this.stateData.ownFire = this.findOwnFireplace();
            this.stateData.targetWood = null; // Will be set in execute phase
            this.stateData.woodTarget = 1; // Need 1 piece of wood to refill fire
        }

        executeRegularFireRefill(deltaTime, entities, storageBoxes) {
            this.executeFireRefill(false, deltaTime, entities, storageBoxes);
        }

        // === FORAGE STATE ===
        shouldForage(storageBoxes) {
            // Check if both personal and communal storage have space
            const personalStorage = this.findOwnStorageBox();
            const communalStorage = this.findCommunalStorageBox();

            if (!personalStorage || !communalStorage) {
                return false; // Can't forage if storage isn't available
            }

            const personalStorageCount = personalStorage.items.filter(item => item !== null).length;
            const communalStorageCount = communalStorage.items.filter(item => item !== null).length;

            // Only forage if both storages have space
            return personalStorageCount < GameConfig.storage.personalCapacity &&
                communalStorageCount < GameConfig.storage.communalCapacity;
        }

        enterForage() {
            // Initialize forage state - will find target resource when needed
            this.stateData.targetResource = null;
            this.stateData.storageBox = null;
        }

        executeForage(deltaTime, entities, storageBoxes) {
            // If we have items to store, store them first
            if (this.hasItemsToStore()) {
                const storeComplete = this.storeForagedItems(deltaTime);
                if (!storeComplete) {
                    return; // Still moving to storage or storing
                }
                // All items stored, continue with collection
            }

            // Find and collect resources
            if (!this.stateData.targetResource) {
                this.stateData.targetResource = this.findNearestResource(entities);
                if (this.stateData.targetResource && window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} FORAGE: Found target resource ${this.stateData.targetResource.type} at (${Math.round(this.stateData.targetResource.position.x)}, ${Math.round(this.stateData.targetResource.position.y)})`);
                }
            }

            if (this.stateData.targetResource) {
                // Move towards target resource
                this.villager.moveTowards(this.stateData.targetResource.position, deltaTime);

                if (GameUtils.isWithinInteractionDistance(this.villager.position, this.stateData.targetResource.position)) {
                    if (this.collectResource(this.stateData.targetResource)) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[VillagerStateMachine] ${this.villager.name} FORAGE: Collected ${this.stateData.targetResource.type}`);
                        }
                        this.stateData.targetResource = null; // Clear target to find new one
                    } else {
                        // Collection failed, find new target
                        this.stateData.targetResource = null;
                    }
                }
            }
        }

        storeForagedItems(deltaTime) {
            // Store ALL items before returning true
            let itemsStored = false;

            // First try personal storage
            const personalStorage = this.findOwnStorageBox();
            if (personalStorage) {
                const personalStorageCount = personalStorage.items.filter(item => item !== null).length;
                if (personalStorageCount < GameConfig.storage.personalCapacity) {
                    const distanceToStorage = GameUtils.distance(this.villager.position, personalStorage.position);

                    if (distanceToStorage <= GameConfig.player.interactionThreshold) {
                        // At storage, try to store all items at once
                        const itemsStoredCount = this.storeAllItemsInStorage(personalStorage);
                        if (itemsStoredCount > 0) {
                            itemsStored = true;
                            if (window.summaryLoggingEnabled) {
                                console.log(`[VillagerStateMachine] ${this.villager.name} FORAGE: Stored ${itemsStoredCount} items in personal storage`);
                            }
                        }
                    } else {
                        // Move towards personal storage
                        this.villager.moveTowards(personalStorage.position, deltaTime);
                        return false; // Still moving
                    }
                }
            }

            // If we still have items to store, try communal storage
            if (this.hasItemsToStore()) {
                const communalStorage = this.findCommunalStorageBox();
                if (communalStorage) {
                    const communalStorageCount = communalStorage.items.filter(item => item !== null).length;
                    if (communalStorageCount < GameConfig.storage.communalCapacity) {
                        const distanceToStorage = GameUtils.distance(this.villager.position, communalStorage.position);

                        if (distanceToStorage <= GameConfig.player.interactionThreshold) {
                            // At storage, try to store all remaining items at once
                            const itemsStoredCount = this.storeAllItemsInStorage(communalStorage);
                            if (itemsStoredCount > 0) {
                                itemsStored = true;
                                if (window.summaryLoggingEnabled) {
                                    console.log(`[VillagerStateMachine] ${this.villager.name} FORAGE: Stored ${itemsStoredCount} items in communal storage`);
                                }
                            }
                        } else {
                            // Move towards communal storage
                            this.villager.moveTowards(communalStorage.position, deltaTime);
                            return false; // Still moving
                        }
                    }
                }
            }

            // Return true if all items are stored (no more items to store)
            const allItemsStored = !this.hasItemsToStore();
            if (allItemsStored && itemsStored && window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} FORAGE: All items stored successfully`);
            } else if (!allItemsStored && window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} FORAGE: All storage appears full, cannot store remaining items`);
            }

            return allItemsStored;
        }

        // === SHARED EXECUTE METHODS ===
        // These methods eliminate code duplication between emergency and regular states

        executeFireRefill(isEmergency, deltaTime, entities, storageBoxes) {
            if (!this.stateData) this.stateData = {};
            const stateName = isEmergency ? 'EMERGENCY_FIRE_REFILL' : 'REGULAR_FIRE_REFILL';

            // If we have no target wood and have items to store, handle storage
            if (!this.stateData.targetWood && this.hasItemsToStore()) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: No target wood, handling storage before continuing`);
                }
                const storeSuccess = this.storeItemsInIdle(deltaTime);
                if (!storeSuccess) {
                    return; // Still moving to storage
                }
            }

            // Use helper for clarity
            const woodCount = this.villager.inventory.filter(item => item && item.type === GameConfig.entityTypes.tree).length;
            const hasWood = this.hasWoodInInventory();
            if (window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Wood count: ${woodCount}/${this.stateData.woodTarget}, hasWoodInInventory: ${hasWood}`);
            }

            // If we have enough wood, return to fire
            if (hasWood && woodCount >= this.stateData.woodTarget) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Have enough wood (${woodCount}), returning to fire`);
                }
                this.villager.moveTowards(this.stateData.ownFire.position, deltaTime);

                // Check if close enough to add wood
                if (GameUtils.isWithinInteractionDistance(this.villager.position, this.stateData.ownFire.position)) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Adding wood to fire`);
                    }
                    this.addWoodToFire(this.stateData.ownFire);
                }
                return;
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: State data - ownFire: ${this.stateData.ownFire ? 'found' : 'null'}, targetWood: ${this.stateData.targetWood ? 'found' : 'null'}`);
            }

            if (this.stateData.ownFire && this.stateData.targetWood) {
                // Handle both storage and world sources
                if (this.stateData.targetWood.storageBox) {
                    // Target is in storage - move to storage box
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Moving towards storage box at (${Math.round(this.stateData.targetWood.storageBox.position.x)}, ${Math.round(this.stateData.targetWood.storageBox.position.y)})`);
                    }
                    this.villager.moveTowards(this.stateData.targetWood.storageBox.position, deltaTime);

                    // Check if close enough to retrieve
                    if (GameUtils.isWithinInteractionDistance(this.villager.position, this.stateData.targetWood.storageBox.position)) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Close enough to retrieve wood from storage`);
                        }
                        if (this.retrieveFromStorage([this.stateData.targetWood.storageBox], GameConfig.entityTypes.tree)) {
                            if (window.summaryLoggingEnabled) {
                                console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Wood retrieved from storage successfully`);
                            }
                            // Clear target so we find a new source
                            this.stateData.targetWood = null;
                        } else {
                            // Retrieval failed - clear targetWood so we try a different source next time
                            if (window.summaryLoggingEnabled) {
                                console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Storage retrieval failed, trying different source`);
                            }
                            this.stateData.targetWood = null;
                        }
                    }
                } else {
                    // Target is in world - move towards wood
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Moving towards wood at (${Math.round(this.stateData.targetWood.position.x)}, ${Math.round(this.stateData.targetWood.position.y)})`);
                    }
                    this.villager.moveTowards(this.stateData.targetWood.position, deltaTime);

                    // Check if close enough to collect
                    if (GameUtils.isWithinInteractionDistance(this.villager.position, this.stateData.targetWood.position)) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Close enough to collect wood`);
                        }
                        if (this.collectResource(this.stateData.targetWood)) {
                            if (window.summaryLoggingEnabled) {
                                console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Wood collected successfully`);
                            }
                            // Clear target so we find a new source
                            this.stateData.targetWood = null;
                        } else {
                            // Collection failed - clear targetWood so we try a different source next time
                            if (window.summaryLoggingEnabled) {
                                console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Collection failed, trying different source`);
                            }
                            this.stateData.targetWood = null;
                        }
                    }
                }
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Re-finding targets`);
                }
                // Re-find targets
                this.stateData.ownFire = this.findOwnFireplace();
                this.stateData.targetWood = this.findNearestWood(entities, storageBoxes, isEmergency);

                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: After re-finding - ownFire: ${this.stateData.ownFire ? 'found' : 'null'}, targetWood: ${this.stateData.targetWood ? 'found' : 'null'}`);
                }

                // If no wood found, log it
                if (!this.stateData.targetWood && window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: No wood found in storage or world`);
                }
            }
        }

        executeEat(isEmergency, deltaTime, entities, storageBoxes) {
            // --- PERSISTENT STORAGE INTENT ---
            if (!this.stateData) this.stateData = {};
            const stateName = isEmergency ? 'EMERGENCY_EAT' : 'REGULAR_EAT';

            // If we're in the middle of a storage task, finish it before doing anything else
            if (this.stateData.currentTask === 'store') {
                const storeSuccess = this.storeItemsInIdle(deltaTime);
                if (storeSuccess) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: STORAGE TASK COMPLETE, clearing currentTask`);
                    }
                    this.stateData.currentTask = null;
                } else {
                    // Still moving to storage or storing, do nothing else
                    return;
                }
            }
            // If we have items to store, start storage task
            if (this.hasItemsToStore()) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Has items to store, starting storage task`);
                }
                this.stateData.currentTask = 'store';
                const storeSuccess = this.storeItemsInIdle(deltaTime);
                if (!storeSuccess) {
                    return; // Still moving to storage
                }
                // Storage complete, clear task
                this.stateData.currentTask = null;
            }

            // First try to eat from inventory
            if (this.eatFood()) {
                return;
            }

            // If we have food but can't eat (not near fire), move to fire
            if (this.hasFoodInInventory()) {
                const targetFire = this.findNearestBurningFire();
                if (targetFire) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Has food but not near fire, moving to fire at (${Math.round(targetFire.position.x)}, ${Math.round(targetFire.position.y)})`);
                    }
                    this.villager.moveTowards(targetFire.position, deltaTime);
                    return;
                } else {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Has food but no fire found`);
                    }
                }
            }

            // Then try to retrieve food from storage
            if (this.retrieveFromStorage(storageBoxes)) {
                // After retrieving food, try to eat it immediately
                if (this.eatFood()) {
                    return;
                }
            }

            // Finally, try to find and collect food
            // Check if we have a current target food and if it's still available
            if (this.stateData.targetFood) {
                // Check if target has been collected by someone else
                if (this.stateData.targetFood.collected) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Target food ${this.stateData.targetFood.type} was collected by someone else, finding new target`);
                    }
                    this.stateData.targetFood = null;
                }
            }

            // Find new target food if we don't have one
            if (!this.stateData.targetFood) {
                this.stateData.targetFood = this.findNearestFood(entities, storageBoxes, isEmergency);
                if (this.stateData.targetFood && window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: New target food ${this.stateData.targetFood.type} at (${Math.round(this.stateData.targetFood.position.x)}, ${Math.round(this.stateData.targetFood.position.y)})`);
                }
            }

            // Move toward target food if we have one
            if (this.stateData.targetFood) {
                this.villager.moveTowards(this.stateData.targetFood.position, deltaTime);
                if (GameUtils.isWithinInteractionDistance(this.villager.position, this.stateData.targetFood.position)) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Collecting ${this.stateData.targetFood.type}`);
                    }
                    const success = this.collectResource(this.stateData.targetFood);
                    if (success) {
                        // Clear target after successful collection
                        this.stateData.targetFood = null;
                    } else {
                        // Clear target so we find a new one next time
                        this.stateData.targetFood = null;
                    }
                }
            }
        }

        executeDrink(deltaTime, entities) {
            if (this.stateData.targetWell) {
                // Move towards well
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} DRINK: Moving to well at (${Math.round(this.stateData.targetWell.position.x)}, ${Math.round(this.stateData.targetWell.position.y)})`);
                }
                this.villager.moveTowards(this.stateData.targetWell.position, deltaTime);

                // Check if close enough to drink
                if (GameUtils.isWithinInteractionDistance(this.villager.position, this.stateData.targetWell.position)) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} DRINK: Drinking from well`);
                    }
                    this.drinkFromWell(this.stateData.targetWell);
                    this.stateData.targetWell = null;
                }
            } else {
                // No well found, try to find one
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} DRINK: No well found, searching...`);
                }
                this.stateData.targetWell = this.findNearestWell();
            }
        }

        executeWarmUp(deltaTime, entities) {
            if (this.stateData.targetFire) {
                // Move towards fire
                this.villager.moveTowards(this.stateData.targetFire.position, deltaTime);
            } else {
                // No fire found, try to find one
                this.stateData.targetFire = this.findNearestBurningFire();
            }
        }

        shouldRefillFire(isEmergency, entities) {
            const ownFire = this.findOwnFireplace();
            const threshold = isEmergency ? GameConfig.villager.fireThresholds.emergency : GameConfig.villager.fireThresholds.regular;
            const stateName = isEmergency ? 'EMERGENCY_FIRE_REFILL' : 'REGULAR_FIRE_REFILL';

            // If we're currently in FIRE_REFILL state, stay in it until task is complete
            if (this.currentState === (isEmergency ? VILLAGER_STATES.EMERGENCY_FIRE_REFILL : VILLAGER_STATES.REGULAR_FIRE_REFILL)) {
                // Only leave if fire is now above threshold OR we have no target wood (task failed)
                const fireIsAboveThreshold = ownFire && ownFire.wood >= threshold;
                const hasNoTarget = !this.stateData.targetWood;

                if (fireIsAboveThreshold) {
                    const fireWood = ownFire ? ownFire.wood : 'no fire';
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Fire now above threshold (${fireWood} logs), completing task`);
                    }
                    return false; // Task complete, can leave state
                } else if (hasNoTarget) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: No target wood, task failed`);
                    }
                    return false; // Task failed, can leave state
                } else {
                    const fireWood = ownFire ? ownFire.wood : 'no fire';
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} ${stateName}: Staying in state, fire has ${fireWood} logs, target wood: ${this.stateData.targetWood ? 'found' : 'not found'}`);
                    }
                    return true; // Stay in state to complete task
                }
            }

            // If not currently in FIRE_REFILL, only enter if fire needs refilling
            return ownFire && ownFire.wood < threshold;
        }

        // === IDLE STATE ===
        enterIdle() {
            // Find nearest fire to stay near
            this.stateData.targetFire = this.findNearestBurningFire();
            if (window.summaryLoggingEnabled) {
                if (this.stateData.targetFire) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ENTER_IDLE: Found fire at (${Math.round(this.stateData.targetFire.position.x)}, ${Math.round(this.stateData.targetFire.position.y)})`);
                } else {
                    console.log(`[VillagerStateMachine] ${this.villager.name} ENTER_IDLE: No fire found, will stay at camp`);
                }
            }
        }

        executeIdle(deltaTime, entities, storageBoxes) {
            // Passive IDLE state - just stay near fire
            if (this.stateData.targetFire) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} IDLE: Staying near fire at (${Math.round(this.stateData.targetFire.position.x)}, ${Math.round(this.stateData.targetFire.position.y)})`);
                }
                this.villager.moveTowards(this.stateData.targetFire.position, deltaTime);
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} IDLE: No fire found, staying at camp`);
                }
                this.villager.moveTowards(this.villager.campPosition, deltaTime);
            }
        }



        // Helper method to find nearest uncollected resource
        findNearestResource(entities) {
            return GameUtils.findNearestEntity(entities, this.villager.position, entity =>
                (GameUtils.isFood(entity.type) || entity.type === GameConfig.entityTypes.tree) && !entity.collected
            );
        }

        // Helper method to find nearest uncollected resource of a specific type
        findNearestResourceOfType(entities, resourceType) {
            return GameUtils.findNearestEntity(entities, this.villager.position, entity =>
                entity.type === resourceType && !entity.collected
            );
        }

        // === UTILITY METHODS ===
        getCurrentTime(gameTime) {
            // Use the global getCurrentTime function for consistency
            // Create a temporary playerState-like object with currentTime
            const tempPlayerState = { currentTime: gameTime };
            return getCurrentTime(tempPlayerState);
        }

        getStateName(state) {
            const stateNames = {
                [VILLAGER_STATES.SLEEP]: 'SLEEP',
                [VILLAGER_STATES.EMERGENCY_DRINK]: 'EMERGENCY_DRINK',
                [VILLAGER_STATES.EMERGENCY_EAT]: 'EMERGENCY_EAT',
                [VILLAGER_STATES.EMERGENCY_WARM_UP]: 'EMERGENCY_WARM_UP',
                [VILLAGER_STATES.EMERGENCY_FIRE_REFILL]: 'EMERGENCY_FIRE_REFILL',
                [VILLAGER_STATES.REGULAR_DRINK]: 'REGULAR_DRINK',
                [VILLAGER_STATES.REGULAR_WARM_UP]: 'REGULAR_WARM_UP',
                [VILLAGER_STATES.REGULAR_EAT]: 'REGULAR_EAT',
                [VILLAGER_STATES.REGULAR_FIRE_REFILL]: 'REGULAR_FIRE_REFILL',
                [VILLAGER_STATES.FORAGE]: 'FORAGE',
                [VILLAGER_STATES.IDLE]: 'IDLE'
            };
            return stateNames[state] || 'UNKNOWN';
        }

        // === ENTITY FINDING METHODS ===
        findCampSleepingBag() {
            // Use direct reference assigned during villager creation
            return this.villager.sleepingBag || null;
        }

        findNearestWell() {
            if (!this.villager.gameEntities) return null;
            return GameUtils.findNearestEntity(this.villager.gameEntities, this.villager.position, entity =>
                entity.type === GameConfig.entityTypes.well && entity.waterLevel >= 1
            );
        }

        findOwnFireplace() {
            // Use direct reference assigned during villager creation
            return this.villager.fireplace || null;
        }

        findNearestBurningFire() {
            if (!this.villager.gameEntities) return null;

            // Search entire world for burning fires - no range limit
            return GameUtils.findNearestEntity(this.villager.gameEntities, this.villager.position, entity => {
                return entity.type === GameConfig.entityTypes.fireplace && entity.isBurning && entity.wood > 0;
            });
        }





        findOwnStorageBox() {
            // Use direct reference assigned during villager creation
            return this.villager.personalStorageBox || null;
        }

        findCommunalStorageBox() {
            // Use direct reference assigned during villager creation
            return this.villager.communalStorageBox || null;
        }

        // === UTILITY METHODS ===
        isAtCamp() {
            return GameUtils.distance(this.villager.position, this.villager.campPosition) <= GameConfig.technical.distances.campRadius;
        }

        hasWoodInInventory() {
            return this.villager.inventory.some(item => item && item.type === GameConfig.entityTypes.tree);
        }

        hasFoodInInventory() {
            return this.villager.inventory.some(item => item && GameUtils.isFood(item.type));
        }

        hasItemsToStore() {
            // Simple threshold: store items when inventory is >80% full
            const inventoryCount = this.villager.inventory.filter(i => i !== null).length;
            const maxItems = GameConfig.player.inventorySize;
            const threshold = Math.floor(maxItems * 0.8); // 80% threshold

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} HAS_ITEMS_TO_STORE: Inventory ${inventoryCount}/${maxItems}, threshold ${threshold}`);
            }

            return inventoryCount > threshold;
        }

        // isItemNeeded method removed - using simple inventory thresholds instead

        // isFood and distance now use GameUtils methods

        // === ACTION METHODS ===

        // Helper method to log nearby objects and villager stats
        logNearbyObjects() {
            const nearbyObjects = [];
            const maxDistance = 200; // Log objects within 200 pixels

            // Find nearby entities
            for (const entity of this.villager.gameEntities || []) {
                const dist = GameUtils.distance(this.villager.position, entity.position);
                if (dist <= maxDistance) {
                    nearbyObjects.push({
                        type: entity.type,
                        emoji: entity.emoji,
                        distance: Math.round(dist),
                        position: `(${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})`
                    });
                }
            }

            // Sort by distance and take top 3
            nearbyObjects.sort((a, b) => a.distance - b.distance);
            const top3 = nearbyObjects.slice(0, 3);

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} STATS: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                console.log(`[Villager] ${this.villager.name} POSITION: (${Math.round(this.villager.position.x)}, ${Math.round(this.villager.position.y)})`);
                console.log(`[Villager] ${this.villager.name} NEARBY: ${top3.map(obj => `${obj.type}${obj.emoji}@${obj.distance}px`).join(', ')}`);
            }
        }

        drinkFromWell(well) {
            if (well && well.waterLevel >= 1) {
                const oldWater = this.villager.needs.water;
                this.villager.needs.water = Math.min(GameConfig.needs.fullValue, this.villager.needs.water + GameConfig.wells.drinkingAmount);
                well.waterLevel = Math.max(0, well.waterLevel - GameConfig.wells.drinkingAmount);

                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} DRINK SUCCESS: Water ${oldWater.toFixed(1)} → ${this.villager.needs.water.toFixed(1)}`);
                    console.log(`[Villager] ${this.villager.name} Well water remaining: ${well.waterLevel}`);
                    this.logNearbyObjects();
                }
                return true;
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} DRINK FAILED: Well has insufficient water (${well ? well.waterLevel : 'no well'}) or doesn't exist`);
                    this.logNearbyObjects();
                }
                return false;
            }
        }

        eatFood() {
            // Check if we're near a fireplace (required for eating)
            const nearbyFire = this.findNearestBurningFire();
            if (!nearbyFire) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} EAT_FOOD_FAILED: Not near a fireplace`);
                    this.logNearbyObjects();
                }
                return false;
            }

            // Look for food in inventory
            for (let i = 0; i < this.villager.inventory.length; i++) {
                const item = this.villager.inventory[i];
                if (item && GameUtils.isFood(item.type)) {
                    const oldCalories = this.villager.needs.calories;
                    const oldWater = this.villager.needs.water;
                    GameUtils.applyNutrition(this.villager, item.type);
                    this.villager.inventory[i] = null;

                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.villager.name} EAT_FOOD_SUCCESS: Ate ${item.type}${item.emoji} from inventory slot ${i} near fireplace`);
                        console.log(`[Villager] ${this.villager.name} Nutrition: Calories ${oldCalories.toFixed(1)} → ${this.villager.needs.calories.toFixed(1)}, Water ${oldWater.toFixed(1)} → ${this.villager.needs.water.toFixed(1)}`);
                        this.logNearbyObjects();
                    }
                    return true;
                }
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} EAT_FOOD_FAILED: No food in inventory`);
                this.logNearbyObjects();
            }
            return false;
        }

        retrieveFromStorage(storageBoxes) {
            // Check if inventory has space
            const emptySlot = this.villager.inventory.findIndex(i => i === null);
            if (emptySlot === -1) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} RETRIEVE_FAILED: Inventory full`);
                    this.logNearbyObjects();
                }
                return false;
            }

            // Check nearby storage boxes for items to retrieve
            for (const storageBox of storageBoxes) {
                if (GameUtils.isWithinInteractionDistance(this.villager.position, storageBox.position)) {
                    for (let i = 0; i < storageBox.items.length; i++) {
                        const item = storageBox.items[i];
                        if (item) {
                            // Retrieve any item if we have space
                            this.villager.inventory[emptySlot] = item;
                            storageBox.items[i] = null;

                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.villager.name} RETRIEVE_SUCCESS: Retrieved ${item.type}${item.emoji} from storage to inventory slot ${emptySlot}`);
                                this.logNearbyObjects();
                            }
                            return true;
                        }
                    }
                }
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} RETRIEVE_FAILED: No items in nearby storage`);
                this.logNearbyObjects();
            }
            return false;
        }

        // General function to retrieve items from storage
        retrieveFromStorage(storageBoxes, itemType = null) {
            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} RETRIEVE_ATTEMPT: Looking for ${itemType ? itemType : 'any item'} in storage`);
            }

            // Check if inventory has space
            const emptySlot = this.villager.inventory.findIndex(i => i === null);
            if (emptySlot === -1) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} RETRIEVE_FAILED: Inventory full`);
                    this.logNearbyObjects();
                }
                return false;
            }

            for (const storageBox of storageBoxes) {
                if (GameUtils.isWithinInteractionDistance(this.villager.position, storageBox.position)) {
                    for (let i = 0; i < storageBox.items.length; i++) {
                        const item = storageBox.items[i];
                        if (item && (itemType === null || item.type === itemType)) {
                            // Retrieve any matching item if we have space
                            this.villager.inventory[emptySlot] = item;
                            storageBox.items[i] = null;

                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.villager.name} RETRIEVE_SUCCESS: Retrieved ${item.type}${item.emoji} from storage slot ${i} to inventory slot ${emptySlot}`);
                                this.logNearbyObjects();
                            }
                            return true;
                        }
                    }
                }
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} RETRIEVE_FAILED: No suitable items found in nearby storage`);
                this.logNearbyObjects();
            }
            return false;
        }

        // applyNutrition now uses GameUtils.applyNutrition

        collectResource(entity) {
            // Safety check: prevent collecting already collected resources
            if (entity.collected) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} COLLECT FAILED: Resource ${entity.type}${entity.emoji} already collected`);
                    this.logNearbyObjects();
                }
                return false;
            }

            // Check if we can carry it
            const slot = this.villager.inventory.findIndex(i => i === null);
            if (slot === -1) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} COLLECT FAILED: Inventory full`);
                    this.logNearbyObjects();
                }
                return false; // Inventory full
            }

            // Collect any resource if we have space (no complex "needed" logic)

            // Success chance (80% for villagers)
            if (Math.random() < 0.8) {
                // Mark as collected BEFORE adding to inventory to prevent race conditions
                entity.collected = true;
                entity.collectedAt = this.villager.currentGameTime || 0;

                // Add to inventory
                this.villager.inventory[slot] = { type: entity.type, emoji: entity.emoji };

                // Hide the visual
                if (entity._phaserText) entity._phaserText.setVisible(false);

                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} COLLECT SUCCESS: Collected ${entity.type}${entity.emoji} in slot ${slot}`);
                    this.logNearbyObjects();
                }
                return true;
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} COLLECT FAILED: Failed collection roll for ${entity.type}${entity.emoji}`);
                this.logNearbyObjects();
            }
            return false;
        }

        addWoodToFire(fire) {
            // Find wood in inventory
            for (let i = 0; i < this.villager.inventory.length; i++) {
                const item = this.villager.inventory[i];
                if (item && item.type === GameConfig.entityTypes.tree) {
                    const oldWood = fire.wood;
                    fire.wood = Math.min(GameConfig.fires.maxWood, fire.wood + 1);
                    this.villager.inventory[i] = null;

                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.villager.name} ADD_WOOD SUCCESS: Fire wood ${oldWood} → ${fire.wood}`);
                        this.logNearbyObjects();
                    }
                    return true;
                }
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} ADD_WOOD FAILED: No wood in inventory`);
                this.logNearbyObjects();
            }
            return false;
        }

        storeItemsInStorage(storageBox) {
            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} STORE_ATTEMPT: Checking inventory for items to store`);
            }

            // Store any item if inventory is getting full
            for (let i = 0; i < this.villager.inventory.length; i++) {
                const item = this.villager.inventory[i];
                if (item) {
                    // Find empty slot in storage
                    const storageSlot = GameUtils.findEmptySlot(storageBox.items);
                    if (storageSlot !== -1) {
                        storageBox.items[storageSlot] = item;
                        this.villager.inventory[i] = null;

                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.villager.name} STORE SUCCESS: Stored ${item.type}${item.emoji} in storage slot ${storageSlot}`);
                            this.logNearbyObjects();
                        }
                        return true;
                    } else {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.villager.name} STORE FAILED: Storage box full`);
                            this.logNearbyObjects();
                        }
                        return false;
                    }
                }
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} STORE FAILED: No items to store`);
                this.logNearbyObjects();
            }
            return false;
        }

        // Store ALL items when inventory threshold is reached
        storeAllItemsInStorage(storageBox) {
            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} STORE_ALL_ATTEMPT: Storing all items when threshold reached`);
            }

            let itemsStored = 0;
            let storageFull = false;

            // Store all items when inventory is getting full
            for (let i = 0; i < this.villager.inventory.length; i++) {
                const item = this.villager.inventory[i];
                if (item) {
                    // Find empty slot in storage
                    const storageSlot = GameUtils.findEmptySlot(storageBox.items);
                    if (storageSlot !== -1) {
                        storageBox.items[storageSlot] = item;
                        this.villager.inventory[i] = null;
                        itemsStored++;

                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.villager.name} STORE_ALL_SUCCESS: Stored ${item.type}${item.emoji} in storage slot ${storageSlot} (${itemsStored} total)`);
                        }
                    } else {
                        storageFull = true;
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.villager.name} STORE_ALL_STOPPED: Storage box full after storing ${itemsStored} items`);
                        }
                        break; // Storage is full, stop storing
                    }
                }
            }

            if (itemsStored > 0) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} STORE_ALL_COMPLETE: Stored ${itemsStored} items total`);
                    this.logNearbyObjects();
                }
                return itemsStored;
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} STORE_ALL_FAILED: No items to store`);
                    this.logNearbyObjects();
                }
                return 0;
            }
        }

        // Missing method that was being called but not implemented
        storeItemsInIdle(deltaTime) {
            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} STORE_ITEMS_IN_IDLE: Attempting to store items during idle`);
            }

            // Check if we have items to store
            if (!this.hasItemsToStore()) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.villager.name} STORE_ITEMS_IN_IDLE: No items to store`);
                }
                return true; // No items to store, consider it successful
            }

            // Try personal storage first
            const personalStorage = this.findOwnStorageBox();
            if (personalStorage) {
                const distanceToStorage = GameUtils.distance(this.villager.position, personalStorage.position);

                if (distanceToStorage <= GameConfig.player.interactionThreshold) {
                    // At storage, try to store items
                    const itemsStored = this.storeItemsInStorage(personalStorage);
                    if (itemsStored) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.villager.name} STORE_ITEMS_IN_IDLE: Stored items in personal storage`);
                        }
                        return true;
                    }
                } else {
                    // Move towards personal storage
                    this.villager.moveTowards(personalStorage.position, deltaTime);
                    return false; // Still moving
                }
            }

            // Try communal storage if personal is full or unavailable
            const communalStorage = this.findCommunalStorageBox();
            if (communalStorage) {
                const distanceToStorage = GameUtils.distance(this.villager.position, communalStorage.position);

                if (distanceToStorage <= GameConfig.player.interactionThreshold) {
                    // At storage, try to store items
                    const itemsStored = this.storeItemsInStorage(communalStorage);
                    if (itemsStored) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.villager.name} STORE_ITEMS_IN_IDLE: Stored items in communal storage`);
                        }
                        return true;
                    }
                } else {
                    // Move towards communal storage
                    this.villager.moveTowards(communalStorage.position, deltaTime);
                    return false; // Still moving
                }
            }

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.villager.name} STORE_ITEMS_IN_IDLE: No storage available`);
            }
            return false; // No storage available
        }

        // Generic method to find nearest resource source (storage or world)
        findNearestResourceSource(entities, storageBoxes, resourceType, isEmergency = false) {
            let nearestSource = null;
            let nearestDistance = Infinity;
            let sourceType = null; // 'storage' or 'world'

            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 1% chance per frame when spam enabled
                console.log(`[VillagerStateMachine] ${this.villager.name} FIND_RESOURCE: Looking for ${resourceType} (emergency: ${isEmergency})`);
            }

            // Check storage boxes first
            const storageBoxesToCheck = isEmergency ?
                [this.villager.personalStorageBox, this.villager.communalStorageBox, ...storageBoxes.filter(box => box !== this.villager.personalStorageBox && box !== this.villager.communalStorageBox)] :
                [this.villager.personalStorageBox, this.villager.communalStorageBox];

            for (const storageBox of storageBoxesToCheck) {
                if (!storageBox) continue;

                // Check if this storage box has the resource we need
                for (let i = 0; i < storageBox.items.length; i++) {
                    const item = storageBox.items[i];
                    if (item && item.type === resourceType) {
                        const dist = GameUtils.distance(this.villager.position, storageBox.position);
                        if (window.summaryLoggingEnabled) {
                            console.log(`[VillagerStateMachine] ${this.villager.name} FIND_RESOURCE: Found ${resourceType} in storage at distance ${Math.round(dist)}px`);
                        }

                        if (dist < nearestDistance) {
                            nearestSource = { storageBox, slot: i, item };
                            nearestDistance = dist;
                            sourceType = 'storage';
                        }
                    }
                }
            }

            // Check world entities
            for (const entity of entities) {
                if (entity.type === resourceType && !entity.collected) {
                    const dist = GameUtils.distance(this.villager.position, entity.position);
                    if (window.summaryLoggingEnabled) {
                        console.log(`[VillagerStateMachine] ${this.villager.name} FIND_RESOURCE: Found ${resourceType} in world at distance ${Math.round(dist)}px`);
                    }

                    if (dist < nearestDistance) {
                        nearestSource = entity;
                        nearestDistance = dist;
                        sourceType = 'world';
                    }
                }
            }

            if (nearestSource) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} FIND_RESOURCE: Selected ${sourceType} source at ${Math.round(nearestDistance)}px`);
                }
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[VillagerStateMachine] ${this.villager.name} FIND_RESOURCE: No ${resourceType} found in storage or world`);
                }
            }

            return { source: nearestSource, distance: nearestDistance, type: sourceType };
        }

        // Specialized method for finding nearest wood (uses the generic method)
        findNearestWood(entities, storageBoxes, isEmergency = false) {
            const result = this.findNearestResourceSource(entities, storageBoxes, GameConfig.entityTypes.tree, isEmergency);
            return result.source;
        }

        // Specialized method for finding nearest food (uses the generic method)
        findNearestFood(entities, storageBoxes, isEmergency = false) {
            const result = this.findNearestResourceSource(entities, storageBoxes, 'food', isEmergency);
            return result.source;
        }
    }


    function generateVillagerName() {
        return GameConfig.villager.villagerNames[Math.floor(Math.random() * GameConfig.villager.villagerNames.length)];
    }
    // === END: Villager AI System ===

    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
            this.lastPropagationDay = -1; // Track last propagation day to prevent duplicates
            this._gameOverOverlay = null; // Initialize game over overlay reference
        }
        preload() { }
        create() {
            // Keep world size large for exploration (10x viewport as configured)
            // Don't override the large world dimensions from GameConfig
            assert(GameConfig.world.width >= window.innerWidth * 10, 'World width should be at least 10x viewport width');
            assert(GameConfig.world.height >= window.innerHeight * 10, 'World height should be at least 10x viewport height');

            // --- World/entities ---
            this.entities = [];
            const currentSeed = getCurrentSeed();
            console.log(`[World Generation] Using seed: ${currentSeed}`);
            this.noise = new PerlinNoise(currentSeed);
            this.seededRandom = new SeededRandom(currentSeed);

            // Create ground texture for better navigation (after noise is initialized)
            this.createGroundTexture();

            const cfg = GameConfig.world;
            const centerX = cfg.width / 2;
            const centerY = cfg.height / 2;
            // --- Village center (no visual, just reference point) ---
            const villageCenter = { position: { x: centerX, y: centerY }, type: 'village_center' };
            // --- Village well ---
            const villageWell = {
                position: { x: centerX + cfg.villageWellOffset.x, y: centerY + cfg.villageWellOffset.y },
                type: GameConfig.entityTypes.well, emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel
            };
            this.entities.push(villageWell);
            // --- Communal storage ---
            const communalStorage = {
                position: { x: centerX - cfg.villageCenterOffset.x, y: centerY + cfg.villageCenterOffset.y },
                type: GameConfig.entityTypes.storage_box, emoji: '📦', capacity: GameConfig.storage.communalCapacity, items: new Array(GameConfig.storage.communalCapacity).fill(null)
            };
            this.entities.push(communalStorage);
            // --- Camps and facilities (organic placement, not perfect circle) ---
            this.camps = [];
            for (let i = 0; i < cfg.villagerCount; i++) {
                // Create more organic placement with some randomness
                const baseAngle = (i / cfg.villagerCount) * 2 * Math.PI;
                const angleVariation = (this.seededRandom.random() - 0.5) * 0.5; // ±0.25 radians variation
                const radiusVariation = (this.seededRandom.random() - 0.5) * 50; // ±25 pixels radius variation
                const angle = baseAngle + angleVariation;
                const radius = cfg.campRadius + radiusVariation;

                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                const camp = { position: { x, y }, type: 'camp', villagerId: i };
                this.camps.push(camp);
                // Don't add camp to entities since we don't want to render it

                // Fireplace
                const initialWood = this.seededRandom.randomRange(GameConfig.fires.initialWoodRange.min, GameConfig.fires.initialWoodRange.max);
                this.entities.push({ position: { x: x + cfg.campSpacing.x, y: y }, type: GameConfig.entityTypes.fireplace, emoji: GameConfig.emojis.fireplace, isBurning: true, wood: initialWood, maxWood: GameConfig.fires.maxWood, villagerId: i });
                // Sleeping bag
                this.entities.push({ position: { x: x - cfg.campSpacing.x, y: y }, type: GameConfig.entityTypes.sleeping_bag, emoji: '🛏️', isOccupied: false, villagerId: i });
                // Personal storage
                this.entities.push({ position: { x: x, y: y + cfg.campSpacing.y }, type: GameConfig.entityTypes.storage_box, emoji: '📦', capacity: GameConfig.storage.personalCapacity, items: new Array(GameConfig.storage.personalCapacity).fill(null), isPersonal: true, villagerId: i });
            }
            // --- Player start position (center of camp 0) ---
            const playerCamp = this.camps[0];
            this.playerStartPosition = {
                x: playerCamp.position.x,
                y: playerCamp.position.y
            };

            // === ADD RANDOM INITIAL ITEMS TO STORAGE BOXES ===
            // Add random items to communal storage
            const initialCommunalStorageBox = this.entities.find(e => e.type === GameConfig.entityTypes.storage_box && !e.isPersonal);
            assert(initialCommunalStorageBox, 'Communal storage box not found during initialization');

            // Add random wood and food to communal storage based on config
            const communalWoodCount = 6;//this.seededRandom.randomInt(GameConfig.storage.initialItems.wood.min, GameConfig.storage.initialItems.wood.max);
            const communalFoodCount = this.seededRandom.randomInt(GameConfig.storage.initialItems.food.min, GameConfig.storage.initialItems.food.max);

            // Add wood to communal storage
            for (let i = 0; i < communalWoodCount; i++) {
                const emptySlot = GameUtils.findEmptySlot(initialCommunalStorageBox.items);
                if (emptySlot !== -1) {
                    initialCommunalStorageBox.items[emptySlot] = { type: GameConfig.entityTypes.tree, emoji: GameConfig.emojis.tree };
                }
            }

            // Add random food items to communal storage
            for (let i = 0; i < communalFoodCount; i++) {
                const emptySlot = GameUtils.findEmptySlot(initialCommunalStorageBox.items);
                if (emptySlot !== -1) {
                    const foodType = GameUtils.ALL_FOOD_TYPES[this.seededRandom.randomInt(0, GameUtils.ALL_FOOD_TYPES.length - 1)];
                    const foodData = GameConfig.resources.foodData[foodType];
                    initialCommunalStorageBox.items[emptySlot] = { type: foodType, emoji: foodData.emoji };
                }
            }

            console.log(`[Storage] Added ${communalWoodCount} wood and ${communalFoodCount} food to communal storage`);

            // Add random items to personal storage boxes
            for (let i = 1; i < cfg.villagerCount; i++) { // Skip camp 0 (player)
                const personalStorageBox = this.entities.find(e =>
                    e.type === GameConfig.entityTypes.storage_box &&
                    e.isPersonal &&
                    e.villagerId === i - 1
                );
                assert(personalStorageBox, `Personal storage box not found for villager ${i - 1}`);

                // Add random wood and food to personal storage based on config
                const personalWoodCount = this.seededRandom.randomInt(GameConfig.storage.initialItems.wood.min, GameConfig.storage.initialItems.wood.max);
                const personalFoodCount = this.seededRandom.randomInt(GameConfig.storage.initialItems.food.min, GameConfig.storage.initialItems.food.max);

                // Add wood to personal storage
                for (let j = 0; j < personalWoodCount; j++) {
                    const emptySlot = GameUtils.findEmptySlot(personalStorageBox.items);
                    if (emptySlot !== -1) {
                        personalStorageBox.items[emptySlot] = { type: GameConfig.entityTypes.tree, emoji: GameConfig.emojis.tree };
                    }
                }

                // Add random food items to personal storage
                for (let j = 0; j < personalFoodCount; j++) {
                    const emptySlot = GameUtils.findEmptySlot(personalStorageBox.items);
                    if (emptySlot !== -1) {
                        const foodType = GameUtils.ALL_FOOD_TYPES[this.seededRandom.randomInt(0, GameUtils.ALL_FOOD_TYPES.length - 1)];
                        const foodData = GameConfig.resources.foodData[foodType];
                        personalStorageBox.items[emptySlot] = { type: foodType, emoji: foodData.emoji };
                    }
                }

                console.log(`[Storage] Added ${personalWoodCount} wood and ${personalFoodCount} food to personal storage for villager ${i - 1}`);
            }

            // --- Create villagers (skip camp 0 since player takes that role) ---
            this.villagers = [];
            this.villagerVisuals = [];

            // Find communal storage box for all villagers to share
            const communalStorageBox = this.entities.find(e => e.type === GameConfig.entityTypes.storage_box && !e.isPersonal);
            assert(communalStorageBox, 'Communal storage box not found during villager creation');

            for (let i = 1; i < cfg.villagerCount; i++) { // Start from 1, skip camp 0
                const camp = this.camps[i];
                const villagerName = generateVillagerName();

                // Spawn villager randomly within config radius of village center
                const villageCenter = { x: centerX, y: centerY };
                const spawnRadius = GameConfig.world.villagerSpawnRadius;
                const spawnAngle = this.seededRandom.random() * 2 * Math.PI;
                const spawnDistance = this.seededRandom.random() * spawnRadius;

                const villagerSpawnPosition = {
                    x: villageCenter.x + Math.cos(spawnAngle) * spawnDistance,
                    y: villageCenter.y + Math.sin(spawnAngle) * spawnDistance
                };

                const villager = new Villager(villagerName, villagerSpawnPosition, i - 1, this.seededRandom); // Use camp index for villagerId and pass seeded random

                // Find this villager's personal storage box
                const personalStorageBox = this.entities.find(e =>
                    e.type === GameConfig.entityTypes.storage_box &&
                    e.isPersonal &&
                    e.villagerId === i - 1
                );
                assert(personalStorageBox, `Personal storage box not found for villager ${villagerName} (villagerId: ${i - 1})`);

                // Find this villager's fireplace
                const fireplace = this.entities.find(e =>
                    e.type === GameConfig.entityTypes.fireplace &&
                    e.villagerId === i - 1
                );
                assert(fireplace, `Fireplace not found for villager ${villagerName} (villagerId: ${i - 1})`);

                // Find this villager's sleeping bag
                const sleepingBag = this.entities.find(e =>
                    e.type === GameConfig.entityTypes.sleeping_bag &&
                    e.villagerId === i - 1
                );
                assert(sleepingBag, `Sleeping bag not found for villager ${villagerName} (villagerId: ${i - 1})`);

                // Assign facilities directly to villager for robust access
                villager.personalStorageBox = personalStorageBox;
                villager.communalStorageBox = communalStorageBox;
                villager.fireplace = fireplace;
                villager.sleepingBag = sleepingBag;

                // Set initial state based on game start time
                const startHour = GameConfig.time.gameStartHour;
                if (startHour >= GameConfig.villager.sleepSchedule && startHour < GameConfig.villager.sleepSchedule.startHour) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[MainScene] Villager ${villagerName} starting in FORAGING state (daytime)`);
                    }
                }

                // Create visual representation
                const visuals = villager.createVisuals(this);
                this.villagerVisuals.push(visuals);

                this.villagers.push(villager);
                if (window.summaryLoggingEnabled) {
                    console.log(`[MainScene] Created villager ${villagerName} at camp ${i} (spawned randomly at ${Math.round(villagerSpawnPosition.x)}, ${Math.round(villagerSpawnPosition.y)})`);
                    console.log(`[MainScene] Assigned facilities to ${villagerName}: personal storage at (${Math.round(personalStorageBox.position.x)}, ${Math.round(personalStorageBox.position.y)}), communal storage at (${Math.round(communalStorageBox.position.x)}, ${Math.round(communalStorageBox.position.y)})`);
                }
            }
            // --- Additional wells ---
            this.wells = [villageWell];
            for (let i = 0; i < cfg.wellCount; i++) {
                let attempts = 0, pos;
                do {
                    pos = { x: this.seededRandom.randomRange(0, cfg.width), y: this.seededRandom.randomRange(0, cfg.height) };
                    attempts++;
                } while (this.isTooCloseToExistingWell(pos) && attempts < cfg.wellMaxAttempts);
                if (attempts < cfg.wellMaxAttempts) {
                    const well = { position: pos, type: GameConfig.entityTypes.well, emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel };
                    this.entities.push(well);
                    this.wells.push(well);
                }
            }
            // --- Resources (Small clusters of same type, spreading from village) ---
            const resourceTypes = GameUtils.ALL_FOOD_TYPES;
            const totalResources = (cfg.villagerCount + 1) * cfg.resourcesPerVillager;
            console.log(`[World Generation] Generating ${totalResources} resources in clusters for ${cfg.villagerCount} villagers + 1 player`);

            // Calculate cluster parameters
            const clusterSize = 2 + this.seededRandom.randomInt(0, 2); // 2-4 resources per cluster
            const clusterCount = Math.ceil(totalResources / clusterSize);

            // Create clusters starting near village and spreading outward
            const maxDistance = Math.min(cfg.width, cfg.height) / 2; // Maximum distance from village center

            let resourcesGenerated = 0;

            for (let clusterIndex = 0; clusterIndex < clusterCount && resourcesGenerated < totalResources; clusterIndex++) {
                // Calculate distance from village (closer clusters first)
                const distanceFromVillage = (clusterIndex / clusterCount) * maxDistance;

                // Add some randomness to distance
                const distanceVariation = (this.seededRandom.random() - 0.5) * 200;
                const actualDistance = Math.max(GameConfig.technical.distances.explorationTarget, distanceFromVillage + distanceVariation);

                // Generate cluster center position
                let clusterCenter;
                let attempts = 0;
                do {
                    const angle = this.seededRandom.random() * 2 * Math.PI;
                    clusterCenter = {
                        x: centerX + Math.cos(angle) * actualDistance,
                        y: centerY + Math.sin(angle) * actualDistance
                    };

                    // Ensure within world bounds
                    clusterCenter.x = Math.max(0, Math.min(cfg.width, clusterCenter.x));
                    clusterCenter.y = Math.max(0, Math.min(cfg.height, clusterCenter.y));

                    attempts++;
                } while (this.isTooCloseToVillage(clusterCenter) && attempts < cfg.wellMaxAttempts);

                if (attempts >= cfg.wellMaxAttempts) continue;

                // Choose primary resource type for this cluster (80% chance same type)
                const primaryType = resourceTypes[this.seededRandom.randomInt(0, resourceTypes.length - 1)];

                // Generate resources in this cluster
                const resourcesInCluster = Math.min(clusterSize, totalResources - resourcesGenerated);

                for (let i = 0; i < resourcesInCluster; i++) {
                    // 80% chance to use primary type, 20% chance to use random type
                    const resourceType = this.seededRandom.random() < 0.8 ? primaryType : resourceTypes[this.seededRandom.randomInt(0, resourceTypes.length - 1)];

                    // Generate position within cluster (20-60 pixels from center)
                    const clusterRadius = 20 + this.seededRandom.random() * 40;
                    const angle = this.seededRandom.random() * 2 * Math.PI;

                    const pos = {
                        x: clusterCenter.x + Math.cos(angle) * clusterRadius,
                        y: clusterCenter.y + Math.sin(angle) * clusterRadius
                    };

                    // Ensure within world bounds
                    pos.x = Math.max(0, Math.min(cfg.width, pos.x));
                    pos.y = Math.max(0, Math.min(cfg.height, pos.y));

                    const emoji = this.getResourceEmoji(resourceType);
                    this.entities.push({
                        position: pos,
                        type: resourceType,
                        emoji,
                        collected: false,
                        isChild: false, // Initial resources are adults
                        clusterId: clusterIndex // Track which cluster this belongs to
                    });

                    resourcesGenerated++;
                }

                console.log(`[World Generation] Created cluster ${clusterIndex} with ${resourcesInCluster} ${primaryType} resources at distance ${Math.round(actualDistance)} from village`);
            }

            console.log(`[World Generation] Generated ${totalResources} resources, total entities: ${this.entities.length}`);

            // --- Generate trees separately (50 total) ---
            console.log(`[World Generation] Generating 50 trees across the world`);
            for (let i = 0; i < 50; i++) {
                let attempts = 0;
                let pos;
                do {
                    pos = {
                        x: this.seededRandom.randomRange(0, cfg.width),
                        y: this.seededRandom.randomRange(0, cfg.height)
                    };
                    attempts++;
                } while (this.isTooCloseToVillage(pos) && attempts < GameConfig.technical.distances.resourcePlacementAttempts);

                if (attempts < GameConfig.technical.distances.resourcePlacementAttempts) {
                    const treeEntity = {
                        position: pos,
                        type: GameConfig.entityTypes.tree,
                        emoji: GameConfig.emojis.tree,
                        collected: false,
                        isChild: false, // Initial trees are adults
                        clusterId: -1 // Trees don't use cluster system
                    };

                    this.entities.push(treeEntity);
                }
            }
            console.log(`[World Generation] Generated 50 trees, total entities: ${this.entities.length}`);

            // --- Render all entities as Phaser text objects ---
            this.worldEntities = [];
            for (const entity of this.entities) {
                let fontSize = entity.type === 'camp' ? 28 : entity.type === 'fireplace' || entity.type === 'sleeping_bag' ? 24 : entity.type === 'storage_box' ? 24 : ['well', ...GameUtils.ALL_FOOD_TYPES, 'tree'].includes(entity.type) ? 22 : 22;

                // Make communal storage 2x larger
                if (entity.type === 'storage_box' && !entity.isPersonal) {
                    fontSize = 48; // 2x the normal 24px size
                }

                let textObj;
                // Special handling for wells - scale based on water level
                if (entity.type === 'well') {
                    // Scale from 22px (3 water) to 66px (10 water) - 3x size
                    const baseSize = 22;
                    const maxSize = 66;
                    const minWater = 3;
                    const maxWater = 10;

                    // Calculate scale factor based on water level
                    const waterLevel = entity.waterLevel || 0;
                    const scaleFactor = Math.max(0, Math.min(1, (waterLevel - minWater) / (maxWater - minWater)));
                    const scaledSize = baseSize + (maxSize - baseSize) * scaleFactor;

                    // Calculate transparency (fully transparent at 0 water, fully opaque at 5+ water)
                    const transparencyThreshold = 5;
                    const alpha = waterLevel <= 0 ? 0 : Math.min(1, waterLevel / transparencyThreshold);

                    fontSize = Math.round(scaledSize);
                    textObj = this.add.text(entity.position.x, entity.position.y, entity.emoji, {
                        fontSize: fontSize + 'px',
                        fontFamily: 'Arial',
                        color: '#fff',
                        alpha: alpha
                    }).setOrigin(0.5);
                } else if (entity.type === 'fireplace') {
                    // Special handling for fires - scale and fade based on wood level
                    const baseSize = 24; // Normal fireplace size
                    const maxSize = 48; // 2x size at max wood
                    const maxWood = 10;

                    // Calculate scale factor based on wood level
                    const woodLevel = entity.wood || 0;
                    const scaleFactor = Math.max(0, Math.min(1, woodLevel / maxWood));
                    const scaledSize = baseSize + (maxSize - baseSize) * scaleFactor;

                    fontSize = Math.round(scaledSize);
                    textObj = this.add.text(entity.position.x, entity.position.y, GameConfig.emojis.fireplace, { fontSize: fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
                    textObj.setAlpha(1 - scaleFactor);
                    entity._phaserText = textObj;
                    this.worldEntities.push(textObj);
                } else {
                    textObj = this.add.text(entity.position.x, entity.position.y, entity.emoji, { fontSize: fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
                }
                entity._phaserText = textObj;
                this.worldEntities.push(textObj);

                // Add debug text and interaction circle for all objects
                this.addDebugElements(entity);

                // --- Resource collection: make resources interactive ---
                if (GameUtils.ALL_FOOD_TYPES.includes(entity.type) || entity.type === "tree") {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        if (entity.collected) return;
                        // Check player is near
                        const dist = GameUtils.distance(this.playerState.position, entity.position);
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
                        entity.collectedAt = this.playerState.currentTime; // Track when collected for propagation
                        textObj.setVisible(false);
                        this.playerState.inventory[slot] = { type: entity.type, emoji: entity.emoji };
                        this.updatePhaserUI();
                        this.showTempMessage(`Collected ${entity.type}!`, GameConfig.technical.messageDurations.short);
                    });
                }
                // --- Well interaction: click to drink if near ---
                if (entity.type === 'well') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = GameUtils.distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to drink from well out of range');

                        // Check if well has sufficient water (minimum 1.0 unit)
                        if (entity.waterLevel < 1.0) {
                            this.showTempMessage('Well is empty!', GameConfig.technical.messageDurations.short);
                            return;
                        }

                        if (this.playerState.needs.water >= GameConfig.needs.fullValue) {
                            this.showTempMessage('Already fully hydrated!', GameConfig.technical.messageDurations.short);
                            return;
                        }
                        this.playerState.needs.water = Math.min(GameConfig.needs.fullValue, this.playerState.needs.water + GameConfig.wells.drinkingAmount);
                        // Reduce well water level
                        entity.waterLevel = Math.max(0, entity.waterLevel - 1);
                        // Update well visuals
                        this.updateWellVisuals(entity);
                        this.updatePhaserUI();
                        this.showTempMessage('Drank from well!', GameConfig.technical.messageDurations.short);
                    });
                }
                // --- Fire interaction: click to interact if near ---
                if (entity.type === GameConfig.entityTypes.fireplace) {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = GameUtils.distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with fire out of range');

                        // Check if player has wood to add
                        const woodSlot = this.playerState.inventory.findIndex(item => item && item.type === GameConfig.entityTypes.tree);
                        if (woodSlot !== -1 && entity.wood < entity.maxWood) {
                            // Add wood to fire (enforce max limit)
                            entity.wood = Math.min(entity.maxWood, entity.wood + 1);
                            this.playerState.inventory[woodSlot] = null;
                            entity.isBurning = true;

                            // Update fire visuals
                            this.updateFireVisuals(entity);

                            this.updatePhaserUI();
                            this.showTempMessage('Added wood to fire!', GameConfig.technical.messageDurations.short);
                        } else if (woodSlot !== -1) {
                            this.showTempMessage('Fire is full of wood!', GameConfig.technical.messageDurations.short);
                        } else {
                            this.showTempMessage('Need wood to fuel fire!', GameConfig.technical.messageDurations.short);
                        }
                    });
                }
                // --- Sleeping bag interaction: click to sleep if near ---
                if (entity.type === 'sleeping_bag') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = GameUtils.distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with sleeping bag out of range');

                        if (entity.isOccupied) {
                            this.showTempMessage('Sleeping bag is occupied!', GameConfig.technical.messageDurations.short);
                            return;
                        }

                        // Sleep until 8:00 AM
                        this.sleepUntilMorning(entity);
                    });
                }
                // --- Storage box interaction: click to interact if near ---
                if (entity.type === 'storage_box') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = GameUtils.distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with storage box out of range');

                        this.showStorageInterface(entity);
                    });
                }
            }
            // --- Player ---
            let gameStartTime = GameConfig.time.gameStartHour * GameConfig.time.secondsPerHour;
            this.playerState = {
                position: { ...this.playerStartPosition },
                needs: {
                    temperature: this.seededRandom.randomRange(GameConfig.player.startingStats.temperature.min, GameConfig.player.startingStats.temperature.max),
                    water: this.seededRandom.randomRange(GameConfig.player.startingStats.water.min, GameConfig.player.startingStats.water.max),
                    calories: this.seededRandom.randomRange(GameConfig.player.startingStats.calories.min, GameConfig.player.startingStats.calories.max),
                    vitamins: new Array(GameConfig.needs.vitaminCount).fill(0).map(() => this.seededRandom.randomRange(GameConfig.player.startingStats.vitamins.min, GameConfig.player.startingStats.vitamins.max))
                },
                inventory: new Array(GameConfig.player.inventorySize).fill(null),
                currentTime: gameStartTime,
            };
            this.player = this.add.text(this.playerState.position.x, this.playerState.position.y, '👤', { fontSize: GameConfig.player.fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
            assert(this.player, 'Failed to create player emoji.');
            // Camera - follow player with smooth interpolation, no bounds restriction
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            // Remove camera bounds to allow free exploration of the large world
            // this.cameras.main.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
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
                const barBg = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, GameConfig.ui.colors.barBackground).setOrigin(0.5, 0).setScrollFactor(0);
                const barFill = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, getPhaserBarColor(needTypes[i])).setOrigin(0.5, 0).setScrollFactor(0);
                const label = this.add.text(margin, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, needLabels[i], { fontSize: GameConfig.ui.fontSizes.needLabel, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0, 0.5).setScrollFactor(0);
                const value = this.add.text(barStartX + GameConfig.ui.barWidth + GameConfig.ui.dimensions.valueOffset, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, '100', { fontSize: GameConfig.ui.fontSizes.needValue, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0, 0.5).setScrollFactor(0);
                this.uiContainer.add([barBg, barFill, label, value]);
                this.ui.needsBars.push({ barBg, barFill, label, value });
            }
            // Inventory (bottom center) - use viewport dimensions
            const inventoryWidth = GameConfig.player.inventorySize * GameConfig.ui.dimensions.slotSpacing;
            const inventoryStartX = (window.innerWidth - inventoryWidth) / 2;
            const inventoryY = window.innerHeight - margin - 30; // Add 30px more space from bottom
            this.ui.inventorySlots = [];
            for (let i = 0; i < GameConfig.player.inventorySize; i++) {
                const slot = this.add.rectangle(inventoryStartX + i * GameConfig.ui.dimensions.slotSpacing, inventoryY, GameConfig.ui.dimensions.slotSize, GameConfig.ui.dimensions.slotSize, GameConfig.ui.colors.slotBackground).setOrigin(0.5).setStrokeStyle(2, GameConfig.ui.colors.slotBorder).setScrollFactor(0);
                const emoji = this.add.text(inventoryStartX + i * GameConfig.ui.dimensions.slotSpacing, inventoryY, '', { fontSize: GameConfig.ui.fontSizes.inventory, fontFamily: 'Arial', color: GameConfig.ui.colors.textPrimary }).setOrigin(0.5).setScrollFactor(0);
                this.uiContainer.add([slot, emoji]);
                this.ui.inventorySlots.push({ slot, emoji });
                // --- Inventory slot click: move to storage, eat, or add to fire ---
                slot.setInteractive({ useHandCursor: true });
                slot.on('pointerdown', () => {
                    if (this.playerState.inventory[i]) {
                        const item = this.playerState.inventory[i];
                        console.log(`[Inventory] Clicked on ${item.type} in slot ${i}`);

                        // First priority: move to storage if storage window is open
                        console.log('[Inventory] Storage dialog check:', this._storageDialog ? 'open' : 'closed');
                        if (this._storageDialog) {
                            console.log('[Inventory] Storage dialog open, transferring to storage');
                            this.transferItemToStorage(this._storageDialog.storageBox, i);
                            return;
                        }

                        // Second priority: eat food if near a burning fire
                        if (GameUtils.isFood(item.type)) {
                            const nearbyFire = this.findNearbyFire();
                            if (nearbyFire) {
                                this.eatFoodFromInventory(i, item);
                                return;
                            } else {
                                this.showTempMessage('Must be near a burning fire to eat!', GameConfig.technical.messageDurations.medium);
                                return;
                            }
                        }

                        // Third priority: add wood to fire if near a burning fire
                        if (item.type === GameConfig.entityTypes.tree) {
                            const nearbyFire = this.findNearbyFire();
                            if (nearbyFire && nearbyFire.wood < nearbyFire.maxWood) {
                                // Add wood to fire (enforce max limit)
                                nearbyFire.wood = Math.min(nearbyFire.maxWood, nearbyFire.wood + 1);
                                nearbyFire.isBurning = true;
                                this.playerState.inventory[i] = null;

                                // Update fire visuals
                                this.updateFireVisuals(nearbyFire);

                                this.updatePhaserUI();
                                this.showTempMessage('Added wood to fire!', 1200);
                                return;
                            }
                        }

                        // If none of the above conditions are met, do nothing
                        console.log('[Inventory] No action taken for item');
                    }
                });
            }

            // Time display (top right) - fixed to camera viewport
            this.ui.timeText = this.add.text(window.innerWidth - margin, margin, '', { fontSize: GameConfig.ui.fontSizes.time, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(1, 0).setScrollFactor(0);
            this.uiContainer.add(this.ui.timeText);
            // --- Visual Temperature State Tracking ---
            this._visualTempState = null; // Track current state
            this._visualTempDayState = null; // Track current day state ("moderate" or "warm")
            this._visualTempLastHour = null; // Track last hour for update
            this._visualTempSeededRandom = new SeededRandom(getCurrentSeed() + 12345); // Offset for temp randomness
            // Info box (bottom left) - fixed to camera viewport
            this.ui.infoBox = this.add.text(margin, window.innerHeight - margin, 'Alpine Sustainability v1.0\nControls: WASD to move\nClick inventory slots to select', { fontSize: GameConfig.ui.fontSizes.debug, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.textDark, padding: GameConfig.ui.dimensions.textPadding.large }).setOrigin(0, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.infoBox);
            // Debug toggle (bottom left, above log spam button) - fixed to camera viewport
            this.ui.debugBtn = this.add.text(margin, window.innerHeight - margin - GameConfig.ui.dimensions.debugButtonOffset, '⚪ Debug: OFF', { fontSize: GameConfig.ui.fontSizes.debug, fontFamily: 'monospace', color: GameConfig.ui.colors.textSecondary, backgroundColor: GameConfig.ui.colors.debugBackground, padding: GameConfig.ui.dimensions.textPadding.large }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.debugBtn.on('pointerdown', () => {
                window.villagerDebugEnabled = !window.villagerDebugEnabled;
                updateDebugBtn.call(this);
                // Update all debug elements immediately
                this.updateDebugElements();
            });
            function updateDebugBtn() {
                if (window.villagerDebugEnabled) {
                    this.ui.debugBtn.setText('🟢 Debug: ON').setColor(GameConfig.ui.colors.textPrimary).setBackgroundColor(GameConfig.ui.colors.buttonSuccess);
                    if (this.ui.fpsCounter) {
                        this.ui.fpsCounter.setVisible(true);
                    }
                } else {
                    this.ui.debugBtn.setText('⚪ Debug: OFF').setColor(GameConfig.ui.colors.textSecondary).setBackgroundColor(GameConfig.ui.colors.debugBackground);
                    if (this.ui.fpsCounter) {
                        this.ui.fpsCounter.setVisible(false);
                    }
                }
            }
            // Initialize debug state (default to OFF)
            if (typeof window.villagerDebugEnabled === 'undefined') {
                window.villagerDebugEnabled = false;
            }
            updateDebugBtn.call(this);
            this.uiContainer.add(this.ui.debugBtn);

            // Log spam toggle (bottom left, above info box) - fixed to camera viewport
            this.ui.logSpamBtn = this.add.text(margin, window.innerHeight - margin - GameConfig.ui.dimensions.logSpamButtonOffset, '⚪ Log Spam: OFF', { fontSize: GameConfig.ui.fontSizes.debug, fontFamily: 'monospace', color: GameConfig.ui.colors.textSecondary, backgroundColor: GameConfig.ui.colors.debugBackground, padding: GameConfig.ui.dimensions.textPadding.large }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.logSpamBtn.on('pointerdown', () => {
                window.summaryLoggingEnabled = !window.summaryLoggingEnabled;
                updateLogSpamBtn.call(this);
            });
            function updateLogSpamBtn() {
                if (window.summaryLoggingEnabled) {
                    this.ui.logSpamBtn.setText('🟢 Log Spam: ON').setColor(GameConfig.ui.colors.textPrimary).setBackgroundColor(GameConfig.ui.colors.buttonSuccess);
                } else {
                    this.ui.logSpamBtn.setText('⚪ Log Spam: OFF').setColor(GameConfig.ui.colors.textSecondary).setBackgroundColor(GameConfig.ui.colors.debugBackground);
                }
            }
            updateLogSpamBtn.call(this);
            this.uiContainer.add(this.ui.logSpamBtn);

            // Seed control box (bottom right) - use viewport dimensions
            const seedBoxY = window.innerHeight - margin;
            const seedBoxWidth = GameConfig.ui.dimensions.seedBoxWidth;
            const seedBoxX = window.innerWidth - margin - seedBoxWidth;

            // Seed label - fixed to camera viewport
            this.ui.seedLabel = this.add.text(seedBoxX, seedBoxY - 25, '🌱 Seed:', { fontSize: GameConfig.ui.fontSizes.debug, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.seedLabel);

            // Seed input background - fixed to camera viewport
            this.ui.seedInputBg = this.add.rectangle(seedBoxX + GameConfig.ui.dimensions.seedInputOffset, seedBoxY - 15, GameConfig.ui.dimensions.seedInputWidth, GameConfig.ui.dimensions.seedInputHeight, GameConfig.ui.colors.slotBackground).setOrigin(0, 1).setStrokeStyle(1, GameConfig.ui.colors.slotBorder).setScrollFactor(0);
            this.uiContainer.add(this.ui.seedInputBg);

            // Seed input text - fixed to camera viewport
            this.ui.seedInputText = this.add.text(seedBoxX + 56, seedBoxY - 17, getCurrentSeed().toString(), { fontSize: GameConfig.ui.fontSizes.medium, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0.5, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.seedInputText);

            // Decrement button (-) - fixed to camera viewport
            this.ui.seedDecrementBtn = this.add.text(seedBoxX + 25, seedBoxY - 15, '-', { fontSize: GameConfig.ui.fontSizes.large, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.buttonSecondary, padding: GameConfig.ui.dimensions.buttonPadding.small }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.seedDecrementBtn.on('pointerdown', () => {
                console.log('[Seed] Decrement button clicked');
                this.decrementSeed();
            });
            this.uiContainer.add(this.ui.seedDecrementBtn);

            // Increment button (+) - fixed to camera viewport
            this.ui.seedIncrementBtn = this.add.text(seedBoxX + GameConfig.ui.dimensions.seedButtonOffset, seedBoxY - 15, '+', { fontSize: GameConfig.ui.fontSizes.large, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.buttonSecondary, padding: GameConfig.ui.dimensions.buttonPadding.small }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.seedIncrementBtn.on('pointerdown', () => {
                console.log('[Seed] Increment button clicked');
                this.incrementSeed();
            });
            this.uiContainer.add(this.ui.seedIncrementBtn);

            // New Game button - fixed to camera viewport
            this.ui.newGameBtn = this.add.text(seedBoxX + 100, seedBoxY - 15, '🔄 New Game', { fontSize: GameConfig.ui.fontSizes.medium, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.buttonPrimary, padding: GameConfig.ui.dimensions.buttonPadding.medium }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.newGameBtn.on('pointerdown', () => {
                console.log('[NewGame] New Game button clicked');
                this.showNewGameConfirmation();
            });
            this.uiContainer.add(this.ui.newGameBtn);

            // Initialize current seed value
            this.currentSeedValue = getCurrentSeed();

            // FPS counter (above debug button) - fixed to camera viewport
            this.ui.fpsCounter = this.add.text(margin, window.innerHeight - margin - GameConfig.ui.dimensions.fpsCounterOffset, 'FPS: 60', { fontSize: GameConfig.ui.fontSizes.fps, fontFamily: 'monospace', color: GameConfig.ui.colors.textSecondary, backgroundColor: GameConfig.ui.colors.fpsBackground, padding: GameConfig.ui.dimensions.textPadding.large }).setOrigin(0, 1).setScrollFactor(0).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);
            this.uiContainer.add(this.ui.fpsCounter);


        }
        update(time, delta) {
            // Update day/night lighting
            this.updateDayNightLighting();

            // Check if player is sleeping
            if (this.isSleeping && this.sleepingBag) {
                // Check if player moved away from sleeping bag
                const dist = GameUtils.distance(this.playerState.position, this.sleepingBag.position);
                if (dist > GameConfig.player.interactionThreshold) {
                    // Player moved away, stop sleeping
                    this.stopSleeping();
                } else {
                    // Use accelerated time while sleeping
                    const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
                    const gameTimeDelta = (delta / 1000) * timeAcceleration * this.sleepTimeAcceleration;
                    // Assert: time should never go backwards
                    if (this._lastSleepTime !== undefined) {
                        assert(this.playerState.currentTime + gameTimeDelta >= this._lastSleepTime, '[Sleep] Time went backwards while sleeping!');
                    }
                    this._lastSleepTime = this.playerState.currentTime + gameTimeDelta;
                    this.playerState.currentTime += gameTimeDelta;

                    // Update ZZZ position
                    if (this.sleepZZZ) {
                        this.sleepZZZ.setPosition(this.player.x, this.player.y - GameConfig.ui.dimensions.sleepingOffset);
                    }

                    // Restore temperature while sleeping (calories should still decay naturally)
                    this.playerState.needs.temperature = Math.min(GameConfig.needs.fullValue, this.playerState.needs.temperature + 0.5);
                }
            } else {
                // Normal time progression
                const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
                const gameTimeDelta = (delta / 1000) * timeAcceleration;
                this.playerState.currentTime += gameTimeDelta;
                this._lastSleepTime = undefined;
            }

            // Check if player moved away from storage box
            if (this._storageDialog) {
                const dist = GameUtils.distance(this.playerState.position, this._storageDialog.storageBox.position);
                if (dist > GameConfig.player.interactionThreshold) {
                    this.closeStorageInterface();
                }
            }

            // Update villagers (with sleep acceleration if sleeping)
            const effectiveDelta = this.isSleeping ? delta * this.sleepTimeAcceleration : delta;
            this.updateVillagers(effectiveDelta);

            // Update resource propagation (overnight)
            this.updateResourcePropagation();

            // Update well water levels (hourly regeneration)
            this.updateWellRegeneration(effectiveDelta);

            // Update fire wood consumption
            this.updateFireConsumption(effectiveDelta);

            // Update animal fleeing behavior
            this.updateAnimalFleeing(effectiveDelta);

            // Needs (with sleep acceleration if sleeping)
            updateNeeds(this.playerState, effectiveDelta);

            // Apply fire temperature effects (with sleep acceleration if sleeping)
            this.applyFireTemperatureEffects(effectiveDelta);

            // Update fire emojis for all fires to reflect current wood levels
            this.updateAllFireEmojis();

            // UI update
            this.updatePhaserUI();

            // Game over
            const reason = checkGameOver(this.playerState);
            if (reason) {
                this.showGameOverOverlay(reason);
                this.scene.pause();
                return;
            }

            // Player movement (with sleep acceleration if sleeping)
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
            this.playerState.position.x += vx * moveSpeed * (effectiveDelta / 1000);
            this.playerState.position.y += vy * moveSpeed * (effectiveDelta / 1000);

            // Allow player to move freely within the large world bounds
            // Only clamp to prevent going outside the actual world boundaries
            this.playerState.position.x = Math.max(0, Math.min(GameConfig.world.width, this.playerState.position.x));
            this.playerState.position.y = Math.max(0, Math.min(GameConfig.world.height, this.playerState.position.y));

            this.player.setPosition(this.playerState.position.x, this.playerState.position.y);
            // --- Visual Temperature State Update ---
            const t = getCurrentTime(this.playerState);
            if (this._visualTempLastHour !== t.hour) {
                this._visualTempLastHour = t.hour;
                this._visualTempState = this._calculateVisualTemperatureState(t);
            }
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
                this.ui.inventorySlots[i].slot.setStrokeStyle(2, 0x666666); // No selection frame
            }
            // Time display
            const t = getCurrentTime(this.playerState);
            let timeEmoji = '🌅';
            if (t.hour >= 6 && t.hour < 12) timeEmoji = '🌅';
            else if (t.hour >= 12 && t.hour < GameConfig.time.nightStartHour) timeEmoji = '☀️';
            else if (t.hour >= GameConfig.time.nightStartHour && t.hour < 22) timeEmoji = '🌆';
            else timeEmoji = '🌙';

            // Visual temperature display
            let tempState = this._visualTempState || 'moderate';
            let tempEmoji = '❄️';

            // Override: If near a burning fire, always show "hot"
            // Use heating range for temperature display
            const fireRange = GameConfig.player.fireHeatingRange;
            let nearbyFire = null;

            for (const entity of this.entities) {
                if (entity.type === 'fireplace' && entity.isBurning && entity.wood > 0) {
                    const dist = GameUtils.distance(this.playerState.position, entity.position);
                    if (dist <= fireRange) {
                        nearbyFire = entity;
                        break;
                    }
                }
            }

            if (nearbyFire) {
                tempState = 'hot';
            }

            const tempLabel = GameConfig.visualTemperature.labels[tempState] || 'Moderate';
            if (tempState === 'freezing') tempEmoji = '🥶';
            else if (tempState === 'cold') tempEmoji = '🧊';
            else if (tempState === 'warm') tempEmoji = '🌤️';
            else if (tempState === 'hot') tempEmoji = '🔥';
            else tempEmoji = '🌡️';

            // Count living villagers
            const livingVillagers = this.villagers ? this.villagers.filter(v => !v.isDead).length : 0;
            this.ui.timeText.setText(`📅 Day ${t.day}\n${timeEmoji} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}\n${tempEmoji} ${tempLabel}\n👥 Neighbours: ${livingVillagers}`);
            // Seed UI
            const currentSeed = this.currentSeedValue || getCurrentSeed();
            this.ui.seedInputText.setText(currentSeed.toString());

            // Update debug elements
            this.updateDebugElements();

            // Update FPS counter
            if (window.villagerDebugEnabled && this.ui.fpsCounter) {
                const fps = Math.round(1000 / this.game.loop.delta);
                this.ui.fpsCounter.setText(`FPS: ${fps}`);
            }

        }

        updateVillagers(delta) {
            if (!this.villagers) return;

            // Get storage boxes for villager interactions
            const storageBoxes = this.entities.filter(e => e.type === 'storage_box');

            // Debug: Log entity count occasionally (behind log spam gate)
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 1% chance per frame when spam enabled
                const resourceEntities = this.entities.filter(e => [...GameUtils.ALL_FOOD_TYPES, 'tree'].includes(e.type));
                const uncollectedResources = resourceEntities.filter(e => !e.collected);
                console.log(`[MainScene] Total entities: ${this.entities.length}, Resources: ${resourceEntities.length}, Uncollected: ${uncollectedResources.length}`);
            }

            // Update each villager
            for (let i = this.villagers.length - 1; i >= 0; i--) {
                const villager = this.villagers[i];

                // Skip if already dead
                if (villager.isDead) continue;

                // Update villager with access to entities and storage boxes
                const isDead = villager.update(delta, this.playerState.currentTime, this.entities, storageBoxes);

                if (isDead) {
                    // Mark as dead and create corpse
                    villager.isDead = true;

                    // Free sleeping bag if occupied
                    if (villager.sleepingBag) {
                        villager.sleepingBag.isOccupied = false;
                        villager.sleepingBag = null;
                    }

                    // Change visual to corpse
                    if (villager.phaserText) {
                        villager.phaserText.setText('💀');
                        villager.phaserText.setColor('#ff0000'); // Red color for dead villagers
                    }
                    if (villager.nameText) {
                        villager.nameText.setText(`${villager.name} 💀`);
                        villager.nameText.setColor('#ff0000'); // Red color for dead villagers
                    }
                    if (villager.stateText) {
                        villager.stateText.setText('DEAD');
                        villager.stateText.setColor('#ff0000'); // Red color for dead villagers
                    }

                    if (window.summaryLoggingEnabled) {
                        console.log(`[MainScene] Villager ${villager.name} died and became a corpse`);
                    }
                }
            }

            // Debug: Log villager positions occasionally (behind log spam gate)
            if (window.summaryLoggingEnabled && Math.random() < 0.02) { // 2% chance per frame when spam enabled
                this.logVillagerPositions();
            }
        }

        logVillagerPositions() {
            const positions = this.villagers.map(v =>
                `${v.name}: ${v.state} at (${Math.round(v.position.x)}, ${Math.round(v.position.y)})`
            ).join(', ');
            console.log(`[Villagers] ${positions}`);
        }

        isTooCloseToVillage(pos) {
            const centerX = GameConfig.world.width / 2;
            const centerY = GameConfig.world.height / 2;

            // Check minimum distance from village center
            if (GameUtils.distance(pos, { x: centerX, y: centerY }) < GameConfig.world.resourceVillageMinDistance) {
                return true;
            }

            // Also check distance from each camp to prevent resources spawning inside camps
            if (this.camps && this.camps.length > 0) {
                for (let i = 0; i < this.camps.length; i++) {
                    const campDistance = GameUtils.distance(pos, this.camps[i]);
                    if (campDistance < 200) { // Minimum 200 pixels from any camp
                        return true;
                    }
                }
            }

            return false;
        }
        isTooCloseToExistingWell(pos) {
            if (!this.wells) return false;
            for (const well of this.wells) {
                if (GameUtils.distance(pos, well.position) < GameConfig.world.wellMinDistance) return true;
            }
            return false;
        }
        getResourceEmoji(type) {
            // Get emoji from GameConfig.resources.foodData
            if (GameConfig.resources.foodData[type]) {
                return GameConfig.resources.foodData[type].emoji;
            }
            // Fallback for non-food entities
            const fallbackEmojis = {
                'well': '💧',
                'fireplace': '🔥',
                'sleeping_bag': '🛏️',
                'storage_box': '📦',
                'tree': '🌲'
            };
            return fallbackEmojis[type] || '❓';
        }
        showTempMessage(msg, duration = GameConfig.ui.tempMessageDuration) {
            if (this._tempMsg) this._tempMsg.destroy();
            this._tempMsg = this.add.text(this.player.x, this.player.y - GameConfig.ui.dimensions.tempMessageOffset, msg, { fontSize: GameConfig.ui.fontSizes.overlayMessage, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.textDark, padding: GameConfig.ui.dimensions.buttonPadding.medium }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug);
            this.time.delayedCall(duration, () => { if (this._tempMsg) { this._tempMsg.destroy(); this._tempMsg = null; } });
        }
        showGameOverOverlay(reason) {
            if (this._gameOverOverlay) return;
            const w = this.cameras.main.width;
            const h = this.cameras.main.height;
            const bg = this.add.rectangle(w / 2, h / 2, GameConfig.ui.overlayDimensions.width, GameConfig.ui.overlayDimensions.height, GameConfig.ui.overlayColor, GameConfig.ui.overlayAlpha).setOrigin(0.5).setDepth(GameConfig.ui.overlayZIndex).setScrollFactor(0);
            const text = this.add.text(w / 2, h / 2 - GameConfig.ui.dimensions.tempMessageOffset, 'Game Over', { fontSize: GameConfig.ui.fontSizes.massive, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
            const reasonText = this.add.text(w / 2, h / 2, reason, { fontSize: GameConfig.ui.fontSizes.overlayMessage, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
            const btn = this.add.text(w / 2, h / 2 + GameConfig.ui.dimensions.sleepingOffset, 'New Game', { fontSize: GameConfig.ui.fontSizes.huge, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.buttonPrimary, padding: GameConfig.ui.dimensions.buttonPadding.xlarge })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
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

        createGroundTexture() {
            try {
                // Create a subtle ground texture using Perlin noise for natural variation
                const tileSize = 64; // Size of each texture tile
                const worldWidth = GameConfig.world.width;
                const worldHeight = GameConfig.world.height;

                // Ensure noise is initialized
                if (!this.noise) {
                    console.error('[Ground Texture] Noise not initialized, skipping ground texture creation');
                    return;
                }

                // Create tiles across the entire world
                for (let x = 0; x < worldWidth; x += tileSize) {
                    for (let y = 0; y < worldHeight; y += tileSize) {
                        // Use Perlin noise to determine tile color for natural variation
                        const noiseX = x / 200; // Scale for smooth variation
                        const noiseY = y / 200;
                        const noiseValue = this.noise.noise2D(noiseX, noiseY);

                        // Map noise to color variation
                        let color;
                        if (noiseValue < -0.3) {
                            color = 0x4a5d23; // Darker green
                        } else if (noiseValue < 0.3) {
                            color = 0x5a6d33; // Medium green
                        } else {
                            color = 0x6a7d43; // Lighter green
                        }

                        // Add some grey variation for texture
                        const greyNoise = this.noise.noise2D(noiseX * 2, noiseY * 2);
                        if (greyNoise > 0.5) {
                            color = 0x6b6b6b; // Light grey
                        } else if (greyNoise > 0.2) {
                            color = 0x5a5a5a; // Medium grey
                        }

                        // Create the ground tile
                        const tile = this.add.rectangle(
                            x + tileSize / 2,
                            y + tileSize / 2,
                            tileSize,
                            tileSize,
                            color
                        ).setOrigin(0.5);

                        // Set very low alpha for subtle effect
                        tile.setAlpha(0.3);

                        // Store reference for potential cleanup
                        if (!this.groundTiles) this.groundTiles = [];
                        this.groundTiles.push(tile);
                    }
                }

                console.log(`[Ground Texture] Created ${this.groundTiles.length} ground tiles for navigation`);
            } catch (error) {
                console.error('[Ground Texture] Error creating ground texture:', error);
                // Don't crash the game if ground texture fails
            }
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

            // Background overlay - fixed to camera viewport
            const bg = this.add.rectangle(w / 2, h / 2, GameConfig.ui.dimensions.confirmationWidth, GameConfig.ui.dimensions.confirmationHeight, GameConfig.ui.colors.overlay, 0.95).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlay).setScrollFactor(0);

            // Title - fixed to camera viewport
            const title = this.add.text(w / 2, h / 2 - GameConfig.ui.dimensions.titleOffset, 'Start New Game?', { fontSize: GameConfig.ui.fontSizes.overlayTitle, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Message - fixed to camera viewport
            const message = this.add.text(w / 2, h / 2 - GameConfig.ui.dimensions.messageOffset, `Seed: ${seed}`, { fontSize: GameConfig.ui.fontSizes.button, fontFamily: 'monospace', color: GameConfig.ui.colors.textSecondary }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Buttons - fixed to camera viewport
            const yesBtn = this.add.text(w / 2 - GameConfig.ui.dimensions.buttonSpacing, h / 2 + GameConfig.ui.dimensions.buttonOffset, 'Yes', { fontSize: GameConfig.ui.fontSizes.button, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.buttonPrimary, padding: GameConfig.ui.dimensions.buttonPadding.large })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            const noBtn = this.add.text(w / 2 + GameConfig.ui.dimensions.buttonSpacing, h / 2 + GameConfig.ui.dimensions.buttonOffset, 'No', { fontSize: GameConfig.ui.fontSizes.button, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.buttonSecondary, padding: GameConfig.ui.dimensions.buttonPadding.large })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

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

        addDebugElements(entity) {
            // Add debug text above entity with proper z-index
            const debugText = this.add.text(
                entity.position.x,
                entity.position.y - 40,
                this.getDebugText(entity),
                { fontSize: '10px', fontFamily: 'monospace', color: '#00ff00', backgroundColor: '#000', padding: { left: 2, right: 2, top: 1, bottom: 1 } }
            ).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);

            // Add interaction distance circle
            const interactionCircle = this.add.circle(
                entity.position.x,
                entity.position.y,
                GameConfig.player.interactionThreshold,
                0x00ff00,
                0.1 // Very transparent
            ).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);

            // Add fire warmth range circle for fireplaces
            let warmthCircle = null;
            if (entity.type === 'fireplace') {
                warmthCircle = this.add.circle(
                    entity.position.x,
                    entity.position.y,
                    GameConfig.player.fireHeatingRange, // Use config-defined heating range
                    0xff6600, // Orange color for warmth
                    0.05 // Very transparent
                ).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);
            }

            // Store references for toggling
            entity._debugText = debugText;
            entity._interactionCircle = interactionCircle;
            entity._warmthCircle = warmthCircle;
        }

        getDebugText(entity) {
            switch (entity.type) {
                case 'well':
                    return `Well (${entity.waterLevel.toFixed(2)} water)`;
                case 'fireplace':
                    return `Fire (${Math.round(entity.wood)}/${entity.maxWood} wood) ${entity.isBurning ? '🔥' : '❄️'}`;
                case 'sleeping_bag':
                    return `Sleeping Bag ${entity.isOccupied ? '(Occupied)' : '(Free)'}`;
                case 'storage_box':
                    const capacity = entity.isPersonal ? GameConfig.storage.personalCapacity : GameConfig.storage.communalCapacity;
                    const itemCount = entity.items.filter(item => item !== null).length;
                    return `${entity.isPersonal ? 'Personal' : 'Communal'} Storage (${itemCount}/${capacity})`;
                case 'blackberry':
                case 'mushroom':
                case 'herb':
                case 'blueberry':
                case 'raspberry':
                case 'elderberry':
                case 'wild_garlic':
                case 'dandelion':
                case 'nettle':
                case 'sorrel':
                case 'watercress':
                case 'wild_onion':
                case 'chickweed':
                case 'plantain':
                case 'yarrow':
                case 'rabbit':
                case 'deer':
                case 'squirrel':
                case 'pheasant':
                case 'duck':
                case 'goose':
                case 'hare':
                case 'fox':
                case 'boar':
                case 'elk':
                case 'marten':
                case 'grouse':
                case 'woodcock':
                case 'beaver':
                case 'otter':
                case 'tree':
                    const status = entity.collected ? '(Collected)' : entity.isChild ? '(Child)' : '(Adult)';
                    return `${entity.type} ${status}`;
                default:
                    return entity.type;
            }
        }

        updateDebugElements() {
            // Update all entity debug elements based on debug state
            for (const entity of this.entities) {
                if (entity._debugText) {
                    entity._debugText.setVisible(window.villagerDebugEnabled);
                    if (window.villagerDebugEnabled) {
                        entity._debugText.setText(this.getDebugText(entity));
                        entity._debugText.setPosition(entity.position.x, entity.position.y - 40);
                    }
                }
                if (entity._interactionCircle) {
                    entity._interactionCircle.setVisible(window.villagerDebugEnabled);
                    if (window.villagerDebugEnabled) {
                        entity._interactionCircle.setPosition(entity.position.x, entity.position.y);
                    }
                }
                if (entity._warmthCircle) {
                    entity._warmthCircle.setVisible(window.villagerDebugEnabled);
                    if (window.villagerDebugEnabled) {
                        entity._warmthCircle.setPosition(entity.position.x, entity.position.y);
                    }
                }
            }

            // Update resource count debug display
            this.updateResourceCountDisplay();
        }

        updateResourceCountDisplay() {
            // Clean up any existing resource count text objects
            if (this.resourceCountTexts) {
                this.resourceCountTexts.forEach(textObj => {
                    if (textObj && typeof textObj.destroy === 'function') {
                        textObj.destroy();
                    }
                });
                this.resourceCountTexts = [];
            }

            // Also clean up any old resourceCountText (singular) that might exist
            if (this.resourceCountText && typeof this.resourceCountText.destroy === 'function') {
                this.resourceCountText.destroy();
                this.resourceCountText = null;
            }

            if (!window.villagerDebugEnabled) {
                return;
            }

            // Count resources by type (in the wild)
            const wildCounts = {};
            for (const entity of this.entities) {
                if (GameUtils.ALL_FOOD_TYPES.includes(entity.type) && !entity.collected) {
                    wildCounts[entity.type] = (wildCounts[entity.type] || 0) + 1;
                }
            }

            // Count resources in inventories and storage
            const storedCounts = {};

            // Player inventory
            for (const item of this.playerState.inventory) {
                if (item && GameUtils.ALL_FOOD_TYPES.includes(item.type)) {
                    storedCounts[item.type] = (storedCounts[item.type] || 0) + 1;
                }
            }

            // Villager inventories
            for (const villager of this.villagers) {
                if (villager && !villager.isDead) {
                    for (const item of villager.inventory) {
                        if (item && GameUtils.ALL_FOOD_TYPES.includes(item.type)) {
                            storedCounts[item.type] = (storedCounts[item.type] || 0) + 1;
                        }
                    }
                }
            }

            // Storage boxes
            for (const entity of this.entities) {
                if (entity.type === 'storage_box' && entity.items) {
                    for (const item of entity.items) {
                        if (item && GameUtils.ALL_FOOD_TYPES.includes(item.type)) {
                            storedCounts[item.type] = (storedCounts[item.type] || 0) + 1;
                        }
                    }
                }
            }

            // Build display text with color coding - show ALL food types
            let displayText = 'Resource Counts:\n';
            const sortedTypes = GameUtils.ALL_FOOD_TYPES.sort();

            for (const type of sortedTypes) {
                const emoji = this.getResourceEmoji(type);
                const wildCount = wildCounts[type] || 0;
                const storedCount = storedCounts[type] || 0;

                // Add resource line (color will be determined per line in updateResourceCountTextWithColors)
                displayText += `${emoji} ${type}: ${wildCount}+${storedCount}\n`;
            }

            // Add total
            const totalWild = Object.values(wildCounts).reduce((sum, count) => sum + count, 0);
            const totalStored = Object.values(storedCounts).reduce((sum, count) => sum + count, 0);
            displayText += `\nTotal: ${totalWild}+${totalStored}`;

            // Split text by color markers and create multiple text objects
            this.updateResourceCountTextWithColors(displayText);
        }

        updateResourceCountTextWithColors(displayText) {
            // Initialize array to track all text objects
            if (!this.resourceCountTexts) {
                this.resourceCountTexts = [];
            }

            // Split text by lines and process each line individually
            const lines = displayText.split('\n');
            let currentY = 275;
            const lineHeight = 12;

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                if (line.trim() === '') continue;

                // Check if this line should be grey (contains a resource with wild count = 0)
                let isGrey = false;
                if (line.includes(':')) {
                    // Extract the wild count from the line (format: "emoji name: wild+stored")
                    const match = line.match(/: (\d+)\+(\d+)/);
                    if (match) {
                        const wildCount = parseInt(match[1], 10);
                        isGrey = wildCount === 0;
                    }
                }

                const color = isGrey ? '#888888' : '#ffffff';

                // Debug: log the color assignment for resource lines
                if (window.summaryLoggingEnabled && line.includes(':')) {
                    console.log(`[ResourceCount] Line: "${line.trim()}", isGrey: ${isGrey}, color: ${color}`);
                }

                // Create text object for this line
                const textObj = this.add.text(20, currentY, line, {
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: color,
                    backgroundColor: '#000',
                    padding: { left: 5, right: 5, top: 2, bottom: 2 }
                }).setOrigin(0, 0).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.debug);

                this.uiContainer.add(textObj);
                this.resourceCountTexts.push(textObj);

                // Move to next line
                currentY += lineHeight;
            }
        }



        sleepUntilMorning(sleepingBag) {
            if (sleepingBag.isOccupied) {
                this.showTempMessage('Sleeping bag is occupied!', 1200);
                return;
            }

            // Check current time before starting sleep
            const currentTime = getCurrentTime(this.playerState);
            console.log(`[Sleep] Starting sleep at ${currentTime.hour}:${currentTime.minute}`);

            // Mark as occupied
            sleepingBag.isOccupied = true;

            // Enable sleeping mode with time acceleration
            this.isSleeping = true;
            this.sleepingBag = sleepingBag;
            this.sleepTimeAcceleration = 25; // 25x faster

            // Show ZZZ above player
            this.sleepZZZ = this.add.text(this.player.x, this.player.y - 60, '💤', { fontSize: '24px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug);

            this.showTempMessage('Sleeping... (time accelerated)', GameConfig.ui.tempMessageDuration);
        }

        stopSleeping() {
            if (this.isSleeping && this.sleepingBag) {
                this.isSleeping = false;
                this.sleepingBag.isOccupied = false;
                this.sleepingBag = null;

                // Remove ZZZ
                if (this.sleepZZZ) {
                    this.sleepZZZ.destroy();
                    this.sleepZZZ = null;
                }

                console.log('[Sleep] Player stopped sleeping');
            }
        }

        showStorageInterface(storageBox) {
            if (this._storageDialog) return;

            const w = this.cameras.main.width;
            const h = this.cameras.main.height;

            // Background overlay - make it larger for communal storage
            const isCommunal = !storageBox.isPersonal;
            const bgHeight = isCommunal ? 450 : 300;
            const bg = this.add.rectangle(w / 2, h / 2, GameConfig.ui.overlayDimensions.width, bgHeight, GameConfig.ui.overlayColor, GameConfig.ui.overlayAlpha).setOrigin(0.5).setDepth(GameConfig.ui.overlayZIndex).setScrollFactor(0);

            // Title
            const title = this.add.text(w / 2, h / 2 - (bgHeight / 2) + 30, `${storageBox.isPersonal ? 'Personal' : 'Communal'} Storage`, { fontSize: '20px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);

            // Storage slots
            const capacity = storageBox.isPersonal ? GameConfig.storage.personalCapacity : GameConfig.storage.communalCapacity;
            const storageSlots = [];
            const storageEmojis = [];

            for (let i = 0; i < capacity; i++) {
                const slotX = w / 2 - 150 + (i % 5) * 60;
                const slotY = h / 2 - (bgHeight / 2) + 80 + Math.floor(i / 5) * 60;

                const slot = this.add.rectangle(slotX, slotY, 50, 50, 0x333333).setOrigin(0.5).setStrokeStyle(2, 0x666666).setDepth(1001).setScrollFactor(0);
                const emoji = this.add.text(slotX, slotY, storageBox.items[i] ? storageBox.items[i].emoji : '', { fontSize: '20px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);

                storageSlots.push(slot);
                storageEmojis.push(emoji);

                // Make slots interactive
                slot.setInteractive({ useHandCursor: true });
                slot.on('pointerdown', () => {
                    this.transferItemFromStorage(i, storageBox);
                });
            }

            // Instructions - position below the slots
            const instructions = this.add.text(w / 2, h / 2 + (bgHeight / 2) - 60, 'Click items to transfer to your inventory\nMove away to close', { fontSize: '12px', fontFamily: 'monospace', color: '#ccc', align: 'center' }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);

            // Close button - position at the bottom
            const closeBtn = this.add.text(w / 2, h / 2 + (bgHeight / 2) - 20, 'Close', { fontSize: '16px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 12, right: 12, top: 6, bottom: 6 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1001).setScrollFactor(0);

            closeBtn.on('pointerdown', () => {
                this.closeStorageInterface();
            });

            // Store references for cleanup and tracking
            this._storageDialog = {
                bg, title, storageSlots, storageEmojis, instructions, closeBtn,
                storageBox, updateSlots: () => this.updateStorageSlots(storageSlots, storageEmojis, storageBox)
            };

            // Initial update
            this._storageDialog.updateSlots();
        }

        updateStorageSlots(storageSlots, storageEmojis, storageBox) {
            // Update storage slots
            for (let i = 0; i < storageSlots.length; i++) {
                const item = storageBox.items[i];
                storageEmojis[i].setText(item ? item.emoji : '');
            }
        }

        transferItemFromStorage(storageSlot, storageBox) {
            // Check if there's an item in this slot
            if (!storageBox.items[storageSlot]) return;

            // Find first empty slot in player inventory
            const playerSlot = this.playerState.inventory.findIndex(item => item === null);
            if (playerSlot === -1) {
                this.showTempMessage('Inventory full!', 1200);
                return;
            }

            // Transfer item
            this.playerState.inventory[playerSlot] = storageBox.items[storageSlot];
            storageBox.items[storageSlot] = null; // Clear the slot instead of splicing

            // Update UI
            this.updatePhaserUI();
            if (this._storageDialog) {
                this._storageDialog.updateSlots();
            }
        }

        transferItemToStorage(storageBox, specificSlot = null) {
            // If specific slot is provided, use that item
            let playerSlot = specificSlot;
            if (playerSlot === null) {
                // Find first item in player inventory
                playerSlot = this.playerState.inventory.findIndex(item => item !== null);
            }

            if (playerSlot === -1 || !this.playerState.inventory[playerSlot]) {
                this.showTempMessage('No items to transfer!', 1200);
                return;
            }

            // Find first empty slot in storage (consistent with villager logic)
            const storageSlot = GameUtils.findEmptySlot(storageBox.items);
            if (storageSlot === -1) {
                this.showTempMessage('Storage full!', 1200);
                return;
            }

            // Transfer item to the first available slot
            storageBox.items[storageSlot] = this.playerState.inventory[playerSlot];
            this.playerState.inventory[playerSlot] = null;

            // Update UI
            this.updatePhaserUI();
            if (this._storageDialog) {
                this._storageDialog.updateSlots();
            }
        }

        closeStorageInterface() {
            if (this._storageDialog) {
                // Destroy all UI elements properly
                const elements = [
                    this._storageDialog.bg,
                    this._storageDialog.title,
                    ...this._storageDialog.storageSlots,
                    ...this._storageDialog.storageEmojis,
                    this._storageDialog.instructions,
                    this._storageDialog.closeBtn
                ];

                elements.forEach(element => {
                    if (element && typeof element.destroy === 'function') {
                        element.destroy();
                    }
                });

                this._storageDialog = null;
            }
        }

        eatFoodFromInventory(slot, item) {
            // Only allow eating if near a burning fire
            const nearbyFire = this.findNearbyFire();
            if (nearbyFire) {
                GameUtils.applyNutrition(this.playerState, item.type);
                this.playerState.inventory[slot] = null;
                this.updatePhaserUI();
                this.showTempMessage(`Ate ${item.type}!`, 1200);
            } else {
                this.showTempMessage('Must be near a burning fire to eat!', 1500);
            }
        }

        findNearbyFire() {
            // Find burning fires with wood within interaction range
            for (const entity of this.entities) {
                if (entity.type === 'fireplace' && entity.isBurning && entity.wood > 0) {
                    const dist = GameUtils.distance(this.playerState.position, entity.position);
                    if (dist <= GameConfig.player.interactionThreshold) {
                        return entity;
                    }
                }
            }
            return null;
        }

        // applyNutrition and getNutrition now use GameUtils methods

        updateDayNightLighting() {
            const t = getCurrentTime(this.playerState);
            const hour = t.hour;

            // Calculate lighting intensity based on time
            let nightIntensity = 0;

            // Dark from 6-9 PM (18-21)
            if (hour >= 18 && hour <= 21) {
                nightIntensity = (hour - 18) / 3; // 0 to 1 over 3 hours
            }
            // Dark from 9 PM to 5 AM (21-5)
            else if (hour >= 21 || hour <= 5) {
                nightIntensity = 1; // Full darkness
            }
            // Light from 5-8 AM (5-8)
            else if (hour >= 5 && hour <= 8) {
                nightIntensity = 1 - ((hour - 5) / 3); // 1 to 0 over 3 hours
            }
            // Day from 8-6 PM (8-18)
            else {
                nightIntensity = 0; // Full daylight
            }

            // Day color: original #2d3748 (dark gray)
            // Night color: darker and more blue
            if (nightIntensity === 0) {
                // Full daylight - use original color
                this.cameras.main.setBackgroundColor(0x2d3748);
            } else {
                // Night - use darker blue color
                // Day: #2d3748 (45, 55, 72) -> Night: #1a1f2e (26, 31, 46)
                const dayR = 45, dayG = 55, dayB = 72;
                const nightR = 26, nightG = 31, nightB = 46;

                // Simple linear interpolation
                const r = Math.round(dayR + (nightR - dayR) * nightIntensity);
                const g = Math.round(dayG + (nightG - dayG) * nightIntensity);
                const b = Math.round(dayB + (nightB - dayB) * nightIntensity);

                const nightColor = (r << 16) | (g << 8) | b;
                this.cameras.main.setBackgroundColor(nightColor);
            }
        }

        applyFireTemperatureEffects(delta) {
            const t = getCurrentTime(this.playerState);
            const isNight = (t.hour < GameConfig.time.gameStartHour || t.hour >= GameConfig.time.nightStartHour);

            // Only apply fire effects at night when temperature would normally decrease
            if (!isNight) return;

            // Consume wood from ALL burning fires globally (not just near player)
            for (const entity of this.entities) {
                if (entity.type === 'fireplace' && entity.isBurning && entity.wood > 0) {
                    // Consume wood over time using hourly rate (0.167 per hour)
                    const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
                    const timeAcceleration = GameConfig.time.secondsPerDay / realSecondsPerGameDay;
                    const gameTimeDelta = (delta / 1000) * timeAcceleration;
                    const gameTimeHours = gameTimeDelta / GameConfig.time.secondsPerHour;

                    const woodToConsume = gameTimeHours * GameConfig.fires.hourlyConsumption;

                    if (woodToConsume >= 1) {
                        entity.wood = Math.max(0, entity.wood - 1);
                        // Update fire visuals
                        this.updateFireVisuals(entity);
                    }
                }
            }

            // Apply temperature effects from nearby fires to player
            for (const entity of this.entities) {
                if (entity.type === 'fireplace' && entity.isBurning && entity.wood > 0) {
                    const dist = GameUtils.distance(this.playerState.position, entity.position);
                    const fireRange = GameConfig.player.fireHeatingRange; // Use config-defined heating range

                    if (dist <= fireRange) {
                        // Calculate temperature gain (same rate as night decay)
                        const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
                        const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
                        const inGameMinutes = delta * inGameMinutesPerMs;

                        const decayRate = GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.time.minutesPerHour);
                        const temperatureGain = decayRate * inGameMinutes;

                        this.playerState.needs.temperature = Math.min(GameConfig.needs.fullValue, this.playerState.needs.temperature + temperatureGain);

                        break; // Only apply from one fire
                    }
                }
            }
        }

        updateAllFireEmojis() {
            // Update emoji for all fires to reflect current wood levels - SINGLE SOURCE OF TRUTH
            for (const entity of this.entities) {
                if (entity.type === 'fireplace') {
                    this.updateFireVisuals(entity);
                }
            }
        }

        updateFireVisuals(fire) {
            // Update fire size and transparency based on wood level
            if (fire._phaserText) {
                const baseSize = 24;
                const maxSize = 48;
                const maxWood = 10;
                const woodLevel = fire.wood || 0;
                const scaleFactor = Math.max(0, Math.min(1, woodLevel / maxWood));
                const scaledSize = baseSize + (maxSize - baseSize) * scaleFactor;
                const transparencyThreshold = 3;
                const alpha = woodLevel <= 0 ? 0 : Math.min(1, woodLevel / transparencyThreshold);
                fire._phaserText.setFontSize(Math.round(scaledSize) + 'px');
                fire._phaserText.setAlpha(alpha);
            }
        }

        updateResourcePropagation() {
            // Calculate current day (reliable, frame-independent)
            const currentDay = Math.floor(this.playerState.currentTime / GameConfig.time.secondsPerDay);

            // Check if we need to propagate (new day and not yet propagated)
            if (currentDay > this.lastPropagationDay) {
                this.lastPropagationDay = currentDay;

                if (window.summaryLoggingEnabled) {
                    console.log(`[Propagation] Starting propagation for day ${currentDay}`);
                }

                // Check each uncollected resource for propagation (both adults and children)
                for (const entity of this.entities) {
                    if (!entity.collected && (GameUtils.ALL_FOOD_TYPES.includes(entity.type) || entity.type === GameConfig.entityTypes.tree)) {
                        // Calculate propagation chance based on global resource count
                        const globalCount = this.getGlobalResourceCount(entity.type);
                        const baseChance = 0.5; // 50% base chance
                        const maxCount = entity.type === GameConfig.entityTypes.tree ? GameConfig.resources.maxCounts.tree : GameConfig.resources.maxCounts.default; // Trees cap at 50, others at 10
                        const finalChance = Math.max(0, baseChance * (1 - globalCount / maxCount)); // Decreases to 0% at max count

                        // Attempt to spawn new resource nearby
                        if (Math.random() < finalChance) {
                            const newPosition = this.findPropagationPosition(entity.position, entity.type);
                            if (newPosition) {
                                const newEntity = {
                                    position: newPosition,
                                    type: entity.type,
                                    emoji: entity.emoji,
                                    collected: false,
                                    isChild: true, // Mark as child
                                    birthTime: this.playerState.currentTime, // Track when born
                                    clusterId: entity.clusterId
                                };

                                // Create visual representation (smaller for children)
                                const fontSize = entity.isChild ? 16 : 22; // Smaller size for children
                                const textObj = this.add.text(newPosition.x, newPosition.y, newEntity.emoji, { fontSize: fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
                                newEntity._phaserText = textObj;
                                this.worldEntities.push(textObj);

                                // Add interaction
                                textObj.setInteractive({ useHandCursor: true });
                                textObj.on('pointerdown', () => {
                                    if (newEntity.collected) return;
                                    const dist = GameUtils.distance(this.playerState.position, newEntity.position);
                                    assert(dist <= GameConfig.player.interactionThreshold, 'Tried to collect resource out of range');
                                    const slot = this.playerState.inventory.findIndex(i => i === null);
                                    if (slot === -1) {
                                        this.showTempMessage('Inventory full!', 1500);
                                        return;
                                    }
                                    newEntity.collected = true;
                                    newEntity.collectedAt = this.playerState.currentTime;
                                    textObj.setVisible(false);
                                    this.playerState.inventory[slot] = { type: newEntity.type, emoji: newEntity.emoji };
                                    this.updatePhaserUI();
                                    this.showTempMessage(`Collected ${newEntity.type}!`, 1200);
                                });

                                this.entities.push(newEntity);

                                if (window.summaryLoggingEnabled) {
                                    console.log(`[Propagation] ${entity.type} spawned child at (${Math.round(newPosition.x)}, ${Math.round(newPosition.y)}) - Global count: ${globalCount + 1}`);
                                }
                            }
                        }
                    }
                }

                if (window.summaryLoggingEnabled) {
                    console.log(`[Propagation] Day ${currentDay} propagation complete`);
                }
            }

            // Check for children becoming adults (2 days = 2 * 86400 seconds) - happens every frame
            for (const entity of this.entities) {
                if (!entity.collected && entity.isChild) {
                    const timeSinceBirth = this.playerState.currentTime - entity.birthTime;
                    if (timeSinceBirth >= 2 * GameConfig.time.secondsPerDay) {
                        entity.isChild = false; // Become adult
                        if (entity._phaserText) {
                            entity._phaserText.setFontSize('22px'); // Grow to adult size
                        }
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Propagation] ${entity.type} child became adult at (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})`);
                        }
                    }
                }
            }
        }

        getGlobalResourceCount(resourceType) {
            return this.entities.filter(e => e.type === resourceType && !e.collected).length;
        }

        findPropagationPosition(originalPosition, resourceType) {
            const maxAttempts = 20;
            const propagationRadius = GameConfig.resources.propagationRadius;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Generate position within propagation radius
                const angle = Math.random() * 2 * Math.PI;
                const dist = Math.random() * propagationRadius;
                const newX = originalPosition.x + Math.cos(angle) * dist;
                const newY = originalPosition.y + Math.sin(angle) * dist;

                // Ensure within world bounds
                if (newX < 0 || newX > GameConfig.world.width || newY < 0 || newY > GameConfig.world.height) {
                    continue;
                }

                // Check if too close to village
                if (this.isTooCloseToVillage({ x: newX, y: newY })) {
                    continue;
                }

                // Check if position is already occupied
                const tooClose = this.entities.some(e =>
                    !e.collected &&
                    GameUtils.distance({ x: newX, y: newY }, e.position) < 20
                );

                if (!tooClose) {
                    return { x: newX, y: newY };
                }
            }

            return null; // Could not find suitable position
        }

        updateAnimalFleeing(delta) {
            // Get all animal entities (rabbit, deer, etc.)
            const animals = this.entities.filter(e =>
                !e.collected &&
                ['rabbit', 'deer', 'squirrel', 'pheasant', 'duck', 'goose', 'hare', 'fox', 'boar', 'elk', 'marten', 'grouse', 'woodcock', 'beaver', 'otter'].includes(e.type)
            );

            // Debug: Log animal count occasionally
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 1% chance per frame when spam enabled
                console.log(`[Animals] Processing ${animals.length} animals with delta ${delta}ms`);
            }

            for (const animal of animals) {
                let isFleeing = false;

                // Check distance to player
                const distToPlayer = GameUtils.distance(this.playerState.position, animal.position);
                if (distToPlayer < GameConfig.technical.distances.animalFleeDistance) { // Flee if player is within 100 pixels
                    this.fleeFromTarget(animal, this.playerState.position, delta);
                    isFleeing = true;
                }

                // Check distance to villagers
                for (const villager of this.villagers) {
                    if (villager && !villager.isDead) {
                        const distToVillager = GameUtils.distance(villager.position, animal.position);
                        if (distToVillager < GameConfig.technical.distances.animalFleeDistance) { // Flee if villager is within 100 pixels
                            this.fleeFromTarget(animal, villager.position, delta);
                            isFleeing = true;
                            break; // Only flee from one threat at a time
                        }
                    }
                }

                // Wander if not fleeing
                if (!isFleeing) {
                    this.updateAnimalWandering(animal, delta);
                }
            }
        }

        fleeFromTarget(animal, targetPosition, delta) {
            // Calculate direction away from target
            const dx = animal.position.x - targetPosition.x;
            const dy = animal.position.y - targetPosition.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                // Move away at fixed animal speed using actual delta time
                const fleeSpeed = GameConfig.animals.moveSpeed * (delta / 1000); // Fixed animal speed, actual delta
                const moveX = (dx / dist) * fleeSpeed;
                const moveY = (dy / dist) * fleeSpeed;

                // Update animal position
                animal.position.x += moveX;
                animal.position.y += moveY;

                // Keep within world bounds
                animal.position.x = Math.max(0, Math.min(GameConfig.world.width, animal.position.x));
                animal.position.y = Math.max(0, Math.min(GameConfig.world.height, animal.position.y));

                // Update visual position
                if (animal._phaserText && animal._phaserText.setPosition) {
                    animal._phaserText.setPosition(animal.position.x, animal.position.y);
                }
            }
        }

        updateAnimalWandering(animal, delta) {
            // Initialize wandering state if not exists
            if (!animal.wanderState) {
                animal.wanderState = {
                    targetPosition: null,
                    wanderSpeed: GameConfig.animals.moveSpeed, // Fixed animal speed
                    changeDirectionTimer: 0,
                    changeDirectionInterval: GameConfig.animals.directionChangeInterval.min + Math.random() * (GameConfig.animals.directionChangeInterval.max - GameConfig.animals.directionChangeInterval.min) // 2-5 seconds
                };
            }

            const wander = animal.wanderState;
            wander.changeDirectionTimer += delta; // Use actual delta time instead of fixed 16ms

            // Change direction periodically or if reached target
            if (wander.changeDirectionTimer >= wander.changeDirectionInterval ||
                (wander.targetPosition && GameUtils.distance(animal.position, wander.targetPosition) < 20)) {

                // Pick new random direction
                const angle = Math.random() * 2 * Math.PI;
                const distance = GameConfig.technical.distances.animalWanderRange.min + Math.random() * (GameConfig.technical.distances.animalWanderRange.max - GameConfig.technical.distances.animalWanderRange.min); // 50-150 pixels away
                wander.targetPosition = {
                    x: animal.position.x + Math.cos(angle) * distance,
                    y: animal.position.y + Math.sin(angle) * distance
                };

                // Keep within world bounds
                wander.targetPosition.x = Math.max(0, Math.min(GameConfig.world.width, wander.targetPosition.x));
                wander.targetPosition.y = Math.max(0, Math.min(GameConfig.world.height, wander.targetPosition.y));

                // Reset timer (speed stays constant)
                wander.changeDirectionTimer = 0;
                wander.changeDirectionInterval = GameConfig.animals.directionChangeInterval.min + Math.random() * (GameConfig.animals.directionChangeInterval.max - GameConfig.animals.directionChangeInterval.min); // 2-5 seconds
            }

            // Move towards target if we have one
            if (wander.targetPosition) {
                const dx = wander.targetPosition.x - animal.position.x;
                const dy = wander.targetPosition.y - animal.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    // Move at wandering speed using actual delta time
                    const moveSpeed = wander.wanderSpeed * (delta / 1000); // Convert to per-frame movement using actual delta
                    const moveX = (dx / dist) * moveSpeed;
                    const moveY = (dy / dist) * moveSpeed;

                    // Update animal position
                    animal.position.x += moveX;
                    animal.position.y += moveY;

                    // Keep within world bounds
                    animal.position.x = Math.max(0, Math.min(GameConfig.world.width, animal.position.x));
                    animal.position.y = Math.max(0, Math.min(GameConfig.world.height, animal.position.y));

                    // Update visual position
                    if (animal._phaserText && animal._phaserText.setPosition) {
                        animal._phaserText.setPosition(animal.position.x, animal.position.y);
                    }
                }
            }
        }
        _calculateVisualTemperatureState(t) {
            // Use config for all thresholds
            const cfg = GameConfig.visualTemperature;
            assert(cfg, 'Missing visualTemperature config');
            // Helper to check hour in range (handles wrap)
            function inRange(hour, range) {
                if (range.start <= range.end) return hour >= range.start && hour <= range.end;
                return hour >= range.start || hour <= range.end;
            }
            // Night: always freezing
            if (inRange(t.hour, cfg.night)) return 'freezing';
            // Dusk/dawn: always cold
            if (inRange(t.hour, cfg.dusk) || inRange(t.hour, cfg.dawn)) return 'cold';
            // Day: moderate/warm, 25% chance to change each hour
            if (inRange(t.hour, cfg.day)) {
                // Only change at hour boundaries
                if (this._visualTempDayState == null || this._visualTempLastDayHour !== t.hour) {
                    this._visualTempLastDayHour = t.hour;
                    // 25% chance to flip state
                    if (this._visualTempDayState == null) {
                        // Start with moderate
                        this._visualTempDayState = 'moderate';
                    } else if (this._visualTempSeededRandom.random() < cfg.dayChangeChance) {
                        this._visualTempDayState = (this._visualTempDayState === 'moderate') ? 'warm' : 'moderate';
                    }
                }
                return this._visualTempDayState;
            }
            // Fallback
            return 'moderate';
        }

        updateWellRegeneration(delta) {
            // Regenerate well water levels over time (1 unit every 2 hours)
            const wells = this.entities.filter(e => e.type === 'well');
            const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
            const gameTimeDelta = (delta / 1000) * timeAcceleration;

            // Convert game time delta to hours
            const hoursDelta = gameTimeDelta / GameConfig.time.secondsPerHour;

            for (const well of wells) {
                // Add water based on hourly refill rate
                const waterToAdd = hoursDelta * GameConfig.wells.hourlyRefill;
                well.waterLevel = Math.min(10, well.waterLevel + waterToAdd);

                // Update well visuals if water level changed
                if (waterToAdd > 0) {
                    this.updateWellVisuals(well);
                }
            }
        }

        updateWellVisuals(well) {
            // Update well size and transparency based on water level
            if (well._phaserText) {
                // Scale from 22px (3 water) to 66px (10 water) - 3x size
                const baseSize = 22;
                const maxSize = 66;
                const minWater = 3;
                const maxWater = 10;
                // Calculate scale factor based on water level
                const waterLevel = well.waterLevel || 0;
                const scaleFactor = Math.max(0, Math.min(1, (waterLevel - minWater) / (maxWater - minWater)));
                const scaledSize = baseSize + (maxSize - baseSize) * scaleFactor;
                // Calculate transparency (fully transparent at 0 water, fully opaque at 5+ water)
                const transparencyThreshold = 5;
                const alpha = waterLevel <= 0 ? 0 : Math.min(1, waterLevel / transparencyThreshold);
                // Update font size and alpha
                well._phaserText.setFontSize(Math.round(scaledSize) + 'px');
                well._phaserText.setAlpha(alpha);
            }
        }

        updateFireConsumption(delta) {
            // Decrement fire wood by 1 every 6 in-game hours (0.167 per hour)
            // Use config values for all timing and limits
            const fires = this.entities.filter(e => e.type === GameConfig.entityTypes.fireplace);

            // Use game time acceleration for fire consumption
            // This ensures fires burn faster when time is accelerated (like during sleep)
            const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
            const gameTimeDelta = (delta / 1000) * timeAcceleration;
            const gameTimeHours = gameTimeDelta / GameConfig.time.secondsPerHour;

            // Apply the hourly consumption rate to accelerated game time
            const woodToConsume = gameTimeHours * GameConfig.fires.hourlyConsumption;

            for (const fire of fires) {
                assert(typeof fire.wood === 'number', 'Fire entity missing wood property');
                if (fire.wood > 0) {
                    fire.wood = Math.max(0, fire.wood - woodToConsume);
                    this.updateFireVisuals(fire);
                }
            }
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
                temperature: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.time.minutesPerHour),
                water: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.water * GameConfig.time.minutesPerHour),
                calories: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.calories * GameConfig.time.minutesPerHour),
                vitamins: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.vitamins * GameConfig.time.minutesPerHour)
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
        let gameStartTime = GameConfig.time.gameStartHour * GameConfig.time.secondsPerHour;
        const totalSeconds = playerState.currentTime || gameStartTime;
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