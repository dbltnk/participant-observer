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

        // Clear logs on page load
        clearLogsOnPageLoad();

        // Start log transmission (every 2 seconds)
        logTransmissionInterval = setInterval(sendLogsToServer, 2000);

        // Start DOM snapshots (every 5 seconds)
        domSnapshotInterval = setInterval(sendDomSnapshot, 5000);

        console.log('[Logging] Logging system initialized');
    }

    // Clear logs when page loads
    function clearLogsOnPageLoad() {
        fetch('http://localhost:3000/clear', {
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

    // === BEGIN: Villager AI System ===
    class Villager {
        constructor(name, campPosition, villagerId) {
            this.name = name;
            this.campPosition = campPosition;
            this.villagerId = villagerId;

            // State management
            this.state = 'SLEEPING';
            this.stateTimer = 0;

            // Position and movement
            this.position = { ...campPosition };
            this.targetPosition = null;
            this.moveSpeed = GameConfig.villager.moveSpeed;

            // Needs system (same as player)
            this.needs = {
                temperature: GameConfig.needs.fullValue,
                water: GameConfig.needs.fullValue,
                calories: GameConfig.needs.fullValue,
                vitamins: new Array(GameConfig.needs.vitaminCount).fill(GameConfig.needs.fullValue)
            };

            // Inventory (same as player)
            this.inventory = new Array(GameConfig.player.inventorySize).fill(null);
            this.selectedSlot = 0;

            // Memory system for resource locations
            this.memory = {
                knownFoodLocations: [], // Array of {x, y, resourceType, lastSeen}
                knownWoodLocations: [],
                lastKnownPosition: null
            };

            // Daily variance for needs (different per villager)
            this.dailyDecay = this.generateDailyDecay();

            // Visual representation
            this.phaserText = null;
            this.nameText = null;
            this.healthEmoji = '😊';

            // State-specific data
            this.currentTarget = null;
            this.foragingAttempts = 0;
            this.maxForagingAttempts = 10;

            // Goal persistence system
            this.goalTimer = 0;
            this.goalPersistenceTime = 10000; // 10 seconds to stick with current goal
            this.randomDirection = Math.random() * 2 * Math.PI; // Random direction for exploration
            this.explorationTarget = null; // Current exploration target position

            // Camp leaving system
            this.isLeavingCamp = false;
            this.leaveCampTarget = null;

            // Daily routine system
            this.wakeUpTime = 8 + Math.random(); // Random wake up between 8:00-9:00
            this.dailyTasks = {
                woodTrips: Math.floor(Math.random() * 2) + 1, // 1-2 wood trips per day
                foodTrips: Math.floor(Math.random() * 2) + 3, // 3-4 food trips per day
                waterTrips: Math.floor(Math.random() * 2) + 1  // 1-2 water trips per day
            };
            this.completedTasks = {
                woodTrips: 0,
                foodTrips: 0,
                waterTrips: 0
            };
            this.currentTask = null; // 'wood', 'food', 'water', or null
            this.lastTaskReset = 0; // Track when we last reset daily tasks

            // Game entities reference (will be set by update method)
            this.gameEntities = null;

            console.log(`[Villager] Created villager ${name} at camp ${villagerId}`);
        }

        generateDailyDecay() {
            // Generate unique daily decay rates for this villager
            const variance = GameConfig.needsVariance;
            return {
                temperature: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.needs.minutesPerHour) * (1 + (Math.random() - 0.5) * variance),
                water: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.water * GameConfig.needs.minutesPerHour) * (1 + (Math.random() - 0.5) * variance),
                calories: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.calories * GameConfig.needs.minutesPerHour) * (1 + (Math.random() - 0.5) * variance),
                vitamins: GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.vitamins * GameConfig.needs.minutesPerHour) * (1 + (Math.random() - 0.5) * variance)
            };
        }

        update(deltaTime, gameTime, entities, storageBoxes) {
            // Store reference to game entities
            this.gameEntities = entities;

            // Update needs
            this.updateNeeds(deltaTime, gameTime);

            // Update state based on time
            this.updateState(gameTime, deltaTime);

            // Execute current state behavior
            this.executeCurrentState(deltaTime, entities, storageBoxes);

            // Update visual representation
            this.updateVisuals();

            // Check for death
            return this.checkDeath();
        }

        updateNeeds(deltaTime, gameTime) {
            const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
            const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
            const inGameMinutes = deltaTime * inGameMinutesPerMs;

            const t = this.getCurrentTime(gameTime);
            const isNight = (t.hour < GameConfig.time.gameStartHour || t.hour >= GameConfig.time.nightStartHour);

            // Apply decay based on config values
            if (isNight) this.needs.temperature -= this.dailyDecay.temperature * inGameMinutes;
            this.needs.water -= this.dailyDecay.water * inGameMinutes;
            this.needs.calories -= this.dailyDecay.calories * inGameMinutes;

            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] -= this.dailyDecay.vitamins * inGameMinutes;
            }

            // Clamp values to valid range
            this.needs.temperature = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.temperature));
            this.needs.water = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.water));
            this.needs.calories = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.calories));

            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] = Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, this.needs.vitamins[i]));
            }
        }

        updateState(gameTime, deltaTime) {
            const t = this.getCurrentTime(gameTime);
            const hour = t.hour;

            // Reset daily tasks at 8 AM each day
            if (hour >= 8 && this.lastTaskReset < 8) {
                this.resetDailyTasks();
                this.lastTaskReset = hour;
            }

            // State transitions based on time and needs
            if (this.state === 'SLEEPING') {
                // Wake up at individual wake up time
                if (hour >= this.wakeUpTime) {
                    // Free the sleeping bag
                    if (this.sleepingBag) {
                        this.sleepingBag.isOccupied = false;
                        this.sleepingBag = null;
                    }

                    this.state = 'FORAGING';
                    this.stateTimer = 0; // Reset timer
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} woke up at ${this.wakeUpTime.toFixed(1)} and started foraging`);
                    }
                }
            } else if (this.state === 'FORAGING') {
                // Return to camp if needs are critical, inventory is full, or it's after 18:00
                const shouldReturn = hour >= 18 ||
                    this.needs.calories < 50 ||
                    this.needs.water < 50 ||
                    this.needs.temperature < 50 ||
                    this.isInventoryFull();

                if (shouldReturn) {
                    this.state = 'RETURNING';
                    this.stateTimer = 0; // Reset timer
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} returning to camp (time: ${hour}, needs: ${this.needs.calories.toFixed(0)}/${this.needs.water.toFixed(0)}/${this.needs.temperature.toFixed(0)}, inventory full: ${this.isInventoryFull()})`);
                    }
                }
            } else if (this.state === 'RETURNING' && this.isAtCamp()) {
                this.state = 'EATING';
                this.stateTimer = 0; // Reset timer
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} arrived at camp and is eating`);
                }
            } else if (this.state === 'EATING' && this.needs.calories > 80 && this.stateTimer > 5000) { // 5 second cooldown
                // Ensure villager is hydrated before going to sleep
                if (this.needs.water < 70) {
                    this.drinkFromWells();
                }

                this.state = 'SLEEPING';
                this.stateTimer = 0; // Reset timer
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} finished eating and went to sleep`);
                }
            }

            // Increment state timer
            this.stateTimer += deltaTime; // Use actual deltaTime

            // Debug: Log state changes occasionally (behind log spam gate)
            if (window.summaryLoggingEnabled && Math.random() < 0.01) { // 1% chance per frame when spam enabled
                console.log(`[Villager] ${this.name} state: ${this.state}, hour: ${hour}, timer: ${Math.round(this.stateTimer)}, needs: T${Math.round(this.needs.temperature)} W${Math.round(this.needs.water)} C${Math.round(this.needs.calories)}`);
            }
        }

        executeCurrentState(deltaTime, entities, storageBoxes) {
            switch (this.state) {
                case 'FORAGING':
                    // First, move away from camp if we're too close
                    if (this.isAtCamp() && !this.isLeavingCamp) {
                        this.startLeavingCamp();
                    }

                    if (this.isLeavingCamp) {
                        this.continueLeavingCamp(deltaTime);
                    } else {
                        this.forage(entities, deltaTime);
                    }
                    break;
                case 'RETURNING':
                    this.moveTowards(this.campPosition, deltaTime);
                    break;
                case 'EATING':
                    this.eatAndDrink(storageBoxes);
                    break;
                case 'SLEEPING':
                    this.sleep();
                    break;
            }
        }

        forage(entities, deltaTime) {
            // Increment goal timer
            this.goalTimer += deltaTime;

            // Check for wells while foraging and drink if thirsty
            if (this.needs.water < 70) {
                this.drinkFromWells();
            }

            // Debug logging for forage method entry
            if (window.summaryLoggingEnabled && Math.random() < 0.02) { // 2% chance per frame when spam enabled
                console.log(`[Villager] ${this.name} forage: currentTarget=${this.currentTarget ? this.currentTarget.type : 'none'}, explorationTarget=${this.explorationTarget ? 'set' : 'none'}, goalTimer=${Math.round(this.goalTimer)}`);
            }

            // Check if we have a current target and stick with it for goalPersistenceTime
            if (this.currentTarget && !this.currentTarget.collected && this.goalTimer < this.goalPersistenceTime) {
                // Move towards current target
                this.moveTowards(this.currentTarget.position, deltaTime);

                // Check if we're close enough to collect
                if (distance(this.position, this.currentTarget.position) <= GameConfig.player.interactionThreshold) {
                    this.collectResource(this.currentTarget);
                    this.currentTarget = null;
                    this.goalTimer = 0; // Reset timer after collecting
                }
            } else if (this.explorationTarget && this.goalTimer < this.goalPersistenceTime) {
                // Move towards exploration target
                this.moveTowards(this.explorationTarget, deltaTime);

                // If we reached exploration target, reset
                if (distance(this.position, this.explorationTarget) < 20) {
                    this.explorationTarget = null;
                    this.goalTimer = 0;
                }
            } else {
                // Find new target or exploration direction
                this.findNewForagingTarget(entities);
            }

            // If we can't find anything or inventory is full, return to camp
            if (this.isInventoryFull() || this.foragingAttempts >= this.maxForagingAttempts) {
                this.state = 'RETURNING';
                this.foragingAttempts = 0;
                this.goalTimer = 0;
            }

            // Debug: Log movement occasionally (behind log spam gate)
            if (window.summaryLoggingEnabled && Math.random() < 0.05) { // 5% chance per frame when spam enabled
                console.log(`[Villager] ${this.name} foraging at (${Math.round(this.position.x)}, ${Math.round(this.position.y)}), target: ${this.currentTarget ? this.currentTarget.type : 'none'}, goalTimer: ${Math.round(this.goalTimer)}, attempts: ${this.foragingAttempts}`);
            }
        }

        findNewForagingTarget(entities) {
            // Reset goal timer when finding new target
            this.goalTimer = 0;

            // Debug logging
            if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance per frame when spam enabled
                console.log(`[Villager] ${this.name} findNewForagingTarget: checking ${entities.length} entities`);
            }

            // First check memory for known locations
            const knownTarget = this.findNearestKnownFood(entities);
            if (knownTarget) {
                this.currentTarget = knownTarget;
                this.explorationTarget = null; // Clear exploration target
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} using known target: ${knownTarget.type}`);
                }
                return;
            }

            // Explore new area if no known locations
            const foundTarget = this.exploreNewArea(entities);
            if (!foundTarget) {
                // No resources found, set exploration target in random direction
                this.setExplorationTarget();
                if (window.summaryLoggingEnabled && Math.random() < 0.05) { // 5% chance per frame when spam enabled
                    console.log(`[Villager] ${this.name} no targets found, setting exploration target`);
                }
            }
        }

        findNearestKnownFood(entities) {
            let nearest = null;
            let nearestDistance = Infinity;

            for (const location of this.memory.knownFoodLocations) {
                // Find if this resource still exists and isn't collected
                const entity = entities.find(e =>
                    e.position.x === location.x &&
                    e.position.y === location.y &&
                    e.type === location.resourceType &&
                    !e.collected
                );

                if (entity) {
                    const dist = distance(this.position, entity.position);
                    if (dist < nearestDistance && dist <= GameConfig.villager.explorationRadius) {
                        nearest = entity;
                        nearestDistance = dist;
                    }
                }
            }

            return nearest;
        }

        exploreNewArea(entities) {
            // Find nearest uncollected resource within exploration radius
            let nearest = null;
            let nearestDistance = Infinity;
            let validEntitiesFound = 0;

            for (const entity of entities) {
                if (this.isValidForagingTarget(entity)) {
                    validEntitiesFound++;
                    const dist = distance(this.position, entity.position);
                    if (dist < nearestDistance && dist <= GameConfig.villager.explorationRadius) {
                        nearest = entity;
                        nearestDistance = dist;
                    }
                }
            }

            // Debug logging
            if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance per frame when spam enabled
                console.log(`[Villager] ${this.name} exploreNewArea: found ${validEntitiesFound} valid entities, nearest at ${nearestDistance ? Math.round(nearestDistance) : 'none'} distance, exploration radius: ${GameConfig.villager.explorationRadius}`);
            }

            if (nearest) {
                this.currentTarget = nearest;
                this.explorationTarget = null; // Clear exploration target
                // Add to memory
                this.addToMemory(nearest);
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} found target: ${nearest.type} at distance ${Math.round(nearestDistance)}`);
                }
                return true; // Found a target
            } else {
                // No targets found, increment attempts
                this.foragingAttempts++;
                if (window.summaryLoggingEnabled && Math.random() < 0.05) { // 5% chance per frame when spam enabled
                    console.log(`[Villager] ${this.name} no targets found, attempts: ${this.foragingAttempts}`);
                }
                return false; // No target found
            }
        }

        isValidForagingTarget(entity) {
            return !entity.collected &&
                ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'].includes(entity.type);
        }

        addToMemory(entity) {
            const memoryEntry = {
                x: entity.position.x,
                y: entity.position.y,
                resourceType: entity.type,
                lastSeen: Date.now()
            };

            // Add to appropriate memory list
            if (entity.type === 'tree') {
                this.addToMemoryList(this.memory.knownWoodLocations, memoryEntry);
            } else {
                this.addToMemoryList(this.memory.knownFoodLocations, memoryEntry);
            }
        }

        addToMemoryList(memoryList, entry) {
            // Check if already in memory
            const existing = memoryList.find(m =>
                m.x === entry.x && m.y === entry.y && m.resourceType === entry.resourceType
            );

            if (!existing) {
                memoryList.push(entry);

                // Limit memory capacity
                if (memoryList.length > GameConfig.villager.memoryCapacity) {
                    memoryList.shift(); // Remove oldest memory
                }
            } else {
                // Update last seen time
                existing.lastSeen = entry.lastSeen;
            }
        }

        collectResource(entity) {
            // Check if we can carry it
            const slot = this.inventory.findIndex(i => i === null);
            if (slot === -1) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} inventory full, can't collect ${entity.type}`);
                }
                return false;
            }

            // Success chance based on foraging efficiency
            if (Math.random() < GameConfig.villager.foragingEfficiency) {
                this.inventory[slot] = { type: entity.type, emoji: entity.emoji };
                entity.collected = true;
                if (entity._phaserText) entity._phaserText.setVisible(false);

                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} collected ${entity.type}`);
                }
                return true;
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} failed to collect ${entity.type}`);
                }
                return false;
            }
        }

        moveTowards(target, deltaTime) {
            if (!target) return;

            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                const speed = this.moveSpeed * (deltaTime / 1000);
                const moveX = (dx / distance) * speed;
                const moveY = (dy / distance) * speed;

                this.position.x += moveX;
                this.position.y += moveY;

                // Update visual position
                if (this.phaserText) {
                    this.phaserText.setPosition(this.position.x, this.position.y);
                }
                if (this.nameText) {
                    this.nameText.setPosition(this.position.x, this.position.y - 30);
                }
                if (this.stateText) {
                    this.stateText.setPosition(this.position.x, this.position.y + 30);
                }
                if (this.rangeIndicator) {
                    this.rangeIndicator.setPosition(this.position.x, this.position.y);
                }

                // Debug: Log movement occasionally (behind log spam gate)
                if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance per frame when spam enabled
                    console.log(`[Villager] ${this.name} moving to (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
                }
            }
        }

        eatAndDrink(storageBoxes) {
            // Find personal storage box
            const personalStorage = storageBoxes.find(box =>
                box.isPersonal && box.villagerId === this.villagerId
            );

            // Eat from inventory first
            this.eatFromInventory();

            // Eat from personal storage if needed
            if (personalStorage && this.needs.calories < 80) {
                this.eatFromStorage(personalStorage);
            }

            // Drink from wells if needed (lower threshold for better hydration)
            if (this.needs.water < 70) {
                this.drinkFromWells();
            }

            // Restock fire
            this.restockFire();

            // Store excess resources
            this.storeExcessResources(storageBoxes);
        }

        eatFromInventory() {
            for (let i = 0; i < this.inventory.length; i++) {
                const item = this.inventory[i];
                if (item && this.isFood(item.type)) {
                    // Check if we need to cook the food first
                    if (item.type.startsWith('cooked_')) {
                        // Already cooked, apply nutrition
                        this.applyNutrition(item.type);
                        this.inventory[i] = null;
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.name} ate cooked ${item.type.replace('cooked_', '')}`);
                        }
                        break;
                    } else {
                        // Raw food - try to cook it first
                        const cookedFood = this.cookFood(item.type);
                        if (cookedFood) {
                            this.inventory[i] = cookedFood;
                            this.applyNutrition(cookedFood.type);
                            this.inventory[i] = null;
                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.name} cooked and ate ${item.type}`);
                            }
                            break;
                        } else {
                            // Can't cook, eat raw (less nutrition)
                            this.applyNutrition(item.type, 0.5); // Half nutrition for raw food
                            this.inventory[i] = null;
                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.name} ate raw ${item.type}`);
                            }
                            break;
                        }
                    }
                }
            }
        }

        cookFood(foodType) {
            // Find a burning fire nearby
            const nearbyFire = this.findNearbyBurningFire();
            if (nearbyFire) {
                const cookedEmojis = {
                    'blackberry': '🍇',
                    'mushroom': '🍄',
                    'herb': '🌿',
                    'rabbit': '🍖',
                    'deer': '🥩'
                };
                return { type: `cooked_${foodType}`, emoji: cookedEmojis[foodType] || '🍽️' };
            }
            return null; // Can't cook without fire
        }

        findNearbyBurningFire() {
            // Find a burning fire within interaction range
            const fires = this.gameEntities ? this.gameEntities.filter(e => e.type === 'fireplace' && e.isBurning) : [];
            for (const fire of fires) {
                if (distance(this.position, fire.position) <= GameConfig.player.interactionThreshold) {
                    return fire;
                }
            }
            return null;
        }

        applyNutrition(foodType, multiplier = 1.0) {
            const nutrition = this.getNutrition(foodType);
            this.needs.calories = Math.min(GameConfig.needs.fullValue, this.needs.calories + nutrition.calories * multiplier);

            // Apply vitamins
            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] = Math.min(GameConfig.needs.fullValue, this.needs.vitamins[i] + nutrition.vitamins[i] * multiplier);
            }
        }

        getNutrition(foodType) {
            const baseType = foodType.replace('cooked_', '');
            const nutrition = {
                'blackberry': { calories: 50, vitamins: [0, 0, 0, 1, 0] },
                'mushroom': { calories: 30, vitamins: [0, 0, 1, 0, 0] },
                'herb': { calories: 20, vitamins: [1, 0, 0, 0, 0] },
                'rabbit': { calories: 200, vitamins: [0, 1, 0, 0, 0] },
                'deer': { calories: 500, vitamins: [0, 1, 0, 0, 1] }
            };
            return nutrition[baseType] || { calories: 0, vitamins: [0, 0, 0, 0, 0] };
        }

        eatFromStorage(storageBox) {
            for (let i = 0; i < storageBox.items.length; i++) {
                const item = storageBox.items[i];
                if (item && this.isFood(item.type)) {
                    if (item.type.startsWith('cooked_')) {
                        this.applyNutrition(item.type);
                        storageBox.items.splice(i, 1);
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.name} ate cooked ${item.type.replace('cooked_', '')} from storage`);
                        }
                        break;
                    } else {
                        // Try to cook raw food
                        const cookedFood = this.cookFood(item.type);
                        if (cookedFood) {
                            storageBox.items[i] = cookedFood;
                            this.applyNutrition(cookedFood.type);
                            storageBox.items.splice(i, 1);
                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.name} cooked and ate ${item.type} from storage`);
                            }
                            break;
                        } else {
                            // Eat raw
                            this.applyNutrition(item.type, 0.5);
                            storageBox.items.splice(i, 1);
                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.name} ate raw ${item.type} from storage`);
                            }
                            break;
                        }
                    }
                }
            }
        }

        drinkFromWells() {
            // Find nearest well within interaction range
            const nearestWell = this.findNearestWell();
            if (nearestWell && distance(this.position, nearestWell.position) <= GameConfig.player.interactionThreshold) {
                this.needs.water = GameConfig.needs.fullValue;
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} drank from well`);
                }
            }
        }

        findNearestWell() {
            // Find nearest well within interaction range
            const wells = this.gameEntities ? this.gameEntities.filter(e => e.type === 'well') : [];
            let nearestWell = null;
            let nearestDistance = Infinity;

            for (const well of wells) {
                const dist = distance(this.position, well.position);
                if (dist < nearestDistance && dist <= GameConfig.player.interactionThreshold) {
                    nearestWell = well;
                    nearestDistance = dist;
                }
            }

            return nearestWell;
        }

        restockFire() {
            // Find wood in inventory and add to fire
            const woodSlot = this.inventory.findIndex(item => item && item.type === 'tree');
            if (woodSlot !== -1) {
                // Find fireplace at this camp
                const campFire = this.findCampFire();
                if (campFire && campFire.wood < campFire.maxWood) {
                    campFire.wood++;
                    campFire.isBurning = true;
                    this.inventory[woodSlot] = null;
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} added wood to fire`);
                    }
                }
            }
        }

        findCampFire() {
            // Find fireplace at this camp
            const fires = this.gameEntities ? this.gameEntities.filter(e => e.type === 'fireplace') : [];
            for (const fire of fires) {
                if (distance(this.campPosition, fire.position) < 50) { // Within camp radius
                    return fire;
                }
            }
            return null;
        }

        storeExcessResources(storageBoxes) {
            // Find personal storage box
            const personalStorage = storageBoxes.find(box =>
                box.isPersonal && box.villagerId === this.villagerId
            );

            // Store items in personal storage first
            for (let i = 0; i < this.inventory.length; i++) {
                const item = this.inventory[i];
                if (item && personalStorage && personalStorage.items.length < personalStorage.capacity) {
                    personalStorage.items.push(item);
                    this.inventory[i] = null;
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} stored ${item.type} in personal storage`);
                    }
                }
            }

            // Store remaining items in communal storage
            const communalStorage = storageBoxes.find(box => !box.isPersonal);
            for (let i = 0; i < this.inventory.length; i++) {
                const item = this.inventory[i];
                if (item && communalStorage && communalStorage.items.length < communalStorage.capacity) {
                    communalStorage.items.push(item);
                    this.inventory[i] = null;
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} stored ${item.type} in communal storage`);
                    }
                }
            }
        }

        sleep() {
            // Find and move to sleeping bag at this camp
            const sleepingBag = this.findCampSleepingBag();
            if (sleepingBag && !sleepingBag.isOccupied) {
                // Move towards sleeping bag
                this.moveTowards(sleepingBag.position, 16); // Use small deltaTime for smooth movement

                // If we're close enough to the sleeping bag, occupy it
                if (distance(this.position, sleepingBag.position) <= 10) {
                    sleepingBag.isOccupied = true;
                    this.sleepingBag = sleepingBag;
                }
            }

            // Restore some needs while sleeping
            this.needs.temperature = Math.min(GameConfig.needs.fullValue, this.needs.temperature + 10);

            // Emergency drinking if critically thirsty while sleeping
            if (this.needs.water < 30) {
                this.drinkFromWells();
            }
        }

        findCampSleepingBag() {
            // Find sleeping bag at this camp
            const sleepingBags = this.gameEntities ? this.gameEntities.filter(e => e.type === 'sleeping_bag') : [];
            for (const bag of sleepingBags) {
                if (distance(this.campPosition, bag.position) < 50) { // Within camp radius
                    return bag;
                }
            }
            return null;
        }

        isAtCamp() {
            return distance(this.position, this.campPosition) < 50;
        }

        setExplorationTarget() {
            // Set a new exploration target in the current random direction
            const distance = 150 + Math.random() * 100; // 150-250 pixels away
            this.explorationTarget = {
                x: this.position.x + Math.cos(this.randomDirection) * distance,
                y: this.position.y + Math.sin(this.randomDirection) * distance
            };

            // Keep exploration target within world bounds
            this.explorationTarget.x = Math.max(0, Math.min(GameConfig.world.width, this.explorationTarget.x));
            this.explorationTarget.y = Math.max(0, Math.min(GameConfig.world.height, this.explorationTarget.y));

            // Debug: Log exploration target (behind log spam gate)
            if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance per frame when spam enabled
                console.log(`[Villager] ${this.name} set exploration target to (${Math.round(this.explorationTarget.x)}, ${Math.round(this.explorationTarget.y)})`);
            }
        }

        startLeavingCamp() {
            // Set a target 100 pixels away from camp in a random direction
            const angle = Math.random() * 2 * Math.PI;
            const targetX = this.campPosition.x + Math.cos(angle) * 100;
            const targetY = this.campPosition.y + Math.sin(angle) * 100;

            this.leaveCampTarget = { x: targetX, y: targetY };
            this.isLeavingCamp = true;

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.name} starting to leave camp, target: (${Math.round(targetX)}, ${Math.round(targetY)})`);
            }
        }

        continueLeavingCamp(deltaTime) {
            if (!this.leaveCampTarget) {
                this.isLeavingCamp = false;
                return;
            }

            // Move towards the leave camp target
            this.moveTowards(this.leaveCampTarget, deltaTime);

            // Check if we've reached the target or are far enough from camp
            const distanceToTarget = distance(this.position, this.leaveCampTarget);
            const distanceFromCamp = distance(this.position, this.campPosition);

            if (distanceToTarget < 20 || distanceFromCamp > 80) {
                // We've successfully left camp
                this.isLeavingCamp = false;
                this.leaveCampTarget = null;
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} successfully left camp, now at (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
                }
            }
        }

        leaveCamp(deltaTime) {
            // Legacy method - now handled by startLeavingCamp and continueLeavingCamp
            if (!this.isLeavingCamp) {
                this.startLeavingCamp();
            }
            this.continueLeavingCamp(deltaTime);
        }

        isInventoryFull() {
            return this.inventory.every(item => item !== null);
        }

        isFood(type) {
            return ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer'].includes(type);
        }

        getCurrentTime(gameTime) {
            const totalSeconds = gameTime;
            const hour = Math.floor((totalSeconds % GameConfig.time.secondsPerDay) / GameConfig.time.secondsPerHour);
            const minute = Math.floor((totalSeconds % GameConfig.time.secondsPerHour) / GameConfig.time.secondsPerMinute);
            return { hour, minute };
        }

        updateVisuals() {
            // Update positions for all visual elements
            if (this.phaserText) {
                this.phaserText.setPosition(this.position.x, this.position.y);
            }

            // Update health emoji based on needs
            const avgNeeds = (this.needs.temperature + this.needs.water + this.needs.calories +
                this.needs.vitamins.reduce((a, b) => a + b, 0) / this.needs.vitamins.length) / 4;

            if (avgNeeds > 80) this.healthEmoji = '😊';
            else if (avgNeeds > 50) this.healthEmoji = '😐';
            else if (avgNeeds > 20) this.healthEmoji = '😟';
            else this.healthEmoji = '😵';

            if (this.nameText) {
                this.nameText.setPosition(this.position.x, this.position.y - 30);
                this.nameText.setText(`${this.name} ${this.healthEmoji}`);
            }

            // Update state text with action and task emojis (only show if debug enabled)
            if (this.stateText) {
                this.stateText.setPosition(this.position.x, this.position.y + 30);
                if (window.villagerDebugEnabled) {
                    // Select next task if we don't have one
                    if (!this.currentTask && this.state === 'FORAGING') {
                        this.selectNextTask();
                    }

                    const taskEmoji = this.currentTask ? this.getTaskEmoji(this.currentTask) : '🔍';
                    const actionEmoji = this.state === 'FORAGING' ? '🏃' :
                        this.state === 'RETURNING' ? '🏠' :
                            this.state === 'EATING' ? '🍽️' : '😴';

                    this.stateText.setText(`${actionEmoji} ${this.state} ${taskEmoji}`);
                    this.stateText.setVisible(true);
                } else {
                    this.stateText.setVisible(false);
                }
            }

            // Update inventory display if debug enabled
            if (this.inventoryText) {
                this.inventoryText.setPosition(this.position.x, this.position.y + 45);
                if (window.villagerDebugEnabled) {
                    const inventory = this.getInventoryDisplay();
                    this.inventoryText.setText(inventory || '∅');
                    this.inventoryText.setVisible(true);
                } else {
                    this.inventoryText.setVisible(false);
                }
            }

            // Update range indicator
            if (this.rangeIndicator) {
                this.rangeIndicator.setPosition(this.position.x, this.position.y);
                this.rangeIndicator.setVisible(window.villagerDebugEnabled || false);
            }
        }

        checkDeath() {
            const n = this.needs;

            // Check for death conditions and log specific cause
            if (n.temperature <= 0) {
                console.log(`[Villager] ${this.name} died from cold! Final stats: T${Math.round(n.temperature)} W${Math.round(n.water)} C${Math.round(n.calories)} V[${n.vitamins.map(v => Math.round(v)).join(',')}]`);
                return true;
            }

            if (n.water <= 0) {
                console.log(`[Villager] ${this.name} died from dehydration! Final stats: T${Math.round(n.temperature)} W${Math.round(n.water)} C${Math.round(n.calories)} V[${n.vitamins.map(v => Math.round(v)).join(',')}]`);
                return true;
            }

            if (n.calories <= 0) {
                console.log(`[Villager] ${this.name} died from starvation! Final stats: T${Math.round(n.temperature)} W${Math.round(n.water)} C${Math.round(n.calories)} V[${n.vitamins.map(v => Math.round(v)).join(',')}]`);
                return true;
            }

            for (let i = 0; i < n.vitamins.length; i++) {
                if (n.vitamins[i] <= 0) {
                    const vitaminName = String.fromCharCode(65 + i); // A, B, C, D, E
                    console.log(`[Villager] ${this.name} died from vitamin ${vitaminName} deficiency! Final stats: T${Math.round(n.temperature)} W${Math.round(n.water)} C${Math.round(n.calories)} V[${n.vitamins.map(v => Math.round(v)).join(',')}]`);
                    return true;
                }
            }

            return false;
        }

        createVisuals(scene) {
            // Create villager emoji
            this.phaserText = scene.add.text(
                this.position.x,
                this.position.y,
                '👤',
                { fontSize: '24px', fontFamily: 'Arial', color: '#fff' }
            ).setOrigin(0.5);

            // Create name and health display
            this.nameText = scene.add.text(
                this.position.x,
                this.position.y - 30,
                `${this.name} ${this.healthEmoji}`,
                { fontSize: '12px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#000', padding: { left: 4, right: 4, top: 2, bottom: 2 } }
            ).setOrigin(0.5);

            // Add state indicator
            this.stateText = scene.add.text(
                this.position.x,
                this.position.y + 30,
                this.state,
                { fontSize: '10px', fontFamily: 'monospace', color: '#aaa', backgroundColor: '#000', padding: { left: 2, right: 2, top: 1, bottom: 1 } }
            ).setOrigin(0.5);

            // Add inventory display
            this.inventoryText = scene.add.text(
                this.position.x,
                this.position.y + 45,
                '∅',
                { fontSize: '8px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#000', padding: { left: 2, right: 2, top: 1, bottom: 1 } }
            ).setOrigin(0.5);

            // Add exploration radius indicator (semi-transparent circle)
            this.rangeIndicator = scene.add.circle(
                this.position.x,
                this.position.y,
                GameConfig.villager.explorationRadius,
                0x00ff00,
                0.1 // Very transparent
            ).setOrigin(0.5);

            return [this.phaserText, this.nameText, this.stateText, this.inventoryText, this.rangeIndicator];
        }

        resetDailyTasks() {
            this.dailyTasks = {
                woodTrips: Math.floor(Math.random() * 2) + 1, // 1-2 wood trips per day
                foodTrips: Math.floor(Math.random() * 2) + 3, // 3-4 food trips per day
                waterTrips: Math.floor(Math.random() * 2) + 1  // 1-2 water trips per day
            };
            this.completedTasks = {
                woodTrips: 0,
                foodTrips: 0,
                waterTrips: 0
            };
            this.currentTask = null;
            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.name} daily tasks reset: ${this.dailyTasks.woodTrips} wood, ${this.dailyTasks.foodTrips} food, ${this.dailyTasks.waterTrips} water`);
            }
        }

        selectNextTask() {
            // Priority: water if low, then food, then wood
            if (this.needs.water < 70 && this.completedTasks.waterTrips < this.dailyTasks.waterTrips) {
                this.currentTask = 'water';
                return;
            }

            if (this.completedTasks.foodTrips < this.dailyTasks.foodTrips) {
                this.currentTask = 'food';
                return;
            }

            if (this.completedTasks.woodTrips < this.dailyTasks.woodTrips) {
                this.currentTask = 'wood';
                return;
            }

            // All tasks completed, just forage for food
            this.currentTask = 'food';
        }

        getTaskEmoji(task) {
            const emojis = {
                'wood': '🪵',
                'food': '🍎',
                'water': '💧'
            };
            return emojis[task] || '❓';
        }

        getInventoryDisplay() {
            return this.inventory.filter(item => item !== null).map(item => {
                // Extract the emoji from the item object (item.emoji) or fall back to type-based emojis
                if (item.emoji) {
                    return item.emoji;
                }

                // Fallback to type-based emojis if no emoji property
                const emojis = {
                    'blackberry': '🫐',
                    'mushroom': '🍄',
                    'herb': '🌿',
                    'rabbit': '🐰',
                    'deer': '🦌',
                    'tree': '🌲'
                };
                return emojis[item.type || item] || '❓'; // Return emoji for type or fallback
            }).join('');
        }

        destroy() {
            // Free sleeping bag if occupied
            if (this.sleepingBag) {
                this.sleepingBag.isOccupied = false;
                this.sleepingBag = null;
            }

            if (this.phaserText) this.phaserText.destroy();
            if (this.nameText) this.nameText.destroy();
            if (this.stateText) this.stateText.destroy();
            if (this.inventoryText) this.inventoryText.destroy();
            if (this.rangeIndicator) this.rangeIndicator.destroy();
        }
    }

    // Villager name generator
    const villagerNames = [
        'Alaric', 'Brigid', 'Cormac', 'Deirdre', 'Eamon', 'Fiona', 'Gareth', 'Helena',
        'Ivar', 'Jocelyn', 'Kieran', 'Luna', 'Mael', 'Niamh', 'Oisin', 'Pádraig',
        'Quinn', 'Róisín', 'Seamus', 'Tara', 'Ulf', 'Vera', 'Wynn', 'Yara',
        'Zara', 'Aiden', 'Brenna', 'Cian', 'Dara', 'Eira', 'Finn', 'Gwen',
        'Hale', 'Iona', 'Jace', 'Kara', 'Liam', 'Maya', 'Nash', 'Orla',
        'Pax', 'Raven', 'Sage', 'Teagan', 'Uma', 'Vale', 'Wren', 'Xander',
        'Yuki', 'Zane', 'Aria', 'Blake', 'Cora', 'Dax', 'Echo', 'Faye',
        'Gray', 'Haven', 'Indigo', 'Jade', 'Kai', 'Lark', 'Moss', 'Nova',
        'Ocean', 'Pine', 'Quill', 'River', 'Sky', 'Thorne', 'Unity', 'Vale',
        'Willow', 'Xero', 'Yarrow', 'Zephyr', 'Ash', 'Birch', 'Cedar', 'Dove',
        'Elm', 'Fern', 'Grove', 'Hazel', 'Ivy', 'Juniper', 'Kestrel', 'Linden',
        'Maple', 'Nettle', 'Oak', 'Poppy', 'Quince', 'Rowan', 'Sage', 'Thistle',
        'Umber', 'Violet', 'Wisteria', 'Yew', 'Zinnia', 'Alder', 'Bramble', 'Clover'
    ];

    function generateVillagerName() {
        return villagerNames[Math.floor(Math.random() * villagerNames.length)];
    }
    // === END: Villager AI System ===

    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
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
                this.entities.push({ position: { x: x + cfg.campSpacing.x, y: y }, type: 'fireplace', emoji: '🔥', isBurning: false, wood: 0, maxWood: GameConfig.fires.maxWood });
                // Sleeping bag
                this.entities.push({ position: { x: x - cfg.campSpacing.x, y: y }, type: 'sleeping_bag', emoji: '🛏️', isOccupied: false });
                // Personal storage
                this.entities.push({ position: { x: x, y: y + cfg.campSpacing.y }, type: 'storage_box', emoji: '📦', capacity: GameConfig.storage.personalCapacity, items: [], isPersonal: true, villagerId: i });
            }
            // --- Player start position (center of camp 0) ---
            const playerCamp = this.camps[0];
            this.playerStartPosition = {
                x: playerCamp.position.x,
                y: playerCamp.position.y
            };

            // --- Create villagers (skip camp 0 since player takes that role) ---
            this.villagers = [];
            this.villagerVisuals = [];
            for (let i = 1; i < cfg.villagerCount; i++) { // Start from 1, skip camp 0
                const camp = this.camps[i];
                const villagerName = generateVillagerName();

                // Spawn villager at camp center
                const villagerSpawnPosition = {
                    x: camp.position.x,
                    y: camp.position.y
                };

                const villager = new Villager(villagerName, villagerSpawnPosition, i);

                // Set initial state based on game start time
                const startHour = GameConfig.time.gameStartHour;
                if (startHour >= GameConfig.time.dayStartHour && startHour < GameConfig.time.nightStartHour) {
                    villager.state = 'FORAGING';
                    console.log(`[MainScene] Villager ${villagerName} starting in FORAGING state (daytime)`);
                }

                // Create visual representation
                const visuals = villager.createVisuals(this);
                this.villagerVisuals.push(visuals);

                this.villagers.push(villager);
                console.log(`[MainScene] Created villager ${villagerName} at camp ${i} (spawned at ${Math.round(villagerSpawnPosition.x)}, ${Math.round(villagerSpawnPosition.y)})`);
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
                    const well = { position: pos, type: 'well', emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel };
                    this.entities.push(well);
                    this.wells.push(well);
                }
            }
            // --- Resources (Small clusters of same type, spreading from village) ---
            const resourceTypes = ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'];
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
                const actualDistance = Math.max(100, distanceFromVillage + distanceVariation);

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
                        propagationChance: GameConfig.resources.propagationChance,
                        clusterId: clusterIndex // Track which cluster this belongs to
                    });

                    resourcesGenerated++;
                }

                console.log(`[World Generation] Created cluster ${clusterIndex} with ${resourcesInCluster} ${primaryType} resources at distance ${Math.round(actualDistance)} from village`);
            }

            console.log(`[World Generation] Generated ${totalResources} resources, total entities: ${this.entities.length}`);
            // --- Render all entities as Phaser text objects ---
            this.worldEntities = [];
            for (const entity of this.entities) {
                const fontSize = entity.type === 'camp' ? 28 : entity.type === 'fireplace' || entity.type === 'sleeping_bag' ? 24 : entity.type === 'storage_box' ? 24 : ['well', 'blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'].includes(entity.type) ? 22 : 22;
                const textObj = this.add.text(entity.position.x, entity.position.y, entity.emoji, { fontSize: fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
                entity._phaserText = textObj;
                this.worldEntities.push(textObj);

                // Add debug text and interaction circle for all objects
                this.addDebugElements(entity);

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
                // --- Fire interaction: click to interact if near ---
                if (entity.type === 'fireplace') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with fire out of range');

                        // Check if player has wood to add
                        const woodSlot = this.playerState.inventory.findIndex(item => item && item.type === 'tree');
                        if (woodSlot !== -1 && entity.wood < entity.maxWood) {
                            // Add wood to fire
                            entity.wood++;
                            this.playerState.inventory[woodSlot] = null;
                            entity.isBurning = true;
                            textObj.setText('🔥'); // Burning fire emoji
                            this.updatePhaserUI();
                            this.showTempMessage('Added wood to fire!', 1200);
                        } else if (entity.isBurning && entity.wood > 0) {
                            // Cook food if fire is burning
                            this.cookFoodNearFire(entity);
                        } else if (woodSlot !== -1) {
                            this.showTempMessage('Fire is full of wood!', 1200);
                        } else {
                            this.showTempMessage('Need wood to fuel fire!', 1200);
                        }
                    });
                }
                // --- Sleeping bag interaction: click to sleep if near ---
                if (entity.type === 'sleeping_bag') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with sleeping bag out of range');

                        if (entity.isOccupied) {
                            this.showTempMessage('Sleeping bag is occupied!', 1200);
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
                        const dist = distance(this.playerState.position, entity.position);
                        assert(dist <= GameConfig.player.interactionThreshold, 'Tried to interact with storage box out of range');

                        this.showStorageInterface(entity);
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
                const barBg = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, 0x333333).setOrigin(0.5, 0).setScrollFactor(0);
                const barFill = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, getPhaserBarColor(needTypes[i])).setOrigin(0.5, 0).setScrollFactor(0);
                const label = this.add.text(margin, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, needLabels[i], { fontSize: '16px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0, 0.5).setScrollFactor(0);
                const value = this.add.text(barStartX + GameConfig.ui.barWidth + 10, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, '100', { fontSize: '12px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0, 0.5).setScrollFactor(0);
                this.uiContainer.add([barBg, barFill, label, value]);
                this.ui.needsBars.push({ barBg, barFill, label, value });
            }
            // Inventory (bottom center) - use viewport dimensions
            const inventoryWidth = GameConfig.player.inventorySize * 56;
            const inventoryStartX = (window.innerWidth - inventoryWidth) / 2;
            const inventoryY = window.innerHeight - margin - 30; // Add 30px more space from bottom
            this.ui.inventorySlots = [];
            for (let i = 0; i < GameConfig.player.inventorySize; i++) {
                const slot = this.add.rectangle(inventoryStartX + i * 56, inventoryY, 50, 50, 0x222222).setOrigin(0.5).setStrokeStyle(2, 0x666666).setScrollFactor(0);
                const emoji = this.add.text(inventoryStartX + i * 56, inventoryY, '', { fontSize: '24px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5).setScrollFactor(0);
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

                        // Second priority: eat food if near a fire
                        if (this.isFood(item.type)) {
                            const nearbyFire = this.findNearbyFire();
                            console.log(`[Inventory] Food item ${item.type}, nearby fire:`, nearbyFire ? 'found' : 'not found');
                            if (nearbyFire) {
                                console.log('[Inventory] Eating food near fire');
                                this.eatFoodFromInventory(i, item);
                                return;
                            }
                        }

                        // Third priority: add wood to fire if near a fire
                        if (item.type === 'tree') {
                            const nearbyFire = this.findNearbyFire();
                            console.log(`[Inventory] Wood item, nearby fire:`, nearbyFire ? 'found' : 'not found');
                            if (nearbyFire && nearbyFire.wood < nearbyFire.maxWood) {
                                nearbyFire.wood++;
                                nearbyFire.isBurning = true;
                                this.playerState.inventory[i] = null;
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
            // --- Inventory slot selection: 1-6 keys (disabled - no longer using selection) ---
            // this.input.keyboard.on('keydown', (event) => {
            //     const idx = parseInt(event.key, 10) - 1;
            //     if (idx >= 0 && idx < GameConfig.player.inventorySize) {
            //         this.playerState.selectedSlot = idx;
            //         this.updatePhaserUI();
            //     }
            // });
            // Time display (top right) - fixed to camera viewport
            this.ui.timeText = this.add.text(window.innerWidth - margin, margin, '', { fontSize: '18px', fontFamily: 'monospace', color: '#fff' }).setOrigin(1, 0).setScrollFactor(0);
            this.uiContainer.add(this.ui.timeText);
            // Info box (bottom left) - fixed to camera viewport
            this.ui.infoBox = this.add.text(margin, window.innerHeight - margin, 'Alpine Sustainability v1.0\nControls: WASD to move\nClick inventory slots to select', { fontSize: '13px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#222', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.infoBox);
            // Debug toggle (bottom left, above log spam button) - fixed to camera viewport
            this.ui.debugBtn = this.add.text(margin, window.innerHeight - margin - 120, '⚪ Debug: OFF', { fontSize: '13px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#444', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.debugBtn.on('pointerdown', () => {
                window.villagerDebugEnabled = !window.villagerDebugEnabled;
                updateDebugBtn.call(this);
                // Update all debug elements immediately
                this.updateDebugElements();
            });
            function updateDebugBtn() {
                if (window.villagerDebugEnabled) {
                    this.ui.debugBtn.setText('🟢 Debug: ON').setColor('#fff').setBackgroundColor('#228B22');
                    if (this.ui.fpsCounter) {
                        this.ui.fpsCounter.setVisible(true);
                    }
                } else {
                    this.ui.debugBtn.setText('⚪ Debug: OFF').setColor('#ccc').setBackgroundColor('#444');
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
            this.ui.logSpamBtn = this.add.text(margin, window.innerHeight - margin - 90, '⚪ Log Spam: OFF', { fontSize: '13px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#444', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
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

            // Seed control box (bottom right) - use viewport dimensions
            const seedBoxY = window.innerHeight - margin;
            const seedBoxWidth = 200;
            const seedBoxX = window.innerWidth - margin - seedBoxWidth;

            // Seed label - fixed to camera viewport
            this.ui.seedLabel = this.add.text(seedBoxX, seedBoxY - 25, '🌱 Seed:', { fontSize: '13px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.seedLabel);

            // Seed input background - fixed to camera viewport
            this.ui.seedInputBg = this.add.rectangle(seedBoxX + 30, seedBoxY - 15, 60, 20, 0x333333).setOrigin(0, 1).setStrokeStyle(1, 0x666666).setScrollFactor(0);
            this.uiContainer.add(this.ui.seedInputBg);

            // Seed input text - fixed to camera viewport
            this.ui.seedInputText = this.add.text(seedBoxX + 56, seedBoxY - 17, getCurrentSeed().toString(), { fontSize: '12px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.seedInputText);

            // Decrement button (-) - fixed to camera viewport
            this.ui.seedDecrementBtn = this.add.text(seedBoxX + 25, seedBoxY - 15, '-', { fontSize: '14px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 6, right: 6, top: 2, bottom: 2 } }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.seedDecrementBtn.on('pointerdown', () => {
                console.log('[Seed] Decrement button clicked');
                this.decrementSeed();
            });
            this.uiContainer.add(this.ui.seedDecrementBtn);

            // Increment button (+) - fixed to camera viewport
            this.ui.seedIncrementBtn = this.add.text(seedBoxX + 85, seedBoxY - 15, '+', { fontSize: '14px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 6, right: 6, top: 2, bottom: 2 } }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.seedIncrementBtn.on('pointerdown', () => {
                console.log('[Seed] Increment button clicked');
                this.incrementSeed();
            });
            this.uiContainer.add(this.ui.seedIncrementBtn);

            // New Game button - fixed to camera viewport
            this.ui.newGameBtn = this.add.text(seedBoxX + 100, seedBoxY - 15, '🔄 New Game', { fontSize: '12px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#228B22', padding: { left: 8, right: 8, top: 4, bottom: 4 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.newGameBtn.on('pointerdown', () => {
                console.log('[NewGame] New Game button clicked');
                this.showNewGameConfirmation();
            });
            // Don't add to container - keep it as a direct scene element for better interaction

            // Initialize current seed value
            this.currentSeedValue = getCurrentSeed();

            // FPS counter (above debug button) - fixed to camera viewport
            this.ui.fpsCounter = this.add.text(margin, window.innerHeight - margin - 150, 'FPS: 60', { fontSize: '13px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#444', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1).setScrollFactor(0);
            this.uiContainer.add(this.ui.fpsCounter);

            // Debug toggle (bottom left, above log spam button) - fixed to camera viewport
            this.ui.debugBtn = this.add.text(margin, window.innerHeight - margin - 120, '⚪ Debug: OFF', { fontSize: '13px', fontFamily: 'monospace', color: '#ccc', backgroundColor: '#444', padding: { left: 8, right: 8, top: 8, bottom: 8 } }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            this.ui.debugBtn.on('pointerdown', () => {
                window.villagerDebugEnabled = !window.villagerDebugEnabled;
                updateDebugBtn.call(this);
                // Update all debug elements immediately
                this.updateDebugElements();
            });
            // Initialize debug state (default to OFF)
            if (typeof window.villagerDebugEnabled === 'undefined') {
                window.villagerDebugEnabled = false;
            }
            updateDebugBtn.call(this);
            this.uiContainer.add(this.ui.debugBtn);
        }
        update(time, delta) {
            // Update day/night lighting
            this.updateDayNightLighting();

            // Check if player is sleeping
            if (this.isSleeping && this.sleepingBag) {
                // Check if player moved away from sleeping bag
                const dist = distance(this.playerState.position, this.sleepingBag.position);
                if (dist > GameConfig.player.interactionThreshold) {
                    // Player moved away, stop sleeping
                    this.stopSleeping();
                } else {
                    // Use accelerated time while sleeping
                    const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
                    const gameTimeDelta = (delta / 1000) * timeAcceleration * this.sleepTimeAcceleration;
                    this.playerState.currentTime += gameTimeDelta;

                    // Update ZZZ position
                    if (this.sleepZZZ) {
                        this.sleepZZZ.setPosition(this.player.x, this.player.y - 60);
                    }

                    // Restore temperature while sleeping (calories should still decay naturally)
                    this.playerState.needs.temperature = Math.min(GameConfig.needs.fullValue, this.playerState.needs.temperature + 0.5);

                    // Check if it's exactly 8:00 AM (wake up during 8:00-8:01 minute)
                    const t = getCurrentTime(this.playerState);
                    if (t.hour === 8 && t.minute === 0) {
                        this.stopSleeping();
                        this.showTempMessage('Woke up at 8:00 AM!', 2000);
                    }
                }
            } else {
                // Normal time progression
                const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
                const gameTimeDelta = (delta / 1000) * timeAcceleration;
                this.playerState.currentTime += gameTimeDelta;
            }

            // Check if player moved away from storage box
            if (this._storageDialog) {
                const dist = distance(this.playerState.position, this._storageDialog.storageBox.position);
                if (dist > GameConfig.player.interactionThreshold) {
                    this.closeStorageInterface();
                }
            }

            // Update villagers (with sleep acceleration if sleeping)
            const effectiveDelta = this.isSleeping ? delta * this.sleepTimeAcceleration : delta;
            this.updateVillagers(effectiveDelta);

            // Needs (with sleep acceleration if sleeping)
            updateNeeds(this.playerState, effectiveDelta);

            // Apply fire temperature effects (with sleep acceleration if sleeping)
            this.applyFireTemperatureEffects(effectiveDelta);

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
            if (t.hour >= 6 && t.hour < 12) timeEmoji = '🌞';
            else if (t.hour >= 12 && t.hour < GameConfig.time.nightStartHour) timeEmoji = '☀️';
            else if (t.hour >= GameConfig.time.nightStartHour && t.hour < 22) timeEmoji = '🌆';
            else timeEmoji = '🌙';

            // Count living villagers
            const livingVillagers = this.villagers ? this.villagers.filter(v => !v.isDead).length : 0;
            this.ui.timeText.setText(`📅 Day ${t.day}\n${timeEmoji} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}\n👥 Neighbours: ${livingVillagers}`);
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
            if (window.summaryLoggingEnabled && Math.random() < 0.01) { // 1% chance per frame when spam enabled
                const resourceEntities = this.entities.filter(e => ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer', 'tree'].includes(e.type));
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
                    villager.state = 'DEAD';

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

                    console.log(`[MainScene] Villager ${villager.name} died and became a corpse`);
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
            if (distance(pos, { x: centerX, y: centerY }) < GameConfig.world.resourceVillageMinDistance) {
                return true;
            }

            // Also check distance from each camp to prevent resources spawning inside camps
            if (this.camps && this.camps.length > 0) {
                for (let i = 0; i < this.camps.length; i++) {
                    const campDistance = distance(pos, this.camps[i]);
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
            const bg = this.add.rectangle(w / 2, h / 2, 400, 200, 0x222222, 0.95).setOrigin(0.5).setDepth(1000).setScrollFactor(0);

            // Title - fixed to camera viewport
            const title = this.add.text(w / 2, h / 2 - 60, 'Start New Game?', { fontSize: '24px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);

            // Message - fixed to camera viewport
            const message = this.add.text(w / 2, h / 2 - 20, `Seed: ${seed}`, { fontSize: '16px', fontFamily: 'monospace', color: '#ccc' }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);

            // Buttons - fixed to camera viewport
            const yesBtn = this.add.text(w / 2 - 60, h / 2 + 30, 'Yes', { fontSize: '16px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#228B22', padding: { left: 12, right: 12, top: 6, bottom: 6 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1001).setScrollFactor(0);

            const noBtn = this.add.text(w / 2 + 60, h / 2 + 30, 'No', { fontSize: '16px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 12, right: 12, top: 6, bottom: 6 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1001).setScrollFactor(0);

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
            // Add debug text above entity
            const debugText = this.add.text(
                entity.position.x,
                entity.position.y - 40,
                this.getDebugText(entity),
                { fontSize: '10px', fontFamily: 'monospace', color: '#00ff00', backgroundColor: '#000', padding: { left: 2, right: 2, top: 1, bottom: 1 } }
            ).setOrigin(0.5).setVisible(false);

            // Add interaction distance circle
            const interactionCircle = this.add.circle(
                entity.position.x,
                entity.position.y,
                GameConfig.player.interactionThreshold,
                0x00ff00,
                0.1 // Very transparent
            ).setOrigin(0.5).setVisible(false);

            // Add fire warmth range circle for fireplaces
            let warmthCircle = null;
            if (entity.type === 'fireplace') {
                warmthCircle = this.add.circle(
                    entity.position.x,
                    entity.position.y,
                    GameConfig.player.interactionThreshold * 3, // Triple the range
                    0xff6600, // Orange color for warmth
                    0.05 // Very transparent
                ).setOrigin(0.5).setVisible(false);
            }

            // Store references for toggling
            entity._debugText = debugText;
            entity._interactionCircle = interactionCircle;
            entity._warmthCircle = warmthCircle;
        }

        getDebugText(entity) {
            switch (entity.type) {
                case 'well':
                    return `Well (${entity.waterLevel} water)`;
                case 'fireplace':
                    return `Fire (${entity.wood}/${entity.maxWood} wood) ${entity.isBurning ? '🔥' : '❄️'}`;
                case 'sleeping_bag':
                    return `Sleeping Bag ${entity.isOccupied ? '(Occupied)' : '(Free)'}`;
                case 'storage_box':
                    const capacity = entity.isPersonal ? GameConfig.storage.personalCapacity : GameConfig.storage.communalCapacity;
                    return `${entity.isPersonal ? 'Personal' : 'Communal'} Storage (${entity.items.length}/${capacity})`;
                case 'blackberry':
                case 'mushroom':
                case 'herb':
                case 'rabbit':
                case 'deer':
                case 'tree':
                    return `${entity.type} ${entity.collected ? '(Collected)' : '(Available)'}`;
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
        }

        cookFoodNearFire(fireEntity) {
            // Find food items in player inventory
            const foodSlots = [];
            for (let i = 0; i < this.playerState.inventory.length; i++) {
                const item = this.playerState.inventory[i];
                if (item && this.isFood(item.type)) {
                    foodSlots.push(i);
                }
            }

            if (foodSlots.length === 0) {
                this.showTempMessage('No food to cook!', 1200);
                return;
            }

            // Cook the first food item found
            const slot = foodSlots[0];
            const food = this.playerState.inventory[slot];

            // Convert to cooked version
            const cookedFood = this.getCookedVersion(food.type);
            this.playerState.inventory[slot] = cookedFood;

            this.updatePhaserUI();
            this.showTempMessage(`Cooked ${food.type}!`, 1200);
        }

        isFood(type) {
            return ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer'].includes(type);
        }

        getCookedVersion(type) {
            const cookedEmojis = {
                'blackberry': '🍇', // Cooked berries
                'mushroom': '🍄', // Mushrooms stay same when cooked
                'herb': '🌿', // Herbs stay same when cooked
                'rabbit': '🍖', // Cooked meat
                'deer': '🥩' // Cooked venison
            };
            return { type: `cooked_${type}`, emoji: cookedEmojis[type] || '🍽️' };
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
            this.sleepZZZ = this.add.text(this.player.x, this.player.y - 60, '💤', { fontSize: '24px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5).setDepth(1000);

            this.showTempMessage('Sleeping... (time accelerated)', 2000);
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
            const bg = this.add.rectangle(w / 2, h / 2, 400, bgHeight, 0x222222, 0.95).setOrigin(0.5).setDepth(1000).setScrollFactor(0);

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
            storageBox.items.splice(storageSlot, 1); // Remove item from storage

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

            // Check if storage has capacity
            const capacity = storageBox.isPersonal ? GameConfig.storage.personalCapacity : GameConfig.storage.communalCapacity;
            if (storageBox.items.length >= capacity) {
                this.showTempMessage('Storage full!', 1200);
                return;
            }

            // Transfer item (add to end of array)
            storageBox.items.push(this.playerState.inventory[playerSlot]);
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

        isFood(type) {
            return ['blackberry', 'mushroom', 'herb', 'rabbit', 'deer'].includes(type);
        }

        eatFoodFromInventory(slot, item) {
            // Check if food needs to be cooked
            if (item.type.startsWith('cooked_')) {
                // Already cooked, apply nutrition
                this.applyNutrition(item.type);
                this.playerState.inventory[slot] = null;
                this.updatePhaserUI();
                this.showTempMessage(`Ate cooked ${item.type.replace('cooked_', '')}!`, 1200);
            } else {
                // Raw food - try to cook it first
                const nearbyFire = this.findNearbyFire();
                if (nearbyFire) {
                    // Cook the food
                    const cookedFood = this.getCookedVersion(item.type);
                    this.playerState.inventory[slot] = cookedFood;
                    this.applyNutrition(cookedFood.type);
                    this.playerState.inventory[slot] = null;
                    this.updatePhaserUI();
                    this.showTempMessage(`Cooked and ate ${item.type}!`, 1200);
                } else {
                    // Eat raw (less nutrition)
                    this.applyNutrition(item.type, 0.5);
                    this.playerState.inventory[slot] = null;
                    this.updatePhaserUI();
                    this.showTempMessage(`Ate raw ${item.type} (half nutrition)!`, 1200);
                }
            }
        }

        findNearbyBurningFire() {
            // Find a burning fire within interaction range
            for (const entity of this.entities) {
                if (entity.type === 'fireplace' && entity.isBurning) {
                    const dist = distance(this.playerState.position, entity.position);
                    if (dist <= GameConfig.player.interactionThreshold) {
                        return entity;
                    }
                }
            }
            return null;
        }

        findNearbyFire() {
            // Find any fire within interaction range (burning or not)
            for (const entity of this.entities) {
                if (entity.type === 'fireplace') {
                    const dist = distance(this.playerState.position, entity.position);
                    console.log(`[Fire] Found fireplace at distance ${Math.round(dist)}, interaction threshold: ${GameConfig.player.interactionThreshold}`);
                    if (dist <= GameConfig.player.interactionThreshold) {
                        console.log(`[Fire] Returning nearby fire at distance ${Math.round(dist)}`);
                        return entity;
                    }
                }
            }
            console.log('[Fire] No nearby fires found');
            return null;
        }

        applyNutrition(foodType, multiplier = 1.0) {
            const nutrition = this.getNutrition(foodType);
            this.playerState.needs.calories = Math.min(GameConfig.needs.fullValue, this.playerState.needs.calories + nutrition.calories * multiplier);

            // Apply vitamins
            for (let i = 0; i < this.playerState.needs.vitamins.length; i++) {
                this.playerState.needs.vitamins[i] = Math.min(GameConfig.needs.fullValue, this.playerState.needs.vitamins[i] + nutrition.vitamins[i] * multiplier);
            }
        }

        getNutrition(foodType) {
            const baseType = foodType.replace('cooked_', '');
            const nutrition = {
                'blackberry': { calories: 50, vitamins: [0, 0, 0, 1, 0] },
                'mushroom': { calories: 30, vitamins: [0, 0, 1, 0, 0] },
                'herb': { calories: 20, vitamins: [1, 0, 0, 0, 0] },
                'rabbit': { calories: 200, vitamins: [0, 1, 0, 0, 0] },
                'deer': { calories: 500, vitamins: [0, 1, 0, 0, 1] }
            };
            return nutrition[baseType] || { calories: 0, vitamins: [0, 0, 0, 0, 0] };
        }

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

            // Find nearby burning fires
            for (const entity of this.entities) {
                if (entity.type === 'fireplace' && entity.isBurning) {
                    const dist = distance(this.playerState.position, entity.position);
                    const fireRange = GameConfig.player.interactionThreshold * 3; // Triple the range

                    if (dist <= fireRange) {
                        // Calculate temperature gain (same rate as night decay)
                        const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
                        const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
                        const inGameMinutes = delta * inGameMinutesPerMs;

                        const decayRate = GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.needs.minutesPerHour);
                        const temperatureGain = decayRate * inGameMinutes;

                        this.playerState.needs.temperature = Math.min(GameConfig.needs.fullValue, this.playerState.needs.temperature + temperatureGain);
                        break; // Only apply from one fire
                    }
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