console.log('Phaser main loaded');

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

        // Check if a position is within interaction distance of another
        isWithinInteractionDistance(pos1, pos2, threshold) {
            assert(threshold !== null && threshold !== undefined, 'isWithinInteractionDistance requires explicit threshold parameter');
            const dist = this.distance(pos1, pos2);
            const interactionThreshold = threshold;
            return dist <= interactionThreshold;
        },

        // Check if it's night time (corrected logic)
        isNightTime(hour) {
            // Night is from nightStartHour (20:00) to gameStartHour (12:00) the next day
            // This means: 20:00-23:59 (hour 20-23) and 00:00-11:59 (hour 0-11)
            return hour >= GameConfig.time.nightStartHour || hour < GameConfig.time.gameStartHour;
        },

        // Food type checking - checks if item has calories > 0
        isFood(type) {
            const resourceData = GameConfig.resources.resourceData[type];
            if (!resourceData) return false;

            // Check if it's a plant or animal category (food)
            return resourceData.category === 'plant' || resourceData.category === 'animal';
        },

        // Check if item type is burnable (has fire value)
        isBurnable(type) {
            const resourceData = GameConfig.resources.resourceData[type];
            if (!resourceData) return false;

            // Check if it's a burnable category
            return resourceData.category === 'burnable';
        },

        // Get nutrition values for a food type (uses procedurally generated values)
        getNutrition(foodType) {
            const resourceData = GameConfig.resources.resourceData[foodType];
            assert(resourceData, `Food type ${foodType} not found in GameConfig.resources.resourceData`);

            // Use procedurally generated nutrition values
            assert(window.resourceGeneration, 'ResourceGeneration not initialized');
            const nutrition = window.resourceGeneration.getNutrition(foodType);
            assert(nutrition, `No nutrition data generated for resource: ${foodType}`);

            return nutrition;
        },

        getFireValue(itemType) {
            const resourceData = GameConfig.resources.resourceData[itemType];
            assert(resourceData, `Item type ${itemType} not found in GameConfig.resources.resourceData`);

            // Use procedurally generated fire values
            assert(window.resourceGeneration, 'ResourceGeneration not initialized');
            const nutrition = window.resourceGeneration.getNutrition(itemType);
            assert(nutrition, `No nutrition data generated for resource: ${itemType}`);

            assert(nutrition.fire !== undefined, `Resource ${itemType} missing fire property`);
            return nutrition.fire;
        },

        // Get runspeed for a resource type (uses procedurally generated values)
        getRunspeed(resourceType) {
            const resourceData = GameConfig.resources.resourceData[resourceType];
            assert(resourceData, `Resource type ${resourceType} not found in GameConfig.resources.resourceData`);

            // Use procedurally generated runspeed values
            assert(window.resourceGeneration, 'ResourceGeneration not initialized');
            return window.resourceGeneration.getRunspeed(resourceType);
        },

        // Check if a resource type is mobile (has runspeed > 0)
        isMobile(resourceType) {
            return this.getRunspeed(resourceType) > 0;
        },

        // Apply nutrition to a target (player or villager)
        applyNutrition(target, foodType) {
            const nutrition = this.getNutrition(foodType);

            // Apply calories
            target.needs.calories = Math.min(GameConfig.needs.fullValue, target.needs.calories + nutrition.calories);

            // Apply water
            target.needs.water = Math.min(GameConfig.needs.fullValue, target.needs.water + nutrition.water);

            // Apply vitamins
            for (let i = 0; i < nutrition.vitamins.length; i++) {
                target.needs.vitamins[i] = Math.min(GameConfig.needs.fullValue, target.needs.vitamins[i] + nutrition.vitamins[i]);
            }
        },

        // Find nearest entity with optional filter function
        findNearestEntity(entities, fromPosition, filterFn) {
            assert(Array.isArray(entities), 'findNearestEntity: entities must be an array');
            let nearest = null;
            let nearestDist = Infinity;

            for (const entity of entities) {
                if (filterFn && !filterFn(entity)) continue;

                const dist = this.distance(fromPosition, entity.position);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = entity;
                }
            }

            return nearest;
        },

        // Find empty slot in inventory
        findEmptySlot(items) {
            return items.findIndex(item => item === null);
        },

        // All food types extracted from GameConfig for easy access
        get ALL_FOOD_TYPES() {
            return Object.keys(GameConfig.resources.resourceData).filter(type =>
                GameConfig.resources.resourceData[type].category === 'plant' ||
                GameConfig.resources.resourceData[type].category === 'animal'
            );
        },

        // All burnable resource types extracted from GameConfig for easy access
        get ALL_BURNABLE_TYPES() {
            return Object.keys(GameConfig.resources.resourceData).filter(type =>
                GameConfig.resources.resourceData[type].category === 'burnable'
            );
        },

        /**
         * Shared resource collection logic used by both player and villager systems
         * @param {Object} entity - The entity to collect (must be a resource in GameConfig.resources.resourceData)
         * @param {Array} inventory - The inventory array to add the item to
         * @param {string} collectorName - Name of the collector for logging
         * @returns {boolean} - Whether collection was successful
         */
        collectResource(entity, inventory, collectorName = 'Unknown') {
            assert(entity, 'Entity required for collectResource');
            assert(entity.type, 'Entity must have a type');
            assert(inventory, 'Inventory array required for collectResource');

            // Check if we can collect this resource (must be in resourceData)
            if (!GameConfig.resources.resourceData[entity.type]) {
                console.warn(`[${collectorName}] cannot collect entity of type: ${entity.type} (not in resourceData)`);
                return false;
            }

            // Check if we can collect this resource
            if (!GameUtils.isFood(entity.type) && !GameUtils.isBurnable(entity.type)) {
                console.warn(`[${collectorName}] cannot collect resource of type: ${entity.type}`);
                return false;
            }

            // Find empty slot in inventory
            const emptySlot = GameUtils.findEmptySlot(inventory);
            if (emptySlot === -1) {
                console.warn(`[${collectorName}] inventory is full, cannot collect resource`);
                return false;
            }

            // Mark resource as collected (this prevents re-collection)
            entity.collected = true;

            // Hide the visual representation of the collected resource
            if (entity._phaserText) {
                entity._phaserText.setVisible(false);
            }

            // Add item to inventory
            inventory[emptySlot] = {
                type: entity.type,
                emoji: entity.emoji,
                nutrition: GameUtils.getNutrition(entity.type),
                fireValue: GameUtils.getFireValue(entity.type)
            };

            if (window.summaryLoggingEnabled) {
                console.log(`[${collectorName}] collected ${entity.type} from (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})`);
            }
            return true;
        }
    };

    function assert(condition, message) {
        if (!condition) throw new Error('ASSERTION FAILED: ' + message);
    }

    // === BEGIN: Logging System ===
    let logTransmissionInterval;
    let domSnapshotInterval;
    let lastDomSnapshot = '';

    // Initialize logging system
    function initLogging() {
        window.summaryLoggingEnabled = GameConfig.logging.summaryLoggingInitialState;
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
                id: el.id,
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

    // === BEGIN: PerlinNoise and utility functions ===
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

    // === CHARACTER CUSTOMIZATION SYSTEM ===
    // Handles character appearance and state-based emoji generation

    class CharacterCustomization {
        constructor(seededRandom) {
            assert(seededRandom, 'SeededRandom required for character customization');
            this.seededRandom = seededRandom;

            // Generate consistent character appearance for this game session
            this.skinToneIndex = this.selectSkinToneIndex();
            this.gender = this.selectGender();

            console.log(`[CharacterCustomization] Generated appearance: skin=${this.skinToneIndex}, gender=${this.gender}`);
        }

        selectSkinToneIndex() {
            // 0-4 for the 5 skin tone options (indices 0,1,2,3,4)
            return this.seededRandom.randomInt(0, 4); // Fix: use 4 for exclusive upper bound
        }

        selectGender() {
            const genders = ['male', 'female', 'neutral'];
            const index = this.seededRandom.randomInt(0, genders.length - 1); // Fix: use length-1 for exclusive upper bound
            const selectedGender = genders[index];

            // Debug logging to see what's happening
            console.log(`[CharacterCustomization] selectGender: index=${index}, selectedGender=${selectedGender}, genders.length=${genders.length}`);

            assert(selectedGender, 'Gender selection failed - selectedGender is undefined');
            return selectedGender;
        }

        // Generate emoji for a specific character state
        getStateEmoji(state, isMoving = false, direction = null) {
            assert(state, 'State is required for emoji generation');

            // Determine the appropriate emoji set
            let emojiSet = 'standing';

            switch (state) {
                case 'standing':
                case 'idle':
                    emojiSet = 'standing';
                    break;
                case 'running':
                case 'moving':
                case 'foraging':
                case 'returning':
                    emojiSet = 'running';
                    break;
                case 'sleeping':
                    emojiSet = 'sleeping';
                    break;
                default:
                    // Fallback to standing for unknown states
                    emojiSet = 'standing';
            }

            // Get the pre-composed emoji from the appropriate set
            assert(this.gender, `Gender is undefined. Available genders: ${Object.keys(GameConfig.characters.emojiSets[emojiSet])}`);
            assert(GameConfig.characters.emojiSets[emojiSet][this.gender], `Gender '${this.gender}' not found in emojiSet '${emojiSet}'. Available: ${Object.keys(GameConfig.characters.emojiSets[emojiSet])}`);

            const emojiArray = GameConfig.characters.emojiSets[emojiSet][this.gender];
            assert(emojiArray, `Emoji array is undefined for gender '${this.gender}' in emojiSet '${emojiSet}'`);
            assert(emojiArray[this.skinToneIndex], `Skin tone index ${this.skinToneIndex} out of bounds for emoji array length ${emojiArray.length}`);

            const emoji = emojiArray[this.skinToneIndex];

            // Return emoji with direction info for running state
            if (state === 'running' && direction !== null) {
                return { emoji, direction };
            }

            return emoji;
        }

        // Get the current emoji based on character state and movement
        getCurrentEmoji(characterState, isMoving = false, direction = null) {
            // Determine the appropriate state
            let state = 'standing';

            // Map goal states to emoji states
            if (isMoving) {
                state = 'running';
            } else if (characterState === 'rest') {
                state = 'sleeping';
            }

            return this.getStateEmoji(state, isMoving, direction);
        }
    }

    // === BEGIN: Villager AI System ===
    class Villager {
        constructor(name, campPosition, villagerId, seededRandom = null) {
            this.seededRandom = seededRandom; // Ensure seededRandom is available immediately
            this.name = name;
            this.campPosition = campPosition;
            this.villagerId = villagerId;

            // Position and movement
            this.position = { ...campPosition };
            this.moveSpeed = GameConfig.villager.moveSpeed;

            // Needs system (same as player) - Initialize with random values
            const random = seededRandom;
            this.needs = {
                temperature: random.randomRange(GameConfig.player.startingStats.temperature.min, GameConfig.player.startingStats.temperature.max),
                water: random.randomRange(GameConfig.player.startingStats.water.min, GameConfig.player.startingStats.water.max),
                calories: random.randomRange(GameConfig.player.startingStats.calories.min, GameConfig.player.startingStats.calories.max),
                vitamins: new Array(GameConfig.needs.vitaminCount).fill(0).map(() => random.randomRange(GameConfig.player.startingStats.vitamins.min, GameConfig.player.startingStats.vitamins.max))
            };

            // Inventory (same as player)
            this.inventory = new Array(GameConfig.player.inventorySize).fill(null);

            // State management - using new state machine (must be after needs and inventory are initialized)
            this.isDead = false;

            // Daily variance for needs (different per villager)
            this.dailyDecay = this.generateDailyDecay();

            // Character customization - use shared character appearance
            this.characterCustomization = null; // Will be set by MainScene

            // Visual representation
            this.phaserText = null;
            this.nameText = null;
            this.visualsCreated = false; // Flag to track if visuals have been created

            // Movement tracking for emoji updates
            this.lastPosition = { ...this.position };
            this.isMoving = false;
            this.movementDirection = null; // 'left', 'right', 'up', 'down', or null

            // Game entities reference (will be set by update method)
            this.gameEntities = null;

            console.log(`[Villager] Created villager ${name} at camp ${villagerId}`);
        }

        // === ESSENTIAL METHODS ONLY ===

        update(deltaTime, gameTime, entities, storageBoxes) {
            // Store reference to game entities and current game time
            this.gameEntities = entities;
            this.currentGameTime = gameTime;

            // Check for death first
            const isDead = this.checkDeath();

            // If dead, only update visuals and return
            if (isDead) {
                this.updateVisuals();
                return true;
            }

            // Update needs
            this.updateNeeds(deltaTime, gameTime);

            // Track movement for emoji updates
            const distanceMoved = GameUtils.distance(this.position, this.lastPosition);
            this.isMoving = distanceMoved > 0.1; // Small threshold to detect movement

            // Calculate movement direction (only left/right matters for emoji flipping)
            if (this.isMoving) {
                const dx = this.position.x - this.lastPosition.x;

                // Only consider horizontal movement for direction
                if (Math.abs(dx) > 0.1) { // Small threshold to detect horizontal movement
                    this.movementDirection = dx > 0 ? 'right' : 'left';
                } else {
                    this.movementDirection = null; // No horizontal movement
                }
            } else {
                this.movementDirection = null;
            }

            this.lastPosition = { ...this.position };

            // Log what villager is trying to do when needs are critically low (behind spam gate)
            const hasCriticalNeeds = this.needs.temperature < 5 || this.needs.water < 5 || this.needs.calories < 5 || this.needs.vitamins.some(v => v < 5);
            if (hasCriticalNeeds && window.summaryLoggingEnabled) {
                const t = this.getCurrentTime(gameTime);
                const currentGoal = this.hierarchicalAI ? this.hierarchicalAI.goalData.currentGoal : 'unknown';
                const currentAction = this.hierarchicalAI ? this.hierarchicalAI.actionData.currentAction : 'unknown';
                console.log(`[Villager] ${this.name} CRITICAL ACTION LOG: Goal=${currentGoal}, Action=${currentAction}, Hour=${t.hour.toFixed(1)}`);
                console.log(`[Villager] ${this.name} CRITICAL ACTION LOG: Position=(${Math.round(this.position.x)}, ${Math.round(this.position.y)}), Camp=(${Math.round(this.campPosition.x)}, ${Math.round(this.campPosition.y)})`);
                console.log(`[Villager] ${this.name} CRITICAL ACTION LOG: Inventory=[${this.inventory.map(item => item ? item.type : 'empty').join(', ')}]`);
            }

            // Use hierarchical AI system
            if (!this.hierarchicalAI) {
                this.hierarchicalAI = new HierarchicalVillagerAI(this);
            }
            this.hierarchicalAI.update(deltaTime, gameTime, entities, storageBoxes);

            // Update visual representation
            this.updateVisuals();



            return false; // Villager is alive
        }

        generateDailyDecay() {
            // Generate unique daily decay rates for this villager using seeded random
            const variance = GameConfig.needsVariance;
            assert(this.seededRandom, 'SeededRandom required for generateDailyDecay');

            // Ensure we don't divide by zero and handle edge cases
            const safeDecayRate = (baseRate) => {
                const rate = GameConfig.needs.decayCalculationFactor / (baseRate * GameConfig.time.minutesPerHour);
                // Ensure rate is finite and positive
                if (!isFinite(rate) || rate <= 0) {
                    console.error(`[Villager] ${this.name} Invalid decay rate calculated: ${rate}`);
                }
                return rate * (1 + (this.seededRandom.random() - 0.5) * variance);
            };

            return {
                temperature: safeDecayRate(GameConfig.needsDrain.temperature),
                water: safeDecayRate(GameConfig.needsDrain.water),
                calories: safeDecayRate(GameConfig.needsDrain.calories),
                vitamins: safeDecayRate(GameConfig.needsDrain.vitamins)
            };
        }

        updateNeeds(deltaTime, gameTime) {
            const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
            const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
            const inGameMinutes = deltaTime * inGameMinutesPerMs;

            const t = this.getCurrentTime(gameTime);
            const isNight = GameUtils.isNightTime(t.hour);

            // Store old values for comparison
            const oldNeeds = {
                temperature: this.needs.temperature,
                water: this.needs.water,
                calories: this.needs.calories,
                vitamins: [...this.needs.vitamins]
            };

            // Apply decay based on config values
            this.needs.water -= this.dailyDecay.water * inGameMinutes;
            this.needs.calories -= this.dailyDecay.calories * inGameMinutes;

            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] -= this.dailyDecay.vitamins * inGameMinutes;
            }

            let isNearFire = false;
            // Apply fire temperature effects for villagers (same as player)
            if (this.gameEntities) {
                for (const entity of this.gameEntities) {
                    if (entity.type === GameConfig.entityTypes.fireplace && entity.isBurning && entity.wood > 0) {
                        const dist = GameUtils.distance(this.position, entity.position);
                        const fireRange = GameConfig.player.fireHeatingRange; // Use config-defined heating range

                        if (dist <= fireRange) {
                            // Calculate temperature gain (same rate as night decay)
                            const decayRate = GameConfig.needs.decayCalculationFactor / (GameConfig.needsDrain.temperature * GameConfig.time.minutesPerHour);
                            const temperatureGain = decayRate * inGameMinutes;

                            this.needs.temperature = Math.min(GameConfig.needs.fullValue, this.needs.temperature + temperatureGain);

                            isNearFire = true;

                            break; // Only apply from one fire
                        }
                    }
                }
            }

            if (!isNearFire && isNight) {
                this.needs.temperature -= this.dailyDecay.temperature * inGameMinutes;
            }

            // Clamp values to valid range with NaN protection
            const safeClamp = (value) => {
                if (!isFinite(value)) return GameConfig.needs.minValue;
                return Math.max(GameConfig.needs.minValue, Math.min(GameConfig.needs.maxValue, value));
            };

            this.needs.temperature = safeClamp(this.needs.temperature);
            this.needs.water = safeClamp(this.needs.water);
            this.needs.calories = safeClamp(this.needs.calories);

            for (let i = 0; i < this.needs.vitamins.length; i++) {
                this.needs.vitamins[i] = safeClamp(this.needs.vitamins[i]);
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
                const currentGoal = this.hierarchicalAI ? this.hierarchicalAI.goalData.currentGoal : 'unknown';
                const currentAction = this.hierarchicalAI ? this.hierarchicalAI.actionData.currentAction : 'unknown';
                console.log(`[Villager] ${this.name} Current goal: ${currentGoal}, action: ${currentAction}, hour: ${t.hour.toFixed(1)}, position: (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
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
                    const currentGoal = this.hierarchicalAI ? this.hierarchicalAI.goalData.currentGoal : 'unknown';
                    const currentAction = this.hierarchicalAI ? this.hierarchicalAI.actionData.currentAction : 'unknown';
                    console.log(`[Villager] ${this.name} LOW NEEDS WARNING: ${lowNeeds.join(', ')} | Goal: ${currentGoal}, Action: ${currentAction}, Hour: ${t.hour.toFixed(1)}`);
                    this.lastCriticalLog = now;
                }
            }
        }

        // === UTILITY METHODS FOR STATE MACHINE ===

        moveTowards(target, deltaTime) {
            if (!target) return;

            const distance = GameUtils.distance(this.position, target);

            // Use pathfinding for longer distances, direct movement for close targets
            if (distance > GameConfig.navigation.minDistanceForPathfinding &&
                GameConfig.navigation.enableForVillagers &&
                this.scene && this.scene.pathfinder) {

                // Check if we need a new path (no current path or target changed)
                const needsNewPath = !this.currentPath ||
                    !this.pathTarget ||
                    GameUtils.distance(this.pathTarget, target) > GameConfig.navigation.pathReplanningTolerance;

                if (needsNewPath) {
                    // Log when pathfinding is triggered (rarely)
                    if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} TRIGGERING PATHFINDING: distance=${Math.round(distance)}px to (${Math.round(target.x)}, ${Math.round(target.y)})`);
                    }

                    // Try to find a path
                    const path = this.scene.pathfinder.findPath(this.position, target, null, this);

                    if (path && path.length > 1) {
                        // Store the path and target for following
                        this.currentPath = path;
                        this.pathTarget = { x: target.x, y: target.y };
                        this.pathIndex = 0; // Start at index 0 (first waypoint)

                        // Track path for debug visualization
                        if (this.scene.pathfinder && GameConfig.navigation.debugVisualization.enabled) {
                            this.scene.pathfinder.addActivePath(this, path, target);
                        }

                        // Log pathfinding success
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.name} PATHFINDING SUCCESS: Found path with ${path.length} waypoints from (${Math.round(this.position.x)}, ${Math.round(this.position.y)}) to (${Math.round(target.x)}, ${Math.round(target.y)})`);
                        }
                    } else {
                        // Pathfinding failed, do NOT use direct movement as fallback
                        if (window.summaryLoggingEnabled) {
                            console.warn(`[Villager] ${this.name} PATHFINDING FAILED: NPC at (${Math.round(this.position.x)}, ${Math.round(this.position.y)}) trying to reach (${Math.round(target.x)}, ${Math.round(target.y)}) - NO MOVEMENT (direct fallback disabled)`);
                        }
                        this.currentPath = null;
                        this.pathTarget = null;
                        this.pathIndex = null;

                        // Remove from debug visualization
                        if (this.scene.pathfinder && GameConfig.navigation.debugVisualization.enabled) {
                            this.scene.pathfinder.removeActivePath(this);
                        }

                        // Fallback direct movement is now disabled
                        return;
                    }
                }

                // Follow the current path
                if (this.currentPath && this.pathIndex < this.currentPath.length) {
                    const nextWaypoint = this.currentPath[this.pathIndex];

                    // Move towards the next waypoint
                    this.moveTowardsDirect(nextWaypoint, deltaTime);

                    // Check if we've reached the waypoint (after movement)
                    const waypointDistance = GameUtils.distance(this.position, nextWaypoint);

                    // Debug: Log waypoint coordinates occasionally
                    if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} moving to waypoint: grid(${Math.round(nextWaypoint.x)}, ${Math.round(nextWaypoint.y)}) - current pos: (${Math.round(this.position.x)}, ${Math.round(this.position.y)}) - distance: ${Math.round(waypointDistance)}px`);
                    }
                    if (waypointDistance < GameConfig.navigation.waypointReachDistance) {
                        this.pathIndex++;
                        this.waypointStuckTimer = 0; // Reset stuck timer when waypoint reached

                        // Update debug visualization waypoint
                        if (this.scene.pathfinder && GameConfig.navigation.debugVisualization.enabled) {
                            this.scene.pathfinder.updateActivePathWaypoint(this, this.pathIndex);
                        }

                        // Log waypoint progress
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.name} REACHED WAYPOINT: ${this.pathIndex}/${this.currentPath.length} at (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
                        }
                    } else {
                        // Initialize stuck timer if not exists
                        if (!this.waypointStuckTimer) {
                            this.waypointStuckTimer = 0;
                        }
                        this.waypointStuckTimer += deltaTime;

                        // Teleport to next waypoint if stuck for more than 1 second
                        if (this.waypointStuckTimer > GameConfig.navigation.stuckDetection.teleportTimeout &&
                            GameConfig.navigation.stuckDetection.enableTeleport &&
                            this.pathIndex + 1 < this.currentPath.length) {

                            const nextWaypoint = this.currentPath[this.pathIndex + 1];
                            this.position.x = nextWaypoint.x;
                            this.position.y = nextWaypoint.y;
                            this.pathIndex++; // Move to next waypoint
                            this.waypointStuckTimer = 0;

                            console.log(`[Villager] ${this.name} TELEPORTED to waypoint ${this.pathIndex}/${this.currentPath.length} at (${Math.round(nextWaypoint.x)}, ${Math.round(nextWaypoint.y)})`);
                        } else {
                            // Log when villager is stuck at waypoint
                            if (Math.random() < 0.1 && window.summaryLoggingEnabled) { // 10% chance to log stuck villagers
                                console.log(`[Villager] ${this.name} STUCK AT WAYPOINT: Distance ${Math.round(waypointDistance)}px (threshold: ${GameConfig.navigation.waypointReachDistance}px) to waypoint ${this.pathIndex}/${this.currentPath.length} at (${Math.round(nextWaypoint.x)}, ${Math.round(nextWaypoint.y)}) - Villager speed: ${GameConfig.villager.moveSpeed}px/s - Stuck for ${Math.round(this.waypointStuckTimer)}ms`);
                            }
                        }
                    }

                    // Check if we've reached the final target
                    if (this.pathIndex >= this.currentPath.length) {
                        const finalDistance = GameUtils.distance(this.position, target);
                        if (finalDistance < GameConfig.navigation.targetReachDistance) {
                            // Reached the target, clear path
                            this.currentPath = null;
                            this.pathTarget = null;
                            this.pathIndex = null;

                            // Remove from debug visualization
                            if (this.scene.pathfinder && GameConfig.navigation.debugVisualization.enabled) {
                                this.scene.pathfinder.removeActivePath(this);
                            }

                            if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.name} REACHED TARGET: (${Math.round(target.x)}, ${Math.round(target.y)})`);
                            }
                        }
                    }
                } else {
                    // No valid path, do NOT use direct movement
                    if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                        console.log(`[Villager] ${this.name} has no valid path and fallback direct movement is disabled. NPC is stuck. Investigate why pathfinding failed.`);
                    }
                    return;
                }
            } else {
                // Use direct movement for close targets or when pathfinding is disabled
                this.currentPath = null;
                this.pathTarget = null;
                this.pathIndex = null;

                // Remove from debug visualization
                if (this.scene.pathfinder && GameConfig.navigation.debugVisualization.enabled) {
                    this.scene.pathfinder.removeActivePath(this);
                }

                if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                    // Only allow direct movement if pathfinding is globally disabled (not just failed)
                    assert(false, `[Villager] ${this.name} attempted direct movement when pathfinding should be used. Fallback is disabled.`);
                }
                return;
            }
        }



        // Direct movement (original moveTowards logic)
        moveTowardsDirect(target, deltaTime) {
            if (!target) return;

            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            const distance = GameUtils.distance(this.position, target);

            if (distance > 0) {
                const speed = this.moveSpeed * deltaTime / 1000;
                const moveDistance = Math.min(speed, distance);
                const ratio = moveDistance / distance;

                const newX = this.position.x + dx * ratio;
                const newY = this.position.y + dy * ratio;

                // Check wall collision before applying movement
                const newPosition = { x: newX, y: newY };
                const hasCollision = this.scene && this.scene.checkWallCollision ?
                    this.scene.checkWallCollision(newPosition, 15) : false; // 15px collision radius for villagers

                // Only apply movement if no collision
                if (!hasCollision) {
                    this.position.x = newX;
                    this.position.y = newY;
                } else {
                    // Debug: Log wall collisions occasionally
                    if (Math.random() < 0.01) { // 1% chance to log
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.name} WALL COLLISION at (${Math.round(newPosition.x)}, ${Math.round(newPosition.y)})`);
                        }
                    }
                }

                // Log movement occasionally (1% chance per frame, behind spam gate)
                if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} MOVEMENT: Moving towards (${Math.round(target.x)}, ${Math.round(target.y)}), Distance: ${Math.round(distance)}px, Speed: ${this.moveSpeed}px/s, Delta: ${deltaTime}ms, MoveDistance: ${Math.round(moveDistance)}px`);
                }
            }
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

            // Update villager emoji based on goal and movement
            if (this.isDead) {
                // Dead villagers show a skull emoji
                this.phaserText.setText('💀');
                this.phaserText.setScale(1, 1); // No flipping for skull
            } else if (this.characterCustomization) {
                const currentGoal = this.hierarchicalAI ? this.hierarchicalAI.goalData.currentGoal : 'maintain';
                const emojiResult = this.characterCustomization.getCurrentEmoji(currentGoal, this.isMoving, this.movementDirection);

                // Handle emoji result (could be string or object with direction)
                if (typeof emojiResult === 'object' && emojiResult.emoji) {
                    // Running state with direction info
                    this.phaserText.setText(emojiResult.emoji);

                    // Flip sprite horizontally for left movement
                    if (emojiResult.direction === 'left') {
                        this.phaserText.setScale(1, 1); // Face left (no flip needed for left-facing emoji)
                    } else {
                        this.phaserText.setScale(-1, 1); // Face right (flip for right movement)
                    }
                } else {
                    // Standing or sleeping state (string emoji)
                    this.phaserText.setText(emojiResult);
                    this.phaserText.setScale(1, 1); // Reset scale for non-running states
                }
            }
            this.phaserText.setPosition(this.position.x, this.position.y);

            // Update name text (always show just the name, no stats)
            this.nameText.setPosition(this.position.x, this.position.y - 40);
            this.nameText.setText(this.isDead ? `${this.name} (DEAD)` : this.name);

            // Update state text with goal, action, and need (only show if debug enabled)
            this.stateText.setPosition(this.position.x, this.position.y + 30);
            if (window.villagerDebugEnabled) {
                const currentGoal = this.hierarchicalAI ? this.hierarchicalAI.goalData.currentGoal : 'unknown';
                const currentAction = this.hierarchicalAI ? this.hierarchicalAI.actionData.currentAction : 'unknown';
                const currentNeed = this.hierarchicalAI ? this.hierarchicalAI.getCurrentNeedDescription() : 'unknown';
                this.stateText.setText(`${currentGoal} / ${currentAction} / ${currentNeed}`);
                this.stateText.setVisible(true);
            } else {
                this.stateText.setVisible(false);
            }

            // Update stats debug text when debug is enabled
            if (window.villagerDebugEnabled) {
                // Create individual stat text objects if they don't exist
                if (!this.statTexts) {
                    this.statTexts = {
                        temperature: this.phaserText.scene.add.text(0, 0, '', {
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            backgroundColor: '#000',
                            padding: { left: 2, right: 2, top: 1, bottom: 1 }
                        }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug),
                        water: this.phaserText.scene.add.text(0, 0, '', {
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            backgroundColor: '#000',
                            padding: { left: 2, right: 2, top: 1, bottom: 1 }
                        }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug),
                        calories: this.phaserText.scene.add.text(0, 0, '', {
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            backgroundColor: '#000',
                            padding: { left: 2, right: 2, top: 1, bottom: 1 }
                        }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug),
                        vitamins: this.phaserText.scene.add.text(0, 0, '', {
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            backgroundColor: '#000',
                            padding: { left: 2, right: 2, top: 1, bottom: 1 }
                        }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug)
                    };
                }

                // Helper function to get color based on threshold
                const getStatColor = (value, regularThreshold, emergencyThreshold) => {
                    // Handle NaN or invalid values
                    if (!isFinite(value)) return '#ff0000'; // Red for invalid values

                    if (value >= regularThreshold) return '#cccccc'; // Light grey - above regular threshold
                    if (value >= emergencyThreshold) return '#ff8c00'; // Dark orange - below regular but above emergency
                    return '#ff0000'; // Bright red - below emergency threshold
                };

                // Get threshold values from config
                const thresholds = GameConfig.villager;

                // Calculate values (no floating points) with NaN protection
                const safeRound = (value) => {
                    if (!isFinite(value)) return 0;
                    return Math.round(value);
                };

                const tempValue = safeRound(this.needs.temperature);
                const waterValue = safeRound(this.needs.water);
                const caloriesValue = safeRound(this.needs.calories);
                const vitaminValues = this.needs.vitamins.map(v => safeRound(v));

                // Set individual stat texts with their own colors
                this.statTexts.temperature.setText(`T${tempValue}`);
                this.statTexts.temperature.setColor(getStatColor(this.needs.temperature, thresholds.regularThresholds.temperature, thresholds.emergencyThresholds.temperature));

                this.statTexts.water.setText(`W${waterValue}`);
                this.statTexts.water.setColor(getStatColor(this.needs.water, thresholds.regularThresholds.water, thresholds.emergencyThresholds.water));

                this.statTexts.calories.setText(`C${caloriesValue}`);
                this.statTexts.calories.setColor(getStatColor(this.needs.calories, thresholds.regularThresholds.calories, thresholds.emergencyThresholds.calories));

                this.statTexts.vitamins.setText(`V[${vitaminValues.join(',')}]`);
                this.statTexts.vitamins.setColor('#cccccc'); // Vitamins always grey

                // Position the stat texts horizontally with more spacing
                const baseX = this.position.x - 40;
                const baseY = this.position.y - 60;
                const spacing = 35; // Increased spacing between each stat

                this.statTexts.temperature.setPosition(baseX - spacing * 1.5, baseY);
                this.statTexts.water.setPosition(baseX - spacing * 0.5, baseY);
                this.statTexts.calories.setPosition(baseX + spacing * 0.5, baseY);
                this.statTexts.vitamins.setPosition(baseX + spacing * 2.5, baseY);

                // Show all stat texts
                this.statTexts.temperature.setVisible(true);
                this.statTexts.water.setVisible(true);
                this.statTexts.calories.setVisible(true);
                this.statTexts.vitamins.setVisible(true);

                // Hide the old single stats text if it exists
                if (this.statsText) {
                    this.statsText.setVisible(false);
                }
            } else {
                // Hide all stat texts when debug is disabled
                if (this.statTexts) {
                    this.statTexts.temperature.setVisible(false);
                    this.statTexts.water.setVisible(false);
                    this.statTexts.calories.setVisible(false);
                    this.statTexts.vitamins.setVisible(false);
                }
                // Also hide the old single stats text if it exists
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
                        padding: { left: 2, right: 2, top: 1, bottom: 1 },
                        wordWrap: { width: 0 }, // Disable word wrapping - let text expand horizontally
                        maxLines: 1 // Force single line
                    }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug);
                }

                // Show inventory slots as emojis (empty slots show nothing)
                const inventoryEmojis = this.inventory.map(item => item ? item.emoji : ' ').join(' ');
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
            // Check if any need is critically low (0 or below)
            const criticalNeeds = this.needs.temperature <= 0 || this.needs.water <= 0 || this.needs.calories <= 0 || this.needs.vitamins.some(v => v <= 0);

            if (criticalNeeds && !this.isDead) {
                this.isDead = true;
                console.log(`[Villager] ${this.name} has died from critical needs!`);
                console.log(`[Villager] ${this.name} Final stats: T${this.needs.temperature.toFixed(1)} W${this.needs.water.toFixed(1)} C${this.needs.calories.toFixed(1)} V[${this.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                console.log(`[Villager] ${this.name} Final position: (${Math.round(this.position.x)}, ${Math.round(this.position.y)})`);
                const finalGoal = this.hierarchicalAI ? this.hierarchicalAI.goalData.currentGoal : 'unknown';
                const finalAction = this.hierarchicalAI ? this.hierarchicalAI.actionData.currentAction : 'unknown';
                console.log(`[Villager] ${this.name} Final goal: ${finalGoal}, action: ${finalAction}`);

                // Stop all AI activity
                if (this.hierarchicalAI) {
                    this.hierarchicalAI.actionData.currentAction = 'DEAD';
                    this.hierarchicalAI.goalData.currentGoal = 'DEAD';
                }

                return true; // Villager has died
            }

            return this.isDead; // Return true if already dead
        }

        // === RESOURCE INTERACTION METHODS ===
        // These methods handle the actual resource collection and interaction logic

        /**
         * Collect a resource from the target entity
         * @param {Object} target - The entity to collect from
         * @returns {boolean} - Whether collection was successful
         */
        collectResource(target) {
            return GameUtils.collectResource(target, this.inventory, `Villager ${this.name}`);
        }

        /**
         * Drink from a well to restore water
         * @param {Object} well - The well entity
         * @returns {boolean} - Whether drinking was successful
         */
        drinkFromWell(well) {
            assert(well, 'Well entity required for drinkFromWell');
            assert(well.type === GameConfig.entityTypes.well, 'Target must be a well');

            // Check if villager is within interaction range (same as player system)
            const dist = GameUtils.distance(this.position, well.position);
            if (dist > GameConfig.player.interactionThreshold) {
                console.warn(`[Villager] ${this.name} tried to drink from well but was out of range (${Math.round(dist)} > ${GameConfig.player.interactionThreshold})`);
                return false;
            }

            // Check if well has sufficient water (minimum 1.0 unit)
            if (well.waterLevel < 1.0) {
                console.warn(`[Villager] ${this.name} tried to drink from empty well`);
                return false;
            }

            // Restore water need
            assert(GameConfig.player.wellWaterRestore !== undefined, 'GameConfig.player.wellWaterRestore is missing - check GameConfig.js');
            this.needs.water = Math.min(GameConfig.needs.fullValue, this.needs.water + GameConfig.player.wellWaterRestore);

            // Reduce well water level (same as player system)
            well.waterLevel = Math.max(0, well.waterLevel - 1);

            console.log(`[Villager] ${this.name} drank from well at (${Math.round(well.position.x)}, ${Math.round(well.position.y)}) - water level now: ${well.waterLevel}`);
            return true;
        }

        /**
         * Retrieve items from storage
         * @param {Array} storageBoxes - Array of storage boxes
         * @param {string} type - Type of item to retrieve ('food' or 'burnable')
         * @returns {boolean} - Whether retrieval was successful
         */
        retrieveFromStorage(storageBoxes, type) {
            assert(storageBoxes, 'Storage boxes array required for retrieveFromStorage');
            assert(type === 'food' || type === 'burnable', 'Type must be food or burnable');

            // Find storage box with items of the requested type
            for (const storageBox of storageBoxes) {
                if (storageBox.type === GameConfig.entityTypes.storage_box && storageBox.items) {
                    for (let i = 0; i < storageBox.items.length; i++) {
                        const item = storageBox.items[i];
                        if (item && ((type === 'food' && GameUtils.isFood(item.type)) ||
                            (type === 'burnable' && GameUtils.isBurnable(item.type)))) {

                            // Find empty slot in villager inventory
                            const emptySlot = GameUtils.findEmptySlot(this.inventory);
                            if (emptySlot === -1) {
                                console.warn(`[Villager] ${this.name} inventory is full, cannot retrieve from storage`);
                                return false;
                            }

                            // Transfer item from storage to inventory
                            this.inventory[emptySlot] = { ...item };
                            storageBox.items[i] = null;

                            if (window.summaryLoggingEnabled) {
                                console.log(`[Villager] ${this.name} retrieved ${item.type} from storage`);
                            }
                            return true;
                        }
                    }
                }
            }

            // Only log this warning occasionally to avoid spam when storage is legitimately empty
            if (Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled) {
                console.warn(`[Villager] ${this.name} no ${type} found in storage`);
            }
            return false;
        }

        /**
         * Store items from inventory to storage
         * @param {Object} storageBox - The storage box to store in
         * @returns {boolean} - Whether storing was successful
         */
        storeItemsInStorage(storageBox) {
            assert(storageBox, 'Storage box required for storeItemsInStorage');
            assert(storageBox.type === GameConfig.entityTypes.storage_box, 'Target must be a storage box');

            let storedCount = 0;

            // Find items in inventory to store
            for (let i = 0; i < this.inventory.length; i++) {
                const item = this.inventory[i];
                if (item) {
                    // Find empty slot in storage
                    const emptySlot = GameUtils.findEmptySlot(storageBox.items);
                    if (emptySlot !== -1) {
                        // Transfer item from inventory to storage
                        storageBox.items[emptySlot] = { ...item };
                        this.inventory[i] = null;
                        storedCount++;
                    }
                }
            }

            if (storedCount > 0) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} stored ${storedCount} items in storage`);
                }
                return true;
            }

            console.warn(`[Villager] ${this.name} no items to store or storage is full`);
            return false;
        }

        /**
         * Add wood to a fire
         * @param {Object} fire - The fire entity
         * @returns {boolean} - Whether adding wood was successful
         */
        addWoodToFire(fire) {
            assert(fire, 'Fire entity required for addWoodToFire');
            assert(fire.type === GameConfig.entityTypes.fireplace, 'Target must be a fireplace');

            // Find burnable item in inventory
            let burnableSlot = -1;
            let burnableItem = null;
            for (let i = 0; i < this.inventory.length; i++) {
                const item = this.inventory[i];
                if (item && GameUtils.isBurnable(item.type)) {
                    burnableSlot = i;
                    burnableItem = item;
                    break;
                }
            }

            if (burnableSlot === -1) {
                console.warn(`[Villager] ${this.name} no burnable items in inventory to add to fire`);
                return false;
            }

            // Get the fire value of the specific item being burned (same as player system)
            const fireValue = GameUtils.getFireValue(burnableItem.type);
            assert(fireValue > 0, `Burnable item ${burnableItem.type} has no fire value`);

            // Add the item's fire value to the fire (same as player system)
            const oldWood = fire.wood;
            fire.wood = Math.min(GameConfig.fires.maxWood, fire.wood + fireValue);
            this.inventory[burnableSlot] = null;

            if (window.summaryLoggingEnabled) {
                console.log(`[Villager] ${this.name} burned ${burnableItem.type} for ${fireValue} wood at (${Math.round(fire.position.x)}, ${Math.round(fire.position.y)})`);
            }
            return true;
        }

        eatFood() {
            // Only allow eating if near a burning fire (same as player)
            // Use ActionExecutor's findNearestBurningFire method
            const nearbyFire = this.hierarchicalAI.actionExecutor.findNearestBurningFire();
            if (nearbyFire && GameUtils.isWithinInteractionDistance(this.position, nearbyFire.position, GameConfig.player.interactionThreshold)) {
                // Find food in inventory and eat it
                for (let i = 0; i < this.inventory.length; i++) {
                    const item = this.inventory[i];
                    if (item && GameUtils.isFood(item.type)) {
                        // Apply nutrition to villager
                        GameUtils.applyNutrition(this, item.type);
                        // Remove item from inventory
                        this.inventory[i] = null;

                        if (window.summaryLoggingEnabled) {
                            console.log(`[Villager] ${this.name} ate ${item.type} near fire at (${Math.round(nearbyFire.position.x)}, ${Math.round(nearbyFire.position.y)})`);
                        }
                        return true; // Successfully ate food
                    }
                }
                return false; // No food items found
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[Villager] ${this.name} cannot eat - no nearby burning fire`);
                }
                return false; // No nearby fire
            }
        }



        createVisuals(scene) {
            // Create villager emoji with default standing emoji
            const defaultEmoji = this.characterCustomization ?
                this.characterCustomization.getStateEmoji('standing') :
                GameConfig.characters.states.standing;

            this.phaserText = scene.add.text(this.position.x, this.position.y, defaultEmoji, {
                fontSize: GameConfig.player.fontSize,
                fontFamily: 'Arial'
            }).setOrigin(0.5);

            // Create name text
            this.nameText = scene.add.text(this.position.x, this.position.y - 60, this.name, {
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
            // Clean up individual stat text objects
            if (this.statTexts) {
                if (this.statTexts.temperature) {
                    this.statTexts.temperature.destroy();
                }
                if (this.statTexts.water) {
                    this.statTexts.water.destroy();
                }
                if (this.statTexts.calories) {
                    this.statTexts.calories.destroy();
                }
                if (this.statTexts.vitamins) {
                    this.statTexts.vitamins.destroy();
                }
                this.statTexts = null;
            }
        }
    }

    // === VILLAGER STATE MACHINE ===
    // Implements priority-based state management
    // 
    // DESIGN: This state machine evaluates states every frame and executes the highest priority
    // state that should be active. States can interrupt lower priority states (emergencies).
    // All resource gathering/usage is instant (no duration) as per design requirements.



    // === HIERARCHICAL STATE MACHINE CONSTANTS ===
    // Goal States (High Level - WHEN/WHAT)
    const GOAL_STATES = {
        SURVIVE: 'survive',        // Emergency needs (water <20%, calories <20%, temp <20%, fire <3 logs)
        REST: 'rest',              // Sleep schedule (22:00-07:00) - above maintenance but below survival
        MAINTAIN: 'maintain',       // Regular needs (water <50%, temp <70%, calories <60%, fire <10 logs)  
        CONTRIBUTE: 'contribute'    // Village tasks (forage food/burnable)
    };

    // Action States (Low Level - HOW)
    const ACTION_STATES = {
        FIND_RESOURCES: 'find_resources',      // Scan for available resources
        MOVE_TO_RESOURCE: 'move_to_resource',  // Move to specific resource
        COLLECT_RESOURCE: 'collect_resource',   // Collect single resource
        USE_FACILITY: 'use_facility',          // Use well/fire/etc
        STORE_ITEMS: 'store_items',            // Manage inventory
        SLEEP: 'sleep',                        // Sleep behavior
        WAIT: 'wait'
    };

    // Explicit priority order (lower number = higher priority)
    const GOAL_PRIORITY = {
        SURVIVE: 1,    // Highest - emergency needs
        REST: 2,        // Sleep schedule  
        MAINTAIN: 3,    // Regular needs
        CONTRIBUTE: 4   // Lowest - village tasks
    };


    // === HIERARCHICAL VILLAGER AI SYSTEM ===

    /**
     * Main AI controller for hierarchical state machine
     * Manages goal evaluation and action execution
     */
    class HierarchicalVillagerAI {
        constructor(villager) {
            this.villager = villager;

            // Startup delay - villagers wait before starting AI behavior (random 1-5 seconds per villager)
            this.startupDelay = this.villager.seededRandom.randomRange(
                GameConfig.villager.startup.minDelayMs,
                GameConfig.villager.startup.maxDelayMs
            );
            this.startupTime = Date.now();
            this.isStartupComplete = false;

            // Goal and action data structures
            this.goalData = {
                currentGoal: GOAL_STATES.MAINTAIN,
                goalStartTime: Date.now(),
                goalTargets: [],           // Resources/facilities needed for this goal
                goalSatisfied: false       // Whether goal conditions are met
            };

            this.actionData = {
                currentAction: ACTION_STATES.WAIT,
                actionStartTime: Date.now(),
                actionTargets: [],         // Specific entities to interact with
                actionProgress: 0,         // Progress toward completing action
                actionFailed: false,       // Whether action failed and needs replanning
                maxBatchSize: GameConfig.villager.collection.maxBatchSize,
                canStealFromOthers: false
            };

            // Initialize subsystems
            this.collectionManager = new CollectionManager(villager);
            this.goalEvaluator = new GoalEvaluator(villager, this.collectionManager);
            this.actionExecutor = new ActionExecutor(villager);

            // Assert we have required villager properties
            assert(villager.needs, 'Villager must have needs object');
            assert(villager.inventory, 'Villager must have inventory array');
            assert(villager.position, 'Villager must have position');
            assert(villager.campPosition, 'Villager must have campPosition');

            // Log initial state
            if (window.summaryLoggingEnabled) {
                console.log(`[HierarchicalVillagerAI] ${villager.name} initialized with goal: ${this.goalData.currentGoal}`);
                console.log(`[HierarchicalVillagerAI] ${villager.name} starting needs: T${villager.needs.temperature.toFixed(1)} W${villager.needs.water.toFixed(1)} C${villager.needs.calories.toFixed(1)} V[${villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                console.log(`[HierarchicalVillagerAI] ${villager.name} starting position: (${Math.round(villager.position.x)}, ${Math.round(villager.position.y)})`);
                console.log(`[HierarchicalVillagerAI] ${villager.name} startup delay: ${this.startupDelay}ms`);
            }
        }

        /**
         * Main update method - called every frame
         */
        update(deltaTime, gameTime, entities, storageBoxes) {
            // Don't update if villager is dead
            if (this.villager.isDead) {
                return;
            }

            // Check if startup delay is complete
            if (!this.isStartupComplete) {
                const elapsedTime = Date.now() - this.startupTime;
                if (elapsedTime >= this.startupDelay) {
                    this.isStartupComplete = true;
                    if (window.summaryLoggingEnabled) {
                        console.log(`[HierarchicalVillagerAI] ${this.villager.name} startup delay complete, beginning AI behavior`);
                    }
                } else {
                    // Still in startup delay - don't process AI
                    return;
                }
            }

            // Evaluate which goal should be active (highest priority)
            const newGoal = this.evaluateGoal(gameTime, entities, storageBoxes);

            // Handle goal transition
            if (newGoal !== this.goalData.currentGoal) {
                const oldGoal = this.goalData.currentGoal;

                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} GOAL TRANSITION: ${oldGoal} → ${newGoal}`);
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} needs at transition: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} position at transition: (${Math.round(this.villager.position.x)}, ${Math.round(this.villager.position.y)})`);
                }

                // Log nearby objects for goal transitions
                this.logNearbyObjects();

                this.transitionGoal(newGoal);
            }

            // Execute current goal behavior
            this.executeGoal(deltaTime, entities, storageBoxes);
        }

        /**
         * Evaluate which goal should be active based on priority
         */
        evaluateGoal(gameTime, entities, storageBoxes) {
            return this.goalEvaluator.evaluateGoal(gameTime, entities, storageBoxes);
        }

        /**
         * Execute the current goal
         */
        executeGoal(deltaTime, entities, storageBoxes) {
            // Execute goal-specific behavior
            switch (this.goalData.currentGoal) {
                case GOAL_STATES.SURVIVE:
                    this.executeSurviveGoal(deltaTime, entities, storageBoxes);
                    break;
                case GOAL_STATES.REST:
                    this.executeRestGoal(deltaTime, entities, storageBoxes);
                    break;
                case GOAL_STATES.MAINTAIN:
                    this.executeMaintainGoal(deltaTime, entities, storageBoxes);
                    break;
                case GOAL_STATES.CONTRIBUTE:
                    this.executeContributeGoal(deltaTime, entities, storageBoxes);
                    break;
                default:
                    console.warn(`[HierarchicalVillagerAI] Unknown goal: ${this.goalData.currentGoal}`);
                    break;
            }

            // Update collection manager AFTER action execution
            this.collectionManager.update(deltaTime, entities, storageBoxes);
        }

        /**
         * Transition to a new goal
         */
        transitionGoal(newGoal) {
            // Exit current goal
            this.exitGoal(this.goalData.currentGoal);

            // Enter new goal
            this.enterGoal(newGoal);

            // Update goal data
            this.goalData.currentGoal = newGoal;
            this.goalData.goalStartTime = Date.now();
            this.goalData.goalTargets = [];
            this.goalData.goalSatisfied = false;

            // Reset action state when goal changes
            this.transitionAction(ACTION_STATES.WAIT);
        }

        /**
         * Transition to a new action
         */
        transitionAction(newAction) {
            const oldAction = this.actionData.currentAction;

            if (window.summaryLoggingEnabled && oldAction !== newAction) {
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} ACTION TRANSITION: ${oldAction} → ${newAction}`);
            }

            // Exit current action
            this.exitAction(oldAction);

            // Enter new action
            this.enterAction(newAction);

            // Update action data
            this.actionData.currentAction = newAction;
            this.actionData.actionStartTime = Date.now();
            this.actionData.actionProgress = 0;
            this.actionData.actionFailed = false;
        }

        /**
         * Clear action data when starting a new action sequence
         */
        startNewActionSequence() {
            this.actionData.actionTargets = [];
            this.actionData.actionProgress = 0;
            this.actionData.actionFailed = false;
            this.actionData.currentActionType = null;
        }

        /**
         * Complete the current action sequence
         */
        completeActionSequence() {
            this.actionData.actionTargets = [];
            this.actionData.actionProgress = 0;
            this.actionData.actionFailed = false;
        }

        /**
         * Enter a new goal
         */
        enterGoal(goal) {
            if (window.summaryLoggingEnabled) {
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} entered goal: ${goal}`);
            }
        }

        /**
         * Exit current goal
         */
        exitGoal(goal) {
            // Clear any goal-specific data
        }

        /**
         * Enter a new action
         */
        enterAction(action) {
            if (window.summaryLoggingEnabled) {
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} entered action: ${action}`);
            }
        }

        /**
         * Exit current action
         */
        exitAction(action) {
            // Clear any action-specific data
        }

        /**
         * Execute survive goal (emergency needs)
         */
        executeSurviveGoal(deltaTime, entities, storageBoxes) {
            // Emergency needs - handle immediately
            if (this.villager.needs.water < GameConfig.villager.emergencyThresholds.water) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} SURVIVE: Executing drink action (emergency water need)`);
                }
                this.executeActionSequence('drink', deltaTime, entities, storageBoxes, true);
            } else if (this.villager.needs.calories < GameConfig.villager.emergencyThresholds.calories) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} SURVIVE: Executing eat action (emergency calories need)`);
                }
                this.executeActionSequence('eat', deltaTime, entities, storageBoxes, true);
            } else if (this.villager.needs.temperature < GameConfig.villager.emergencyThresholds.temperature) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} SURVIVE: Executing warmup action (emergency temperature need)`);
                }
                this.executeActionSequence('warmup', deltaTime, entities, storageBoxes, true);
            } else if (this.collectionManager.shouldRefillFire(true, entities)) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} SURVIVE: Executing fireRefill action (emergency fire need)`);
                }
                this.executeActionSequence('fireRefill', deltaTime, entities, storageBoxes, true);
            }
        }

        /**
         * Execute rest goal (sleep behavior)
         */
        executeRestGoal(deltaTime, entities, storageBoxes) {
            this.executeActionSequence('sleep', deltaTime, entities, storageBoxes, false);
        }

        /**
         * Execute maintain goal (regular needs)
         */
        executeMaintainGoal(deltaTime, entities, storageBoxes) {
            // Regular needs - handle in priority order
            if (window.summaryLoggingEnabled) {
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} executeMaintainGoal: water=${this.villager.needs.water}/${GameConfig.villager.regularThresholds.water}, temp=${this.villager.needs.temperature}/${GameConfig.villager.regularThresholds.temperature}, calories=${this.villager.needs.calories}/${GameConfig.villager.regularThresholds.calories}`);
            }

            if (this.villager.needs.water < GameConfig.villager.regularThresholds.water) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} MAINTAIN: Executing drink action (water need)`);
                }
                this.executeActionSequence('drink', deltaTime, entities, storageBoxes, false);
            } else if (this.villager.needs.temperature < GameConfig.villager.regularThresholds.temperature) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} MAINTAIN: Executing warmup action (temperature need)`);
                }
                this.executeActionSequence('warmup', deltaTime, entities, storageBoxes, false);
            } else if (this.villager.needs.calories < GameConfig.villager.regularThresholds.calories) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} MAINTAIN: Executing eat action (calories need)`);
                }
                this.executeActionSequence('eat', deltaTime, entities, storageBoxes, false);
            } else if (this.collectionManager.shouldRefillFire(false, entities)) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} MAINTAIN: Executing fireRefill action (fire maintenance)`);
                }
                this.executeActionSequence('fireRefill', deltaTime, entities, storageBoxes, false);
            } else {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} MAINTAIN: No actions needed, all needs satisfied`);
                }
            }
        }

        /**
         * Execute contribute goal (village tasks)
         */
        executeContributeGoal(deltaTime, entities, storageBoxes) {
            // Village tasks - forage for resources
            if (this.collectionManager.shouldForageFood(storageBoxes)) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} CONTRIBUTE: Executing forageFood action (village food supply)`);
                }
                this.executeActionSequence('forageFood', deltaTime, entities, storageBoxes, false);
            } else if (this.collectionManager.shouldForageBurnable(storageBoxes)) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} CONTRIBUTE: Executing forageBurnable action (village fuel supply)`);
                }
                this.executeActionSequence('forageBurnable', deltaTime, entities, storageBoxes, false);
            } else if (this.villager.isInventoryFull()) {
                // If inventory is full, store items
                if (window.summaryLoggingEnabled) {
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} CONTRIBUTE: Inventory full, storing items before next forage`);
                }
                this.executeActionSequence('storeItems', deltaTime, entities, storageBoxes, false);
            }
        }

        /**
         * Get the specific need this villager is trying to fulfill
         * @returns {string} Description of the need being addressed
         */
        getCurrentNeedDescription() {
            const currentGoal = this.goalData.currentGoal;

            switch (currentGoal) {
                case GOAL_STATES.SURVIVE:
                    // Check which emergency need is being addressed
                    if (this.villager.needs.water < GameConfig.villager.emergencyThresholds.water) {
                        return 'emergency water';
                    } else if (this.villager.needs.calories < GameConfig.villager.emergencyThresholds.calories) {
                        return 'emergency calories';
                    } else if (this.villager.needs.temperature < GameConfig.villager.emergencyThresholds.temperature) {
                        return 'emergency temp';
                    } else if (this.collectionManager.shouldRefillFire(true, this.villager.gameEntities)) {
                        return 'emergency fire';
                    }
                    return 'survive (no emergency)';

                case GOAL_STATES.MAINTAIN:
                    // Check which regular need is being addressed
                    if (this.villager.needs.water < GameConfig.villager.regularThresholds.water) {
                        return 'water';
                    } else if (this.villager.needs.temperature < GameConfig.villager.regularThresholds.temperature) {
                        return 'temp';
                    } else if (this.villager.needs.calories < GameConfig.villager.regularThresholds.calories) {
                        return 'calories';
                    } else if (this.collectionManager.shouldRefillFire(false, this.villager.gameEntities)) {
                        return 'fire';
                    }
                    return 'maintain (satisfied)';

                case GOAL_STATES.CONTRIBUTE:
                    // Check which contribution task is being done
                    if (this.collectionManager.shouldForageFood(this.villager.gameEntities?.filter(e => e.type === 'storage_box'))) {
                        return 'forage food';
                    } else if (this.collectionManager.shouldForageBurnable(this.villager.gameEntities?.filter(e => e.type === 'storage_box'))) {
                        return 'forage fuel';
                    }
                    return 'contribute (idle)';

                case GOAL_STATES.REST:
                    return 'sleep';

                default:
                    return 'unknown';
            }
        }

        /**
         * Execute a complete action sequence with proper state management
         */
        executeActionSequence(actionType, deltaTime, entities, storageBoxes, isEmergency = false) {
            // Validate parameters to catch parameter order issues
            assert(typeof actionType === 'string', `executeActionSequence: actionType must be a string, got ${typeof actionType}: ${actionType}`);
            assert(typeof deltaTime === 'number', `executeActionSequence: deltaTime must be a number, got ${typeof deltaTime}: ${deltaTime}`);
            assert(Array.isArray(entities), `executeActionSequence: entities must be an array, got ${typeof entities}: ${entities}`);
            assert(Array.isArray(storageBoxes), `executeActionSequence: storageBoxes must be an array, got ${typeof storageBoxes}: ${storageBoxes}`);
            assert(typeof isEmergency === 'boolean', `executeActionSequence: isEmergency must be a boolean, got ${typeof isEmergency}: ${isEmergency}`);

            const currentAction = this.actionData.currentAction;
            // Override isEmergency parameter with goal-based emergency status
            isEmergency = this.goalData.currentGoal === GOAL_STATES.SURVIVE;

            // Update collection strategies based on emergency status
            if (isEmergency) {
                this.actionData.maxBatchSize = GameConfig.villager.collection.emergencyBatchSize;
                this.actionData.canStealFromOthers = true;
            } else {
                this.actionData.maxBatchSize = GameConfig.villager.collection.maxBatchSize;
                this.actionData.canStealFromOthers = false;
            }

            // Execute action based on current action state
            switch (currentAction) {
                case ACTION_STATES.WAIT:
                    // Special case: Sleep, drink, and warmup actions go directly to their respective states
                    // since they don't need to find resources
                    if (actionType === 'sleep') {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} SLEEP_DIRECT: Bypassing resource finding for sleep action`);
                        }
                        this.transitionAction(ACTION_STATES.SLEEP);
                        this.actionExecutor.executeSleep(deltaTime, entities, storageBoxes);
                    } else if (actionType === 'drink' || actionType === 'warmup') {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} ${actionType.toUpperCase()}_DIRECT: Bypassing resource finding for ${actionType} action`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else if (actionType === 'eat' && this.collectionManager.hasFoodInInventory()) {
                        // Special case: If we want to eat and already have food in inventory, go directly to facility
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} EAT_DIRECT: Already have food in inventory, going directly to fire`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else if (actionType === 'fireRefill' && this.collectionManager.hasWoodInInventory()) {
                        // Special case: If we want to refill fire and already have wood in inventory, go directly to facility
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} FIREREFILL_DIRECT: Already have wood in inventory, going directly to fire`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else {
                        // Start action sequence for resource-based actions
                        this.startNewActionSequence(); // Clear data when starting new sequence
                        this.actionData.currentActionType = actionType; // Store the action type
                        this.transitionAction(ACTION_STATES.FIND_RESOURCES);
                        this.actionExecutor.executeFindResources(actionType, deltaTime, entities, storageBoxes, isEmergency);
                    }
                    break;

                case ACTION_STATES.FIND_RESOURCES:
                    // Special case: If this is a sleep, drink, or warmup action, transition directly to their respective states
                    // since they don't need to find resources
                    if (actionType === 'sleep') {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} SLEEP_DIRECT: Correcting from FIND_RESOURCES to SLEEP`);
                        }
                        this.transitionAction(ACTION_STATES.SLEEP);
                        this.actionExecutor.executeSleep(deltaTime, entities, storageBoxes);
                    } else if (actionType === 'drink' || actionType === 'warmup') {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} ${actionType.toUpperCase()}_DIRECT: Correcting from FIND_RESOURCES to USE_FACILITY`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else if (actionType === 'eat' && this.collectionManager.hasFoodInInventory()) {
                        // Special case: If we want to eat and already have food in inventory, go directly to facility
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} EAT_DIRECT: Already have food in inventory, going directly to fire`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else if (actionType === 'fireRefill' && this.collectionManager.hasWoodInInventory()) {
                        // Special case: If we want to refill fire and already have wood in inventory, go directly to facility
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} FIREREFILL_DIRECT: Already have wood in inventory, going directly to fire`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else {
                        // Check if we found a target
                        if (this.actionData.actionTargets.length > 0) {
                            this.transitionAction(ACTION_STATES.MOVE_TO_RESOURCE);
                            this.actionExecutor.executeMoveToResource(deltaTime, entities, storageBoxes);
                        } else {
                            // No target found, try again
                            this.actionExecutor.executeFindResources(actionType, deltaTime, entities, storageBoxes, isEmergency);
                        }
                    }
                    break;

                case ACTION_STATES.MOVE_TO_RESOURCE:
                    // Check if we already have the resource we need in inventory (optimization)
                    if (actionType === 'eat' && this.collectionManager.hasFoodInInventory()) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} EAT_DIRECT: Already have food in inventory, going directly to fire`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else if (actionType === 'fireRefill' && this.collectionManager.hasWoodInInventory()) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[HierarchicalVillagerAI] ${this.villager.name} FIREREFILL_DIRECT: Already have wood in inventory, going directly to fire`);
                        }
                        // Clear action targets for facility-based actions to prevent using old targets
                        this.actionData.actionTargets = [];
                        this.transitionAction(ACTION_STATES.USE_FACILITY);
                        this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    } else {
                        // Check if we're close enough to interact
                        if (this.actionData.actionTargets.length > 0) {
                            const target = this.actionData.actionTargets[0];
                            if (GameUtils.isWithinInteractionDistance(this.villager.position, target.position, GameConfig.player.interactionThreshold)) {
                                this.transitionAction(ACTION_STATES.COLLECT_RESOURCE);
                                this.actionExecutor.executeCollectResource(deltaTime, entities, storageBoxes);
                            } else {
                                // Keep moving
                                this.actionExecutor.executeMoveToResource(deltaTime, entities, storageBoxes);
                            }
                        } else {
                            // Target lost, go back to finding
                            this.transitionAction(ACTION_STATES.FIND_RESOURCES);
                            this.actionExecutor.executeFindResources(actionType, deltaTime, entities, storageBoxes, isEmergency);
                        }
                    }
                    break;

                case ACTION_STATES.COLLECT_RESOURCE:
                    // Check if collection is complete
                    if (this.actionData.actionProgress >= 1.0) {
                        // Determine if this action type requires immediate use or storage
                        const immediateUseActions = ['fireRefill', 'eat'];
                        const isImmediateUseAction = immediateUseActions.includes(this.actionData.currentActionType);

                        if (isImmediateUseAction) {
                            // For immediate use actions, go directly to USE_FACILITY
                            // instead of storing items, since we want to use them immediately

                            let facilityTarget = null;

                            if (this.actionData.currentActionType === 'fireRefill') {
                                // Find the villager's OWN fire to refill (not any fire)
                                facilityTarget = this.villager.fireplace;
                                if (facilityTarget && facilityTarget.wood >= GameConfig.fires.maxWood) {
                                    // Fire is already full, no need to refill
                                    facilityTarget = null;
                                }
                            } else if (this.actionData.currentActionType === 'eat') {
                                // For eating, find a nearby fire (same requirement as player)
                                facilityTarget = this.actionExecutor.findNearestBurningFire();
                            }

                            if (facilityTarget) {
                                this.actionData.actionTargets = [facilityTarget];
                                this.transitionAction(ACTION_STATES.USE_FACILITY);
                                this.actionExecutor.executeUseFacility(this.actionData.currentActionType, deltaTime, entities, storageBoxes);
                            } else {
                                // No facility to use, complete the action sequence
                                this.completeActionSequence();
                                this.transitionAction(ACTION_STATES.WAIT);
                            }
                        } else {
                            // For storage actions (forage), store items normally
                            this.transitionAction(ACTION_STATES.STORE_ITEMS);
                            this.actionExecutor.executeStoreItems(deltaTime, entities, storageBoxes);
                        }
                    } else {
                        // Continue collecting
                        this.actionExecutor.executeCollectResource(deltaTime, entities, storageBoxes);
                    }
                    break;

                case ACTION_STATES.STORE_ITEMS:
                    // Check if storage is complete
                    if (this.actionData.actionProgress >= 1.0) {
                        this.completeActionSequence(); // Clear data when completing sequence
                        this.transitionAction(ACTION_STATES.WAIT);
                    } else {
                        // Continue storing
                        this.actionExecutor.executeStoreItems(deltaTime, entities, storageBoxes);
                    }
                    break;

                case ACTION_STATES.USE_FACILITY:
                    // For facility usage (wells, fires, etc.)
                    this.actionExecutor.executeUseFacility(actionType, deltaTime, entities, storageBoxes);
                    break;

                case ACTION_STATES.SLEEP:
                    // For sleep behavior
                    this.actionExecutor.executeSleep(deltaTime, entities, storageBoxes);
                    break;

                default:
                    console.warn(`[HierarchicalVillagerAI] Unknown action state: ${currentAction}`);
                    this.transitionAction(ACTION_STATES.WAIT);
                    break;
            }
        }

        /**
         * Log nearby objects for debugging with hierarchical context
         */
        logNearbyObjects() {
            const nearbyObjects = [];

            // Find nearby entities
            for (const entity of this.villager.gameEntities) {
                const dist = GameUtils.distance(this.villager.position, entity.position);
                nearbyObjects.push({
                    type: entity.type,
                    emoji: entity.emoji,
                    distance: Math.round(dist),
                    position: `(${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})`
                });
            }

            // Sort by distance and take top 3
            nearbyObjects.sort((a, b) => a.distance - b.distance);
            const top3 = nearbyObjects.slice(0, 3);

            if (window.summaryLoggingEnabled) {
                // Log hierarchical context
                const currentGoal = this.goalData.currentGoal;
                const currentAction = this.actionData.currentAction;
                const goalTargets = this.goalData.goalTargets.length;
                const actionTargets = this.actionData.actionTargets.length;

                console.log(`[HierarchicalVillagerAI] ${this.villager.name} HIERARCHICAL_CONTEXT: Goal=${currentGoal}, Action=${currentAction}, GoalTargets=${goalTargets}, ActionTargets=${actionTargets}`);
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} STATS: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} POSITION: (${Math.round(this.villager.position.x)}, ${Math.round(this.villager.position.y)})`);
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} NEARBY: ${top3.map(obj => `${obj.type}${obj.emoji}@${obj.distance}px`).join(', ')}`);

                // Log action-specific context
                if (this.actionData.actionTargets.length > 0) {
                    const target = this.actionData.actionTargets[0];
                    console.log(`[HierarchicalVillagerAI] ${this.villager.name} CURRENT_TARGET: ${target.type}${target.emoji} at (${Math.round(target.position.x)}, ${Math.round(target.position.y)})`);
                }

                // Log goal satisfaction status
                console.log(`[HierarchicalVillagerAI] ${this.villager.name} GOAL_SATISFIED: ${this.goalData.goalSatisfied}, ACTION_FAILED: ${this.actionData.actionFailed}`);
            }
        }
    }

    /**
     * Evaluates which goal should be pursued based on villager needs and priorities
     */
    class GoalEvaluator {
        constructor(villager, collectionManager) {
            this.villager = villager;
            this.collectionManager = collectionManager;
        }

        /**
         * Evaluate which goal should be active based on priority
         */
        evaluateGoal(gameTime, entities, storageBoxes) {
            // gameTime is in seconds (same as playerState.currentTime)
            // Use global getCurrentTime for consistency
            const t = getCurrentTime({ currentTime: gameTime });
            const hour = t.hour;

            // Log evaluation context (but only occasionally to avoid spam)
            const shouldLogEvaluation = Math.random() < GameConfig.logging.loggingChance && window.summaryLoggingEnabled;
            if (shouldLogEvaluation) {
                console.log(`[GoalEvaluator] ${this.villager.name} evaluating goal at hour ${hour}`);
                console.log(`[GoalEvaluator] ${this.villager.name} current needs: T${this.villager.needs.temperature.toFixed(1)} W${this.villager.needs.water.toFixed(1)} C${this.villager.needs.calories.toFixed(1)} V[${this.villager.needs.vitamins.map(v => v.toFixed(1)).join(',')}]`);
            }

            // Evaluate goals in priority order
            if (this.evaluateSurviveGoal(gameTime, entities, storageBoxes)) {
                if (shouldLogEvaluation) console.log(`[GoalEvaluator] ${this.villager.name} choosing SURVIVE goal`);
                return GOAL_STATES.SURVIVE;
            }

            if (this.evaluateRestGoal(gameTime, entities, storageBoxes)) {
                if (shouldLogEvaluation) console.log(`[GoalEvaluator] ${this.villager.name} choosing REST goal`);
                return GOAL_STATES.REST;
            }

            if (this.evaluateMaintainGoal(gameTime, entities, storageBoxes)) {
                if (shouldLogEvaluation) console.log(`[GoalEvaluator] ${this.villager.name} choosing MAINTAIN goal`);
                return GOAL_STATES.MAINTAIN;
            }

            if (this.evaluateContributeGoal(gameTime, entities, storageBoxes)) {
                if (shouldLogEvaluation) console.log(`[GoalEvaluator] ${this.villager.name} choosing CONTRIBUTE goal`);
                return GOAL_STATES.CONTRIBUTE;
            }

            // Default to maintain if no specific goal is needed
            if (shouldLogEvaluation) console.log(`[GoalEvaluator] ${this.villager.name} choosing MAINTAIN goal (default)`);
            return GOAL_STATES.MAINTAIN;
        }

        /**
         * Evaluate if survival goal is needed (emergency needs)
         */
        evaluateSurviveGoal(gameTime, entities, storageBoxes) {
            // Emergency thresholds
            if (this.villager.needs.water < GameConfig.villager.emergencyThresholds.water) return true;
            if (this.villager.needs.calories < GameConfig.villager.emergencyThresholds.calories) return true;
            if (this.villager.needs.temperature < GameConfig.villager.emergencyThresholds.temperature) return true;

            // Emergency fire refill
            const ownFire = this.villager.fireplace;
            if (ownFire && ownFire.wood < GameConfig.villager.fireThresholds.emergency) return true;

            return false;
        }

        /**
         * Evaluate if rest goal is needed (sleep schedule)
         */
        evaluateRestGoal(gameTime, entities, storageBoxes) {
            // Use global getCurrentTime for consistency
            const t = getCurrentTime({ currentTime: gameTime });
            const hour = t.hour;
            // Check if it's sleep time using the shouldSleep helper
            return this.shouldSleep(hour);
        }

        /**
         * Evaluate if maintain goal is needed (regular needs)
         */
        evaluateMaintainGoal(gameTime, entities, storageBoxes) {
            // Regular thresholds
            if (this.villager.needs.water < GameConfig.villager.regularThresholds.water) return true;
            if (this.villager.needs.temperature < GameConfig.villager.regularThresholds.temperature) return true;
            if (this.villager.needs.calories < GameConfig.villager.regularThresholds.calories) return true;

            // Regular fire refill
            const ownFire = this.villager.fireplace;
            if (ownFire && ownFire.wood < GameConfig.villager.fireThresholds.regular) return true;

            return false;
        }

        /**
         * Evaluate if contribute goal is needed (village tasks)
         */
        evaluateContributeGoal(gameTime, entities, storageBoxes) {
            // Minimal logic: if inventory, personal storage, or communal storage have space, go forage
            const invFull = this.villager.inventory.every(item => item !== null);
            const personal = this.villager.personalStorageBox;
            const communal = this.villager.communalStorageBox;
            const personalFull = personal ? personal.items.every(item => item !== null) : true;
            const communalFull = communal ? communal.items.every(item => item !== null) : true;
            return !(invFull && personalFull && communalFull);
        }

        /**
         * Check if villager should sleep (adapted from existing shouldSleep)
         */
        shouldSleep(hour) {
            const sleepStart = GameConfig.villager.sleepSchedule.startHour;
            const sleepEnd = GameConfig.villager.sleepSchedule.endHour;

            if (sleepStart > sleepEnd) {
                // Sleep spans midnight (e.g., 22:00 to 07:00)
                return hour >= sleepStart || hour < sleepEnd;
            } else {
                // Sleep within same day (e.g., 22:00 to 06:00)
                return hour >= sleepStart && hour < sleepEnd;
            }
        }


    }

    /**
     * Executes specific actions for goals
     */
    class ActionExecutor {
        constructor(villager) {
            this.villager = villager;
        }

        /**
         * Validate that villager is properly initialized with required methods
         * @param {string[]} requiredMethods - Array of method names that must exist
         * @returns {boolean} - Whether villager is properly initialized
         */
        validateVillager(requiredMethods = []) {
            if (!this.villager) {
                console.error(`[ActionExecutor] Villager is null or undefined`);
                return false;
            }

            for (const method of requiredMethods) {
                if (typeof this.villager[method] !== 'function') {
                    console.error(`[ActionExecutor] Villager not properly initialized for ${this.villager.name}. ${method} method missing.`);
                    return false;
                }
            }

            return true;
        }

        /**
         * Execute find resources action (first step in action sequence)
         */
        executeFindResources(actionType, deltaTime, entities, storageBoxes, isEmergency = false) {
            let target = null;

            // Debug: Log what we're looking for
            if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance to log
                console.log(`[ActionExecutor] ${this.villager.name} FINDING: actionType=${actionType}, isEmergency=${isEmergency}`);
            }

            switch (actionType) {
                case 'drink':
                    target = this.findNearestWellWithWater();
                    break;
                case 'eat':
                    target = this.findNearestFood(entities, storageBoxes, isEmergency);
                    break;
                case 'warmup':
                    target = this.findNearestBurningFire();
                    break;
                case 'fireRefill':
                    target = this.findNearestBurnableAnywhere(entities, storageBoxes, isEmergency);
                    break;
                case 'forageFood':
                    target = this.findNearestFoodResource(entities);
                    break;
                case 'forageBurnable':
                    target = this.findNearestBurnableOnGround(entities);
                    break;
                case 'sleep':
                    target = this.findOwnSleepingBagOrNearestIfBusy();
                    break;
                default:
                    console.warn(`[ActionExecutor] Unknown action type: ${actionType}`);
                    return;
            }

            // Debug: Log if we found a target
            if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance to log
                if (target) {
                    console.log(`[ActionExecutor] ${this.villager.name} FOUND: ${target.type}${target.emoji} at (${Math.round(target.position.x)}, ${Math.round(target.position.y)})`);
                } else {
                    console.log(`[ActionExecutor] ${this.villager.name} NO_TARGET: actionType=${actionType}`);
                }
            }

            // Set the target for the action sequence
            if (target) {
                this.villager.hierarchicalAI.actionData.actionTargets = [target];
                this.villager.hierarchicalAI.actionData.actionProgress = 0;
            } else {
                // No target found, action failed
                this.villager.hierarchicalAI.actionData.actionFailed = true;
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.WAIT);
            }
        }

        /**
         * Execute move to resource action (second step in action sequence)
         */
        executeMoveToResource(deltaTime, entities, storageBoxes) {
            const target = this.villager.hierarchicalAI.actionData.actionTargets[0];
            if (!target) {
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.FIND_RESOURCES);
                return;
            }

            // Debug: Log movement attempt
            if (window.summaryLoggingEnabled && Math.random() < 0.1) { // 10% chance to log
                const distance = GameUtils.distance(this.villager.position, target.position);
                console.log(`[ActionExecutor] ${this.villager.name} MOVING: Target=${target.type}${target.emoji} at (${Math.round(target.position.x)}, ${Math.round(target.position.y)}), Distance=${Math.round(distance)}px, Delta=${deltaTime}ms`);
            }

            // Move towards target
            this.villager.moveTowards(target.position, deltaTime);

            // Check if we're close enough to interact
            if (GameUtils.isWithinInteractionDistance(this.villager.position, target.position, GameConfig.player.interactionThreshold)) {
                // We've reached the target, progress to collection
                this.villager.hierarchicalAI.actionData.actionProgress = 0.5;
            }
        }

        /**
         * Execute collect resource action (third step in action sequence)
         */
        executeCollectResource(deltaTime, entities, storageBoxes) {
            if (!this.validateVillager(['collectResource', 'retrieveFromStorage'])) {
                assert(this.villager, 'Villager must exist to transition action');
                assert(this.villager.hierarchicalAI, 'Villager hierarchicalAI must exist to transition action');
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.WAIT);
                return;
            }

            const target = this.villager.hierarchicalAI.actionData.actionTargets[0];
            if (!target) {
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.FIND_RESOURCES);
                return;
            }

            // Check if we're still close enough
            if (!GameUtils.isWithinInteractionDistance(this.villager.position, target.position, GameConfig.player.interactionThreshold)) {
                // Target moved or we moved away, go back to moving
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.MOVE_TO_RESOURCE);
                return;
            }

            // Determine what type of resource to collect based on the current action
            const currentActionType = this.villager.hierarchicalAI.actionData.currentActionType;
            let resourceType = null; // Default to null

            // Map action types to resource types
            if (currentActionType === 'fireRefill' || currentActionType === 'forageBurnable') {
                resourceType = 'burnable';
            } else if (currentActionType === 'eat' || currentActionType === 'forageFood') {
                resourceType = 'food';
            }

            // Assert that we found a valid resource type
            assert(resourceType !== null, `No resource type found for action type: ${currentActionType}`);

            // Perform the collection
            if (target.type === GameConfig.entityTypes.storage_box) {
                // Retrieve from storage with the correct resource type
                this.villager.retrieveFromStorage(storageBoxes, resourceType);
            } else {
                // Collect from world
                this.villager.collectResource(target);
            }

            // Mark collection as complete
            this.villager.hierarchicalAI.actionData.actionProgress = 1.0;
        }

        /**
         * Execute store items action (fourth step in action sequence)
         */
        executeStoreItems(deltaTime, entities, storageBoxes) {
            if (!this.validateVillager(['moveTowards', 'storeItemsInStorage'])) {
                assert(this.villager, 'Villager must exist to transition action');
                assert(this.villager.hierarchicalAI, 'Villager hierarchicalAI must exist to transition action');
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.WAIT);
                return;
            }

            // Check if villager has any items to store
            const hasItems = this.villager.inventory.some(item => item !== null);
            if (hasItems) {
                // Find storage box and move to it
                const storageBox = this.villager.personalStorageBox;
                if (storageBox) {
                    // Move towards storage box
                    this.villager.moveTowards(storageBox.position, deltaTime);

                    // If close enough, store items
                    if (GameUtils.isWithinInteractionDistance(this.villager.position, storageBox.position, GameConfig.player.interactionThreshold)) {
                        this.villager.storeItemsInStorage(storageBox);
                    }
                }
            }

            // Mark storage as complete
            this.villager.hierarchicalAI.actionData.actionProgress = 1.0;
        }

        /**
         * Execute use facility action (for wells, fires, etc.)
         */
        executeUseFacility(actionType, deltaTime, entities, storageBoxes) {
            if (!this.validateVillager(['drinkFromWell', 'addWoodToFire'])) {
                assert(this.villager, 'Villager must exist to transition action');
                assert(this.villager.hierarchicalAI, 'Villager hierarchicalAI must exist to transition action');
                this.villager.hierarchicalAI.transitionAction(ACTION_STATES.WAIT);
                return;
            }

            let target = this.villager.hierarchicalAI.actionData.actionTargets[0];

            // For drink actions, always find the nearest well (ignore any existing target)
            if (actionType === 'drink') {
                target = this.findNearestWellWithWater();
                if (target) {
                    this.villager.hierarchicalAI.actionData.actionTargets = [target];
                }
            }

            // For warmup actions, if no target is set, find the nearest burning fire
            if (actionType === 'warmup') {
                target = this.findNearestBurningFire();
                if (target) {
                    this.villager.hierarchicalAI.actionData.actionTargets = [target];
                }
            }

            // For fireRefill actions, if no target is set, find the villager's own fire
            if (actionType === 'fireRefill') {
                target = this.villager.fireplace;
                if (target && target.wood < GameConfig.fires.maxWood) {
                    this.villager.hierarchicalAI.actionData.actionTargets = [target];
                }
            }

            // For eat actions, if no target is set, find the nearest burning fire
            if (actionType === 'eat') {
                target = this.findNearestBurningFire();
                if (target) {
                    this.villager.hierarchicalAI.actionData.actionTargets = [target];
                }
            }

            target = this.villager.hierarchicalAI.actionData.actionTargets[0];
            assert(target, `[ActionExecutor] ${this.villager.name} executeUseFacility: No target set for actionType=${actionType}`);

            // Check if we're close enough
            if (!GameUtils.isWithinInteractionDistance(this.villager.position, target.position, GameConfig.player.interactionThreshold)) {
                // Move towards the facility
                this.villager.moveTowards(target.position, deltaTime);
                return;
            }

            // Perform the facility interaction
            switch (actionType) {
                case 'drink':
                    this.villager.drinkFromWell(target);
                    break;
                case 'warmup':
                    // Stay near fire to warm up
                    break;
                case 'fireRefill':
                    this.villager.addWoodToFire(target);
                    break;
                case 'eat':
                    // Eat food from inventory (requires nearby fire)
                    this.villager.eatFood();
                    break;
                default:
                    assert(false, `[ActionExecutor] Unknown facility action: ${actionType}`);
            }

            // Mark facility usage as complete
            this.villager.hierarchicalAI.actionData.actionProgress = 1.0;

            // Complete the action sequence for facility usage
            this.villager.hierarchicalAI.completeActionSequence();
            this.villager.hierarchicalAI.transitionAction(ACTION_STATES.WAIT);
        }

        /**
         * Execute sleep action (special case - doesn't follow normal sequence)
         */
        executeSleep(deltaTime, entities, storageBoxes) {
            if (!this.validateVillager(['moveTowards'])) {
                return;
            }

            const sleepingBag = this.findOwnSleepingBagOrNearestIfBusy();
            if (sleepingBag) {
                // Move towards sleeping bag
                this.villager.moveTowards(sleepingBag.position, deltaTime);

                // If close enough, sleep
                if (GameUtils.isWithinInteractionDistance(this.villager.position, sleepingBag.position, GameConfig.player.interactionThreshold)) {
                    // Sleep until morning - handled by main game loop
                    return;
                }
            }
        }

        /**
         * Execute drink action (adapted from existing executeDrink)
         */
        executeDrink(deltaTime, entities) {
            if (!this.validateVillager(['moveTowards', 'drinkFromWell'])) {
                return;
            }

            // Find nearest well
            const well = this.findNearestWellWithWater();
            if (well) {
                // Move towards well
                this.villager.moveTowards(well.position, deltaTime);

                // If close enough, drink
                if (GameUtils.isWithinInteractionDistance(this.villager.position, well.position, GameConfig.player.interactionThreshold)) {
                    const success = this.villager.drinkFromWell(well);

                    // If drinking was successful and water need is now satisfied, complete the action
                    if (success && this.villager.needs.water >= GameConfig.villager.regularThresholds.water) {
                        // Action completed successfully - villager has enough water
                        return;
                    }
                }
            }
        }

        /**
         * Execute eat action (adapted from existing executeEat)
         */
        executeEat(isEmergency, deltaTime, entities, storageBoxes) {
            if (!this.validateVillager(['moveTowards', 'retrieveFromStorage', 'collectResource'])) {
                return;
            }

            // Find nearest food source
            const foodSource = this.findNearestFood(entities, storageBoxes, isEmergency);
            if (foodSource) {
                // Move towards food source
                this.villager.moveTowards(foodSource.position, deltaTime);

                // If close enough, interact
                if (GameUtils.isWithinInteractionDistance(this.villager.position, foodSource.position, GameConfig.player.interactionThreshold)) {
                    if (foodSource.type === GameConfig.entityTypes.storage_box) {
                        // Retrieve from storage
                        this.villager.retrieveFromStorage(storageBoxes, 'food');
                    } else {
                        // Collect from world
                        this.villager.collectResource(foodSource);
                    }
                }
            }
        }

        /**
         * Execute warm up action (adapted from existing executeWarmUp)
         */
        executeWarmUp(deltaTime, entities) {
            if (!this.validateVillager(['moveTowards'])) {
                return;
            }

            // Find nearest burning fire
            const fire = this.findNearestBurningFire();
            if (fire) {
                // Move towards fire
                this.villager.moveTowards(fire.position, deltaTime);

                // If close enough, stay near fire
                if (GameUtils.isWithinInteractionDistance(this.villager.position, fire.position, GameConfig.player.interactionThreshold)) {
                    // Stay near fire to warm up
                    return;
                }
            }
        }

        /**
         * Execute fire refill action (adapted from existing executeFireRefill)
         */
        executeFireRefill(isEmergency, deltaTime, entities, storageBoxes) {
            if (!this.validateVillager(['moveTowards', 'retrieveFromStorage', 'collectResource', 'addWoodToFire'])) {
                return;
            }

            // Check if we have wood in inventory first
            let hasWoodInInventory = false;
            for (let i = 0; i < this.villager.inventory.length; i++) {
                const item = this.villager.inventory[i];
                if (item && GameUtils.isBurnable(item.type)) {
                    hasWoodInInventory = true;
                    break;
                }
            }

            if (hasWoodInInventory) {
                // We have wood, find a fire to refill
                const fire = this.villager.fireplace;
                if (fire && fire.wood < GameConfig.fires.maxWood) {
                    // Move towards fire
                    this.villager.moveTowards(fire.position, deltaTime);

                    // If close enough, add wood to fire
                    if (GameUtils.isWithinInteractionDistance(this.villager.position, fire.position, GameConfig.player.interactionThreshold)) {
                        const success = this.villager.addWoodToFire(fire);
                        if (success) {
                            // Fire refilled successfully, action complete
                            return;
                        }
                    }
                }
            } else {
                // No wood in inventory, check if inventory is full of non-burnables
                let inventoryFull = true;
                let hasNonBurnables = false;
                for (let i = 0; i < this.villager.inventory.length; i++) {
                    const item = this.villager.inventory[i];
                    if (!item) {
                        inventoryFull = false;
                        break;
                    } else if (!GameUtils.isBurnable(item.type)) {
                        hasNonBurnables = true;
                    }
                }

                // If inventory is full of non-burnables, we need to store them first
                if (inventoryFull && hasNonBurnables) {
                    // This should be handled by the action sequence going to STORE_ITEMS
                    // The executeStoreItems method will handle storing non-burnables
                    return;
                }

                // Collect burnables
                const woodSource = this.findNearestBurnableAnywhere(entities, storageBoxes, isEmergency);
                if (woodSource) {
                    // Move towards wood source
                    this.villager.moveTowards(woodSource.position, deltaTime);

                    // If close enough, interact
                    if (GameUtils.isWithinInteractionDistance(this.villager.position, woodSource.position, GameConfig.player.interactionThreshold)) {
                        if (woodSource.type === GameConfig.entityTypes.storage_box) {
                            // Retrieve from storage
                            this.villager.retrieveFromStorage(storageBoxes, 'burnable');
                        } else {
                            // Collect from world
                            this.villager.collectResource(woodSource);
                        }
                    }
                }
            }
        }


        /**
         * Helper methods (adapted from existing VillagerStateMachine)
         */
        findNearestWellWithWater() {
            if (!this.villager.gameEntities) {
                console.warn(`[ActionExecutor] ${this.villager.name} findNearestWellWithWater: gameEntities is null`);
                return null;
            }

            console.log(`[ActionExecutor] ${this.villager.name} findNearestWellWithWater: searching through ${this.villager.gameEntities.length} entities`);

            // Log all well entities for debugging
            const wellEntities = this.villager.gameEntities.filter(entity =>
                entity.type === GameConfig.entityTypes.well
            );
            console.log(`[ActionExecutor] ${this.villager.name} findNearestWellWithWater: found ${wellEntities.length} well entities`);

            wellEntities.forEach((well, index) => {
                console.log(`[ActionExecutor] ${this.villager.name} Well ${index}: type=${well.type}, waterLevel=${well.waterLevel}, position=(${Math.round(well.position.x)}, ${Math.round(well.position.y)})`);
            });

            const nearestWell = GameUtils.findNearestEntity(this.villager.gameEntities, this.villager.position, entity =>
                entity.type === GameConfig.entityTypes.well && entity.waterLevel >= 1
            );

            if (nearestWell) {
                console.log(`[ActionExecutor] ${this.villager.name} findNearestWellWithWater: found nearest well at (${Math.round(nearestWell.position.x)}, ${Math.round(nearestWell.position.y)}) with waterLevel=${nearestWell.waterLevel}, type=${nearestWell.type}`);
            } else {
                console.warn(`[ActionExecutor] ${this.villager.name} findNearestWellWithWater: no well with water found`);
            }

            return nearestWell;
        }

        findNearestFood(entities, storageBoxes, isEmergency) {
            // Find the nearest food resource by checking each type
            let nearestSource = null;
            let nearestDistance = Infinity;

            for (const foodType of GameUtils.ALL_FOOD_TYPES) {
                const result = this.findNearestResourceSource(entities, storageBoxes, foodType, isEmergency);
                if (result.source && result.distance < nearestDistance) {
                    nearestSource = result.source;
                    nearestDistance = result.distance;
                }
            }

            return nearestSource;
        }

        findNearestBurnableAnywhere(entities, storageBoxes, isEmergency) {
            // Find the nearest burnable resource by checking each type
            let nearestSource = null;
            let nearestDistance = Infinity;

            for (const burnableType of GameUtils.ALL_BURNABLE_TYPES) {
                const result = this.findNearestResourceSource(entities, storageBoxes, burnableType, isEmergency);
                if (result.source && result.distance < nearestDistance) {
                    nearestSource = result.source;
                    nearestDistance = result.distance;
                }
            }

            return nearestSource;
        }

        findNearestResourceSource(entities, storageBoxes, resourceType, isEmergency = false) {
            let nearestSource = null;
            let nearestDistance = Infinity;
            let sourceType = null; // 'storage' or 'world'

            // Safety check: ensure entities is iterable
            assert(Array.isArray(entities), `findNearestResourceSource: entities must be an array, got ${typeof entities}: ${entities}`);
            if (!entities || !Array.isArray(entities)) {
                console.warn(`[ActionExecutor] ${this.villager.name} findNearestResourceSource: entities is not an array, got:`, entities);
                return {
                    source: null,
                    distance: Infinity,
                    sourceType: null
                };
            }

            // Ensure resourceType is a valid resource (exists in resourceData)
            assert(GameConfig.resources.resourceData[resourceType],
                `findNearestResourceSource: resourceType '${resourceType}' must be in GameConfig.resources.resourceData`);

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
                        if (dist < nearestDistance) {
                            nearestSource = storageBox;
                            nearestDistance = dist;
                            sourceType = 'storage';
                        }
                        break; // Found one item of this type, no need to check more slots
                    }
                }
            }

            // Check world entities (only those in resourceData)
            for (const entity of entities) {
                // Only consider entities that are in resourceData (actual resources)
                if (GameConfig.resources.resourceData[entity.type] &&
                    entity.type === resourceType &&
                    this.isResourceSafeToCollect(entity)) {
                    const dist = GameUtils.distance(this.villager.position, entity.position);
                    if (dist < nearestDistance) {
                        nearestSource = entity;
                        nearestDistance = dist;
                        sourceType = 'world';
                    }
                }
            }

            return {
                source: nearestSource,
                distance: nearestDistance,
                sourceType: sourceType
            };
        }

        findNearestBurningFire() {
            if (!this.villager.gameEntities) return null;
            return GameUtils.findNearestEntity(this.villager.gameEntities, this.villager.position, entity =>
                entity.type === GameConfig.entityTypes.fireplace && entity.wood > 0
            );
        }

        findOwnSleepingBagOrNearestIfBusy() {
            if (!this.villager.gameEntities) return null;

            // First try to find own sleeping bag
            const ownSleepingBag = GameUtils.findNearestEntity(this.villager.gameEntities, this.villager.position, entity =>
                entity.type === GameConfig.entityTypes.sleeping_bag && entity === this.villager.sleepingBag
            );

            if (ownSleepingBag && !ownSleepingBag.isOccupied) {
                return ownSleepingBag;
            }

            // If own sleeping bag is busy or doesn't exist, find nearest available
            return GameUtils.findNearestEntity(this.villager.gameEntities, this.villager.position, entity =>
                entity.type === GameConfig.entityTypes.sleeping_bag && !entity.isOccupied
            );
        }

        findNearestFoodResource(entities) {
            assert(Array.isArray(entities), 'findNearestFoodResource: entities must be an array');
            if (!entities) return null;

            // Debug: Log entity count and types
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) {
                const foodEntities = entities.filter(e => GameUtils.isFood(e.type));
                const safeFoodEntities = foodEntities.filter(e => this.isResourceSafeToCollect(e));
                const goldenRuleFoodEntities = safeFoodEntities.filter(e => this.canCollectResourceWithGoldenRule(e, entities));
                console.log(`[ActionExecutor] ${this.villager.name} FOOD_SEARCH: total=${entities.length}, food=${foodEntities.length}, safe=${safeFoodEntities.length}, goldenRule=${goldenRuleFoodEntities.length}`);
            }

            return GameUtils.findNearestEntity(entities, this.villager.position, entity =>
                GameUtils.isFood(entity.type) &&
                this.isResourceSafeToCollect(entity) &&
                this.canCollectResourceWithGoldenRule(entity, entities)
            );
        }

        findNearestBurnableOnGround(entities) {
            if (!entities) return null;

            // Debug: Log entity count and types
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 5% chance to log
                const burnableEntities = entities.filter(e => GameUtils.isBurnable(e.type));
                const safeBurnableEntities = burnableEntities.filter(e => this.isResourceSafeToCollect(e));
                const goldenRuleBurnableEntities = safeBurnableEntities.filter(e => this.canCollectResourceWithGoldenRule(e, entities));
                console.log(`[ActionExecutor] ${this.villager.name} BURNABLE_SEARCH: total=${entities.length}, burnable=${burnableEntities.length}, safe=${safeBurnableEntities.length}, goldenRule=${goldenRuleBurnableEntities.length}`);
            }

            return GameUtils.findNearestEntity(entities, this.villager.position, entity =>
                GameUtils.isBurnable(entity.type) &&
                this.isResourceSafeToCollect(entity) &&
                this.canCollectResourceWithGoldenRule(entity, entities)
            );
        }

        canCollectResourceWithGoldenRule(entity, entities) {
            // Golden rule: only collect if there are enough resources in the area
            const minRequired = GameConfig.villager.foraging.minResourcesPerGridCell;
            const gridCell = this.getGridCellForPosition(entity.position);
            const countInCell = this.countResourcesInGridCell(entities, entity.type, gridCell);

            if (countInCell < minRequired) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[ActionExecutor] ${this.villager.name} GOLDEN_RULE: Skipping ${entity.type} - only ${countInCell} in grid cell (need ${minRequired}+)`);
                }
                return false;
            }

            return true;
        }

        isResourceSafeToCollect(entity) {
            // Skip already collected resources
            if (entity.collected) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[ActionExecutor] ${this.villager.name} GOLDEN_RULE: Skipping already collected resource ${entity.type}`);
                }
                return false;
            }

            // Skip poisonous food if configured
            if (GameConfig.villager.foraging.skipPoisonousFood && entity.isPoisonous) {
                if (window.summaryLoggingEnabled) {
                    console.log(`[ActionExecutor] ${this.villager.name} GOLDEN_RULE: Skipping poisonous food ${entity.type}`);
                }
                return false;
            }

            // Skip faster animals if configured
            if (GameConfig.villager.foraging.skipFasterAnimals && GameConfig.resources.resourceData[entity.type] && GameConfig.resources.resourceData[entity.type].category === 'animal') {
                // Use the actual procedurally generated runspeed for the animal
                const animalSpeed = GameUtils.getRunspeed(entity.type);
                const villagerSpeed = GameConfig.villager.moveSpeed;
                if (animalSpeed > villagerSpeed) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[ActionExecutor] ${this.villager.name} GOLDEN_RULE: Skipping faster animal ${entity.type} (speed: ${animalSpeed} vs villager: ${villagerSpeed})`);
                    }
                    return false;
                }
            }

            return true;
        }

        getGridCellForPosition(position) {
            const cellSize = GameConfig.world.tileSize;
            return {
                x: Math.floor(position.x / cellSize),
                y: Math.floor(position.y / cellSize)
            };
        }

        countResourcesInGridCell(entities, resourceType, gridCell) {
            let count = 0;
            const cellSize = GameConfig.world.tileSize;

            // Safety check: ensure entities is iterable
            if (!entities || !Array.isArray(entities)) {
                console.warn(`[ActionExecutor] ${this.villager.name} countResourcesInGridCell: entities is not an array, got:`, entities);
                return 0;
            }

            for (const entity of entities) {
                if (entity.type === resourceType && !entity.collected) {
                    const entityCell = {
                        x: Math.floor(entity.position.x / cellSize),
                        y: Math.floor(entity.position.y / cellSize)
                    };

                    if (entityCell.x === gridCell.x && entityCell.y === gridCell.y) {
                        count++;
                    }
                }
            }

            return count;
        }
    }

    /**
     * Manages resource collection logic
     */
    class CollectionManager {
        constructor(villager) {
            this.villager = villager;
        }

        /**
         * Update collection manager
         */
        update(deltaTime, entities, storageBoxes) {
            // Handle target invalidation and replanning
            this.handleTargetInvalidation(entities);

            // Update collection strategies based on current goal
            this.updateCollectionStrategies(deltaTime, entities, storageBoxes);
        }

        /**
         * Handle target invalidation - check if current targets are still valid
         */
        handleTargetInvalidation(entities) {
            const timeout = GameConfig.villager.collection.targetInvalidationTimeout;
            const now = Date.now();

            // Check if we have any targets that need validation
            if (this.villager.hierarchicalAI && this.villager.hierarchicalAI.actionData.actionTargets.length > 0) {
                for (let i = this.villager.hierarchicalAI.actionData.actionTargets.length - 1; i >= 0; i--) {
                    const target = this.villager.hierarchicalAI.actionData.actionTargets[i];

                    // Check if target is still valid
                    if (!this.isTargetValid(target, entities)) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[CollectionManager] ${this.villager.name} TARGET_INVALIDATED: ${target.type}${target.emoji} at (${Math.round(target.position.x)}, ${Math.round(target.position.y)})`);
                        }

                        // Remove invalid target
                        this.villager.hierarchicalAI.actionData.actionTargets.splice(i, 1);

                        // Mark action as failed to trigger replanning
                        this.villager.hierarchicalAI.actionData.actionFailed = true;
                    }
                }
            }
        }

        /**
         * Check if a target is still valid (exists and is collectible)
         */
        isTargetValid(target, entities) {
            if (!target) return false;

            // Find the target entity in the current entities list
            const entity = entities.find(e =>
                e.position &&
                Math.abs(e.position.x - target.position.x) < 1 &&
                Math.abs(e.position.y - target.position.y) < 1 &&
                e.type === target.type
            );

            if (!entity) return false;

            // Check if entity is still collectible (not already collected)
            if (entity.collected) return false;

            return true;
        }

        /**
         * Update collection strategies based on current goal and emergency status
         */
        updateCollectionStrategies(deltaTime, entities, storageBoxes) {
            if (!this.villager.hierarchicalAI) return;

            const currentGoal = this.villager.hierarchicalAI.goalData.currentGoal;
            const isEmergency = currentGoal === GOAL_STATES.SURVIVE;

            // Update batch collection settings based on emergency status
            if (isEmergency) {
                // Emergency mode: single item collection, can steal from others
                this.villager.hierarchicalAI.actionData.maxBatchSize = GameConfig.villager.collection.emergencyBatchSize;
                this.villager.hierarchicalAI.actionData.canStealFromOthers = true;
            } else {
                // Normal mode: batch collection, respect ownership
                this.villager.hierarchicalAI.actionData.maxBatchSize = GameConfig.villager.collection.maxBatchSize;
                this.villager.hierarchicalAI.actionData.canStealFromOthers = false;
            }
        }

        /**
         * Check if fire should be refilled (adapted from existing shouldRefillFire)
         */
        shouldRefillFire(isEmergency, entities) {
            const ownFire = this.villager.fireplace;
            const threshold = isEmergency ? GameConfig.villager.fireThresholds.emergency : GameConfig.villager.fireThresholds.regular;

            // If not currently in FIRE_REFILL, only enter if fire needs refilling
            return ownFire && ownFire.wood < threshold;
        }

        /**
         * Check if should forage for food (adapted from existing shouldForageFood)
         */
        shouldForageFood(storageBoxes) {
            // Check if inventory is full - if so, we should store items instead of foraging
            if (this.villager.isInventoryFull()) {
                if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) {
                    console.log(`[CollectionManager] ${this.villager.name} shouldForageFood=false: inventory full (${this.villager.inventory.filter(item => item !== null).length}/${GameConfig.player.inventorySize} slots)`);
                }
                return false; // Inventory full, should store items
            }

            // Check if storage boxes are full - if not, we should forage to fill them
            const communalStorage = this.villager.communalStorageBox;
            const personalStorage = this.villager.personalStorageBox;

            // Count food items in storage
            let communalFoodCount = 0;
            let personalFoodCount = 0;

            if (communalStorage) {
                communalFoodCount = communalStorage.items.filter(item => item && GameUtils.isFood(item.type)).length;
            }

            if (personalStorage) {
                personalFoodCount = personalStorage.items.filter(item => item && GameUtils.isFood(item.type)).length;
            }

            // Check if storage is full (using GameConfig capacities)
            const communalCapacity = GameConfig.storage.communalCapacity;
            const personalCapacity = GameConfig.storage.personalCapacity;

            // If either storage isn't full of food, we should forage
            if (communalFoodCount < communalCapacity || personalFoodCount < personalCapacity) {
                // Debug logging (occasional to avoid spam)
                if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) {
                    console.log(`[CollectionManager] ${this.villager.name} shouldForageFood=true: communal=${communalFoodCount}/${communalCapacity}, personal=${personalFoodCount}/${personalCapacity}`);
                }
                return true;
            }

            // Both storages are full of food, no need to forage
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) {
                console.log(`[CollectionManager] ${this.villager.name} shouldForageFood=false: storages full`);
            }
            return false;
        }

        /**
         * Check if should forage for burnable resources (adapted from existing shouldForageBurnable)
         */
        shouldForageBurnable(storageBoxes) {
            // Check if inventory is full - if so, we should store items instead of foraging
            if (this.villager.isInventoryFull()) {
                if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) {
                    console.log(`[CollectionManager] ${this.villager.name} shouldForageBurnable=false: inventory full (${this.villager.inventory.filter(item => item !== null).length}/${GameConfig.player.inventorySize} slots)`);
                }
                return false; // Inventory full, should store items
            }

            // Check if storage boxes are full - if not, we should forage to fill them
            const communalStorage = this.villager.communalStorageBox;
            const personalStorage = this.villager.personalStorageBox;

            // Count burnable items in storage
            let communalBurnableCount = 0;
            let personalBurnableCount = 0;

            if (communalStorage) {
                communalBurnableCount = communalStorage.items.filter(item => item && GameUtils.isBurnable(item.type)).length;
            }

            if (personalStorage) {
                personalBurnableCount = personalStorage.items.filter(item => item && GameUtils.isBurnable(item.type)).length;
            }

            // Check if storage is full (using GameConfig capacities)
            const communalCapacity = GameConfig.storage.communalCapacity;
            const personalCapacity = GameConfig.storage.personalCapacity;

            // If either storage isn't full of burnable, we should forage
            if (communalBurnableCount < communalCapacity || personalBurnableCount < personalCapacity) {
                // Debug logging (occasional to avoid spam)
                if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 10% chance
                    console.log(`[CollectionManager] ${this.villager.name} shouldForageBurnable=true: communal=${communalBurnableCount}/${communalCapacity}, personal=${personalBurnableCount}/${personalCapacity}`);
                }
                return true;
            }

            // Both storages are full of burnable, no need to forage
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 10% chance
                console.log(`[CollectionManager] ${this.villager.name} shouldForageBurnable=false: storages full`);
            }
            return false;
        }

        hasWoodInInventory() {
            return this.villager.inventory.some(item => item && GameUtils.isBurnable(item.type));
        }

        hasFoodInInventory() {
            return this.villager.inventory.some(item => item && GameUtils.isFood(item.type));
        }
    }

    // === END: HIERARCHICAL VILLAGER AI SYSTEM ===

    function generateVillagerName(seededRandom) {
        assert(seededRandom, 'SeededRandom instance required for generateVillagerName');
        return GameConfig.villager.villagerNames[seededRandom.randomInt(0, GameConfig.villager.villagerNames.length - 1)];
    }
    // === END: Villager AI System ===

    class IntroScene extends Phaser.Scene {
        constructor() {
            super({ key: 'IntroScene' });
        }

        preload() {
            // No assets to preload for intro - using text only
        }

        create() {
            console.log('[Intro] IntroScene create called');

            // Check if we should show intro or skip directly to main game
            const urlParams = new URLSearchParams(window.location.search);
            const hasSeed = urlParams.get('seed');

            if (hasSeed) {
                // Skip intro and go directly to main game
                console.log('[Intro] Seed parameter found, skipping intro');
                this.scene.start('MainScene');
                return;
            }

            const w = this.cameras.main.width;
            const h = this.cameras.main.height;

            // Game title (top center) - fixed to camera viewport
            const titleText = this.add.text(window.innerWidth / 2, 145, 'Participant Observer', {
                fontSize: '24px',
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: GameConfig.ui.colors.boxBackground,
                padding: GameConfig.ui.dimensions.textPadding.large
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.overlayContent);

            // Get current seed and generate planet name
            const currentSeed = getCurrentSeed();
            const seededRandom = new SeededRandom(currentSeed);
            const planetName = GameConfig.intro.planetNames[seededRandom.randomInt(0, GameConfig.intro.planetNames.length - 1)];
            const fullPlanetName = `${planetName} ${currentSeed}`;

            // Calculate log dimensions - make it look like a real log entry
            const logWidth = Math.min(600, w - 100);
            const logHeight = 520;
            const logX = w / 2;
            const logY = h / 2;

            // Background overlay
            const bg = this.add.rectangle(w / 2, h / 2, w, h, GameConfig.intro.overlayColor, GameConfig.intro.overlayAlpha)
                .setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlay).setScrollFactor(0);

            // Log background - looks like a terminal/computer screen
            const logBg = this.add.rectangle(logX, logY, logWidth, logHeight, 0x001122, 0.95)
                .setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0)
                .setStrokeStyle(2, 0x00ff00);

            // Title - left aligned
            const title = this.add.text(logX - logWidth / 2 + 30, logY - logHeight / 2 + 30, GameConfig.intro.survivorLog.title,
                { fontSize: GameConfig.intro.titleSize, fontFamily: 'monospace', color: GameConfig.intro.titleColor })
                .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Planet name and timestamp - left aligned
            const planetText = this.add.text(logX - logWidth / 2 + 30, logY - logHeight / 2 + 70, `${fullPlanetName}: ${GameConfig.intro.survivorLog.timestamp}`,
                { fontSize: GameConfig.intro.contentSize, fontFamily: 'monospace', color: GameConfig.intro.textColor })
                .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Content lines - left aligned with proper word wrapping
            const contentLines = [];
            let currentY = logY - logHeight / 2 + 140;
            const maxLineWidth = logWidth - 60; // 30px padding on each side

            for (const line of GameConfig.intro.survivorLog.content) {
                if (line.trim() === '') {
                    // Empty line - add extra spacing
                    currentY += parseInt(GameConfig.intro.contentSize) + GameConfig.intro.lineSpacing;
                    continue;
                }

                // Word wrap the text
                const words = line.split(' ');
                let currentLine = '';
                let lineCount = 0;

                for (const word of words) {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    const testWidth = this.add.text(0, 0, testLine, { fontSize: GameConfig.intro.contentSize, fontFamily: 'monospace' }).width;

                    if (testWidth > maxLineWidth && currentLine) {
                        // Add current line
                        const lineText = this.add.text(logX - logWidth / 2 + 30, currentY, currentLine,
                            { fontSize: GameConfig.intro.contentSize, fontFamily: 'monospace', color: GameConfig.intro.textColor })
                            .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
                        contentLines.push(lineText);
                        currentY += parseInt(GameConfig.intro.contentSize) + GameConfig.intro.lineSpacing;
                        currentLine = word;
                        lineCount++;
                    } else {
                        currentLine = testLine;
                    }
                }

                // Add the last line
                if (currentLine) {
                    const lineText = this.add.text(logX - logWidth / 2 + 30, currentY, currentLine,
                        { fontSize: GameConfig.intro.contentSize, fontFamily: 'monospace', color: GameConfig.intro.textColor })
                        .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
                    contentLines.push(lineText);
                    currentY += parseInt(GameConfig.intro.contentSize) + GameConfig.intro.lineSpacing;
                }
            }

            // Button - positioned below the log content
            const button = this.add.text(logX, currentY + 70, GameConfig.intro.buttonText,
                {
                    fontSize: GameConfig.intro.buttonSize, fontFamily: 'monospace', color: GameConfig.intro.textColor,
                    backgroundColor: GameConfig.intro.buttonColor, padding: GameConfig.ui.dimensions.buttonPadding.large
                })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Button hover effect
            button.on('pointerover', () => {
                button.setBackgroundColor(GameConfig.intro.buttonHoverColor);
            });
            button.on('pointerout', () => {
                button.setBackgroundColor(GameConfig.intro.buttonColor);
            });

            // Button click handler - start the main game scene
            button.on('pointerdown', () => {
                if (this._isTransitioning) return; // Check first
                this._isTransitioning = true;

                console.log('[Intro] Button clicked, starting main game');
                this.scene.start('MainScene');
            });

            // Store references for cleanup
            this._introElements = [bg, logBg, title, planetText, ...contentLines, button];
            this._isTransitioning = false;
        }

        update(time, delta) {
            // Empty update method to ensure the scene has an active game loop
            // This is required for tweens to work properly
        }

        shutdown() {
            // Clean up intro elements
            if (this._introElements) {
                this._introElements.forEach(obj => obj.destroy());
                this._introElements = null;
            }
        }
    }

    class OutroScene extends Phaser.Scene {
        constructor() {
            super({ key: 'OutroScene' });
        }

        preload() {
            // No assets to preload for outro - using text only
        }

        create() {
            console.log('[Outro] OutroScene create called');

            const w = this.cameras.main.width;
            const h = this.cameras.main.height;

            // Game title (top center) - fixed to camera viewport
            const titleText = this.add.text(window.innerWidth / 2, 145, 'Participant Observer', {
                fontSize: '24px',
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: GameConfig.ui.colors.boxBackground,
                padding: GameConfig.ui.dimensions.textPadding.large
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.overlayContent);

            // Get current seed and generate planet name
            const currentSeed = getCurrentSeed();
            const seededRandom = new SeededRandom(currentSeed);
            const planetName = GameConfig.intro.planetNames[seededRandom.randomInt(0, GameConfig.intro.planetNames.length - 1)];
            const fullPlanetName = `${planetName} ${currentSeed}`;

            // Calculate log dimensions - make it look like a real log entry
            const logWidth = Math.min(600, w - 100);
            const logHeight = 550;
            const logX = w / 2;
            const logY = h / 2;

            // Background overlay
            const bg = this.add.rectangle(w / 2, h / 2, w, h, GameConfig.outro.overlayColor, GameConfig.outro.overlayAlpha)
                .setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlay).setScrollFactor(0);

            // Log background - looks like a terminal/computer screen
            const logBg = this.add.rectangle(logX, logY, logWidth, logHeight, 0x001122, 0.95)
                .setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0)
                .setStrokeStyle(2, 0xff0000); // Red border for death

            // Title - left aligned
            const title = this.add.text(logX - logWidth / 2 + 30, logY - logHeight / 2 + 30, GameConfig.outro.deathLog.title,
                { fontSize: GameConfig.outro.titleSize, fontFamily: 'monospace', color: GameConfig.outro.titleColor })
                .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Planet name and timestamp - left aligned
            const planetText = this.add.text(logX - logWidth / 2 + 30, logY - logHeight / 2 + 70, `${fullPlanetName}: ${GameConfig.outro.deathLog.timestamp}`,
                { fontSize: GameConfig.outro.contentSize, fontFamily: 'monospace', color: GameConfig.outro.textColor })
                .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Get player stats from the data passed to this scene
            const playerStats = this.scene.settings.data;
            assert(playerStats, 'Player stats data is required for death log');
            const needs = playerStats.needs;
            assert(needs, 'Player needs data is required for death log');
            const causeOfDeath = playerStats.causeOfDeath;
            assert(causeOfDeath, 'Cause of death is required for death log');

            // Content lines - left aligned with proper word wrapping
            const contentLines = [];
            let currentY = logY - logHeight / 2 + 140;
            const maxLineWidth = logWidth - 60; // 30px padding on each side

            for (const line of GameConfig.outro.deathLog.content) {
                if (line.trim() === '') {
                    // Empty line - add extra spacing
                    currentY += parseInt(GameConfig.outro.contentSize) + GameConfig.outro.lineSpacing;
                    continue;
                }

                // Replace placeholders with actual values
                let processedLine = line
                    .replace('{temperature}', Math.round(needs.temperature))
                    .replace('{water}', Math.round(needs.water))
                    .replace('{calories}', Math.round(needs.calories))
                    .replace('{vitaminA}', Math.round(needs.vitamins[0]))
                    .replace('{vitaminB}', Math.round(needs.vitamins[1]))
                    .replace('{vitaminC}', Math.round(needs.vitamins[2]))
                    .replace('{vitaminD}', Math.round(needs.vitamins[3]))
                    .replace('{vitaminE}', Math.round(needs.vitamins[4]))
                    .replace('{causeOfDeath}', causeOfDeath);

                // Word wrap the text
                const words = processedLine.split(' ');
                let currentLine = '';
                let lineCount = 0;

                for (const word of words) {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    const testWidth = this.add.text(0, 0, testLine, { fontSize: GameConfig.outro.contentSize, fontFamily: 'monospace' }).width;

                    if (testWidth > maxLineWidth && currentLine) {
                        // Add current line
                        const lineText = this.add.text(logX - logWidth / 2 + 30, currentY, currentLine,
                            { fontSize: GameConfig.outro.contentSize, fontFamily: 'monospace', color: GameConfig.outro.textColor })
                            .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
                        contentLines.push(lineText);
                        currentY += parseInt(GameConfig.outro.contentSize) + GameConfig.outro.lineSpacing;
                        currentLine = word;
                        lineCount++;
                    } else {
                        currentLine = testLine;
                    }
                }

                // Add the last line
                if (currentLine) {
                    const lineText = this.add.text(logX - logWidth / 2 + 30, currentY, currentLine,
                        { fontSize: GameConfig.outro.contentSize, fontFamily: 'monospace', color: GameConfig.outro.textColor })
                        .setOrigin(0, 0).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
                    contentLines.push(lineText);
                    currentY += parseInt(GameConfig.outro.contentSize) + GameConfig.outro.lineSpacing;
                }
            }

            // --- Add Restart Button ---
            // Button positioned below the log content (like intro button)
            const buttonY = currentY + 70; // Same positioning as intro button
            const buttonX = logX;

            // Button styled like intro button (text with background, not rectangle)
            const restartBtn = this.add.text(buttonX, buttonY, 'RESTART (NEW WORLD)',
                {
                    fontSize: GameConfig.intro.buttonSize,
                    fontFamily: 'monospace',
                    color: GameConfig.intro.textColor,
                    backgroundColor: GameConfig.intro.buttonColor,
                    padding: GameConfig.ui.dimensions.buttonPadding.large
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setDepth(GameConfig.ui.zIndex.overlayContent)
                .setScrollFactor(0);

            // Button hover effect (same as intro)
            restartBtn.on('pointerover', () => {
                restartBtn.setBackgroundColor(GameConfig.intro.buttonHoverColor);
            });
            restartBtn.on('pointerout', () => {
                restartBtn.setBackgroundColor(GameConfig.intro.buttonColor);
            });

            // Button click handler: skip intro and go directly to main scene with new seed
            restartBtn.on('pointerdown', () => {
                if (this._isTransitioning) return; // Prevent double-clicks
                this._isTransitioning = true;

                console.log('[Outro] Restart button clicked, starting new game with random seed');

                // Generate new random seed
                const newSeed = Math.floor(Math.random() * 999) + 1;

                // Update URL with new seed and skip intro
                const url = new URL(window.location.href);
                url.searchParams.set('seed', newSeed.toString());
                window.history.replaceState({}, '', url.pathname + url.search);

                // Start main scene directly (skips intro)
                this.scene.start('MainScene');
            });

            // Assert button is present
            assert(restartBtn, 'Restart button must be created on death screen');

            // Add to outro elements for cleanup
            this._outroElements = [bg, logBg, title, planetText, ...contentLines, restartBtn];
            this._isTransitioning = false;
        }

        update(time, delta) {
            // Empty update method to ensure the scene has an active game loop
            // This is required for tweens to work properly
        }

        shutdown() {
            // Clean up outro elements
            if (this._outroElements) {
                this._outroElements.forEach(obj => obj.destroy());
                this._outroElements = null;
            }
        }
    }

    class MainScene extends Phaser.Scene {
        constructor() {
            super({ key: 'MainScene' });
            this.lastPropagationDay = -1; // Track last propagation day to prevent duplicates
            this.gates = []; // Array to store all gates for future use
        }
        preload() { }
        create() {
            // Start with fade-in effect
            this.startFadeIn();

            // --- World/entities ---
            this.entities = [];
            const currentSeed = getCurrentSeed();
            console.log(`[World Generation] Using seed: ${currentSeed}`);
            this.noise = new PerlinNoise(currentSeed);
            this.seededRandom = new SeededRandom(currentSeed);

            // Create character customization system for consistent appearance
            this.characterCustomization = new CharacterCustomization(this.seededRandom);

            // Initialize resource generation system
            this.resourceGeneration = new ResourceGeneration(this.seededRandom);

            // Make ResourceGeneration globally accessible for debugging
            window.resourceGeneration = this.resourceGeneration;

            // Generate biome data first
            this.generateBiomeData();

            // Create ground texture for better navigation (after noise is initialized)
            this.createGroundTexture();

            // Create wall system between grid cells (includes gates)
            console.log('[MainScene] Creating wall system...');
            const wallStartTime = performance.now();
            this.createWallSystem();
            const wallEndTime = performance.now();
            console.log(`[MainScene] Wall system created in ${(wallEndTime - wallStartTime).toFixed(2)}ms`);

            // Initialize A* pathfinding system (after walls AND gates are created)
            console.log('[MainScene] Initializing pathfinding system...');
            const pathfinderStartTime = performance.now();
            this.pathfinder = new Pathfinder(this, GameConfig.world.width, GameConfig.world.height);
            const pathfinderEndTime = performance.now();
            console.log(`[MainScene] Pathfinding system initialized in ${(pathfinderEndTime - pathfinderStartTime).toFixed(2)}ms`);

            // Initialize blocked grid after gates are created
            console.log('[MainScene] Initializing blocked grid after gates are created...');
            const gridStartTime = performance.now();
            this.pathfinder.initializeBlockedGridAfterGates();
            const gridEndTime = performance.now();
            console.log(`[MainScene] Blocked grid initialized in ${(gridEndTime - gridStartTime).toFixed(2)}ms`);

            const cfg = GameConfig.world;

            // Find central biome for camp placement
            const centralBiome = this.findCentralBiome();
            const centerX = centralBiome.x;
            const centerY = centralBiome.y;

            console.log(`[World Generation] Placing village in ${centralBiome.biome.type} biome at (${Math.round(centerX)}, ${Math.round(centerY)})`);

            // --- Village center (no visual, just reference point) ---
            const villageCenter = { position: { x: centerX, y: centerY }, type: 'village_center' };

            const offx = 300;
            const offy = 100;

            // --- Village well (near center with slight variation) ---
            const wellOffset = {
                x: this.seededRandom.randomRange(-100, 100) - offx,
                y: this.seededRandom.randomRange(-100, 100) - offy
            };
            const villageWell = {
                position: { x: centerX + wellOffset.x, y: centerY + wellOffset.y },
                type: GameConfig.entityTypes.well, emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel
            };
            this.entities.push(villageWell);

            // --- Communal storage (near center but separate from well) ---
            const storageOffset = {
                x: this.seededRandom.randomRange(-120, 120) - offx,
                y: this.seededRandom.randomRange(-120, 120) - offy
            };
            // Ensure storage isn't too close to well
            const minWellStorageDistance = 80;
            if (Math.abs(storageOffset.x - wellOffset.x) < minWellStorageDistance &&
                Math.abs(storageOffset.y - wellOffset.y) < minWellStorageDistance) {
                storageOffset.x += (storageOffset.x > 0 ? 100 : -100);
            }
            const communalStorage = {
                position: { x: centerX + storageOffset.x, y: centerY + storageOffset.y },
                type: GameConfig.entityTypes.storage_box, emoji: '📦',
                capacity: GameConfig.storage.communalCapacity,
                items: new Array(GameConfig.storage.communalCapacity).fill(null)
            };
            this.entities.push(communalStorage);

            // --- Organic camp placement around center ---
            this.camps = this.createOrganicCampClusters(centerX - offx, centerY - offy, cfg.villagerCount);

            // --- Create camp facilities for each camp ---
            for (let i = 0; i < cfg.villagerCount; i++) {
                const camp = this.camps[i];
                const facilities = this.placeCampFacilities(camp.position, i);

                // Fireplace
                const initialWood = this.seededRandom.randomRange(GameConfig.fires.initialWoodRange.min, GameConfig.fires.initialWoodRange.max);
                this.entities.push({
                    position: facilities.fireplace,
                    type: GameConfig.entityTypes.fireplace,
                    emoji: '🔥',
                    isBurning: true,
                    wood: initialWood,
                    maxWood: GameConfig.fires.maxWood,
                    villagerId: i
                });

                // Sleeping bag
                this.entities.push({
                    position: facilities.sleepingBag,
                    type: GameConfig.entityTypes.sleeping_bag,
                    emoji: '🛏️',
                    isOccupied: false,
                    villagerId: i
                });

                // Personal storage
                this.entities.push({
                    position: facilities.storage,
                    type: GameConfig.entityTypes.storage_box,
                    emoji: '📦',
                    capacity: GameConfig.storage.personalCapacity,
                    items: new Array(GameConfig.storage.personalCapacity).fill(null),
                    isPersonal: true,
                    villagerId: i
                });
            }
            // --- Player start position (at camp 0's fireplace) ---
            const playerFireplace = this.entities.find(e =>
                e.type === GameConfig.entityTypes.fireplace &&
                e.villagerId === 0
            );
            assert(playerFireplace, 'Player fireplace not found for camp 0');

            this.playerStartPosition = {
                x: playerFireplace.position.x + 30,
                y: playerFireplace.position.y + 40
            };

            // === ADD RANDOM INITIAL ITEMS TO STORAGE BOXES ===
            // Add random items to communal storage
            const initialCommunalStorageBox = this.entities.find(e => e.type === GameConfig.entityTypes.storage_box && !e.isPersonal);
            assert(initialCommunalStorageBox, 'Communal storage box not found during initialization');

            // Add random wood and food to communal storage based on config
            const communalWoodCount = 6;//this.seededRandom.randomInt(GameConfig.storage.initialItems.wood.min, GameConfig.storage.initialItems.wood.max);
            const communalFoodCount = this.seededRandom.randomInt(GameConfig.storage.initialItems.food.min, GameConfig.storage.initialItems.food.max);

            // Add burnable resources to communal storage
            for (let i = 0; i < communalWoodCount; i++) {
                const emptySlot = GameUtils.findEmptySlot(initialCommunalStorageBox.items);
                if (emptySlot !== -1) {
                    const burnableType = GameUtils.ALL_BURNABLE_TYPES[this.seededRandom.randomInt(0, GameUtils.ALL_BURNABLE_TYPES.length - 1)];
                    const burnableData = GameConfig.resources.resourceData[burnableType];
                    initialCommunalStorageBox.items[emptySlot] = { type: burnableType, emoji: burnableData.emoji };
                }
            }

            // Add random food items to communal storage
            for (let i = 0; i < communalFoodCount; i++) {
                const emptySlot = GameUtils.findEmptySlot(initialCommunalStorageBox.items);
                if (emptySlot !== -1) {
                    const foodType = GameUtils.ALL_FOOD_TYPES[this.seededRandom.randomInt(0, GameUtils.ALL_FOOD_TYPES.length - 1)];
                    const resourceData = GameConfig.resources.resourceData[foodType];
                    initialCommunalStorageBox.items[emptySlot] = { type: foodType, emoji: resourceData.emoji };
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

                // Add burnable resources to personal storage
                for (let j = 0; j < personalWoodCount; j++) {
                    const emptySlot = GameUtils.findEmptySlot(personalStorageBox.items);
                    if (emptySlot !== -1) {
                        const burnableType = GameUtils.ALL_BURNABLE_TYPES[this.seededRandom.randomInt(0, GameUtils.ALL_BURNABLE_TYPES.length - 1)];
                        const burnableData = GameConfig.resources.resourceData[burnableType];
                        personalStorageBox.items[emptySlot] = { type: burnableType, emoji: burnableData.emoji };
                    }
                }

                // Add random food items to personal storage
                for (let j = 0; j < personalFoodCount; j++) {
                    const emptySlot = GameUtils.findEmptySlot(personalStorageBox.items);
                    if (emptySlot !== -1) {
                        const foodType = GameUtils.ALL_FOOD_TYPES[this.seededRandom.randomInt(0, GameUtils.ALL_FOOD_TYPES.length - 1)];
                        const resourceData = GameConfig.resources.resourceData[foodType];
                        personalStorageBox.items[emptySlot] = { type: foodType, emoji: resourceData.emoji };
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
                const villagerName = generateVillagerName(this.seededRandom);

                // Generate random spawn position within the camp cell
                const villagerSpawnPosition = this.generateRandomCampPosition(camp.position);

                const villager = new Villager(villagerName, villagerSpawnPosition, i - 1, this.seededRandom); // Use camp index for villagerId and pass seeded random

                // Set scene reference for pathfinding access
                villager.scene = this;

                // Create unique character customization for this villager
                villager.characterCustomization = new CharacterCustomization(this.seededRandom);

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
                if (startHour >= GameConfig.villager.sleepSchedule.startHour || startHour < GameConfig.villager.sleepSchedule.endHour) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[MainScene] Villager ${villagerName} starting in SLEEPING state (nighttime)`);
                    }
                } else {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[MainScene] Villager ${villagerName} starting in FORAGING state (daytime)`);
                    }
                }

                // Create visual representation
                const visuals = villager.createVisuals(this);
                this.villagerVisuals.push(visuals);

                this.villagers.push(villager);
                if (window.summaryLoggingEnabled) {
                    console.log(`[MainScene] Created villager ${villagerName} at camp ${i} (spawned randomly in camp cell at ${Math.round(villagerSpawnPosition.x)}, ${Math.round(villagerSpawnPosition.y)})`);
                    console.log(`[MainScene] Assigned facilities to ${villagerName}: personal storage at (${Math.round(personalStorageBox.position.x)}, ${Math.round(personalStorageBox.position.y)}), communal storage at (${Math.round(communalStorageBox.position.x)}, ${Math.round(communalStorageBox.position.y)})`);
                }
            }

            // Calculate number of tiles in the world (needed for well spawning)
            const tileSize = GameConfig.world.tileSize;
            const tilesX = Math.ceil(cfg.width / tileSize);
            const tilesY = Math.ceil(cfg.height / tileSize);

            // --- Additional wells ---
            this.wells = [villageWell];
            for (let i = 0; i < cfg.wellCount; i++) {
                let attempts = 0, pos;
                do {
                    // Use safe positioning system like resources to avoid walls
                    const randomTileX = this.seededRandom.randomInt(0, tilesX);
                    const randomTileY = this.seededRandom.randomInt(0, tilesY);
                    const gridCell = { x: randomTileX, y: randomTileY };
                    pos = this.findSafePositionInGridCell(gridCell, 50);

                    // If no safe position found in this cell, try a different cell
                    if (!pos) {
                        attempts++;
                        continue;
                    }

                    attempts++;
                } while (this.isTooCloseToExistingWell(pos) && attempts < cfg.wellMaxAttempts);
                if (attempts < cfg.wellMaxAttempts && pos) {
                    const well = { position: pos, type: GameConfig.entityTypes.well, emoji: '💧', waterLevel: GameConfig.wells.initialWaterLevel };
                    this.entities.push(well);
                    this.wells.push(well);
                }
            }

            // --- Resources (Density-based spawning across all tiles) ---
            const densityConfig = GameConfig.resources.density;
            const totalTiles = tilesX * tilesY;

            console.log(`[World Generation] Generating resources using density system: ${tilesX}x${tilesY} tiles (${totalTiles} total)`);

            // All resource types (food + burnable resources)
            const allResourceTypes = [...GameUtils.ALL_FOOD_TYPES, ...GameUtils.ALL_BURNABLE_TYPES];
            let totalResourcesGenerated = 0;

            // Generate resources for each tile
            for (let tileX = 0; tileX < tilesX; tileX++) {
                for (let tileY = 0; tileY < tilesY; tileY++) {
                    // Calculate tile bounds
                    const tileStartX = tileX * tileSize;
                    const tileStartY = tileY * tileSize;
                    const tileEndX = Math.min(tileStartX + tileSize, cfg.width);
                    const tileEndY = Math.min(tileStartY + tileSize, cfg.height);

                    // Get biome for this tile to determine temperature compatibility
                    const tileCenterX = tileStartX + tileSize / 2;
                    const tileCenterY = tileStartY + tileSize / 2;
                    const biome = this.getBiomeAtPosition(tileCenterX, tileCenterY);
                    assert(biome, `Failed to get biome for tile (${tileX}, ${tileY})`);
                    assert(biome.temperature, `Biome missing temperature: ${biome.type}`);

                    // Skip resource spawning in camp biome
                    if (biome.type === 'camp') {
                        continue;
                    }

                    // Calculate resources for this tile with variance
                    const baseResources = densityConfig.resourcesPerTile;
                    const variance = densityConfig.variance;
                    const resourcesForTile = this.seededRandom.randomInt(
                        Math.max(0, baseResources - variance),
                        baseResources + variance
                    );

                    // Filter resources by biome temperature compatibility
                    const compatibleResources = this.getTemperatureCompatibleResources(biome.temperature);
                    assert(compatibleResources.length > 0, `No compatible resources found for biome temperature: ${biome.temperature}`);

                    // Select 2-5 different resource types for this biome tile
                    const resourceTypesCount = this.seededRandom.randomInt(2, 5);
                    const selectedResourceTypes = this.selectRandomResourceTypes(compatibleResources, resourceTypesCount);

                    // Generate resources for this tile
                    for (let i = 0; i < resourcesForTile; i++) {
                        // Select resource type from the chosen types for this biome
                        const resourceType = selectedResourceTypes[this.seededRandom.randomInt(0, selectedResourceTypes.length - 1)];

                        // Generate random position within tile bounds, avoiding walls
                        const gridCell = { x: tileX, y: tileY };
                        const pos = this.findSafePositionInGridCell(gridCell, 50);

                        // Skip if we couldn't find a safe position
                        if (!pos) continue;

                        // Additional check for village proximity
                        if (this.isTooCloseToVillage(pos)) continue;

                        const emoji = this.getResourceEmoji(resourceType);
                        this.entities.push({
                            position: pos,
                            type: resourceType,
                            emoji,
                            collected: false,
                            isChild: false, // Initial resources are adults
                            tileX: tileX, // Track which tile this belongs to
                            tileY: tileY
                        });

                        totalResourcesGenerated++;
                    }
                }
            }

            console.log(`[World Generation] Generated ${totalResourcesGenerated} resources across ${totalTiles} tiles, total entities: ${this.entities.length}`);

            // --- Render all entities as Phaser text objects ---
            this.worldEntities = [];
            for (const entity of this.entities) {
                // Determine base font size based on entity type
                let fontSize;
                if (entity.type === 'camp') {
                    fontSize = 28;
                } else if (entity.type === 'fireplace') {
                    fontSize = 28;
                } else if (entity.type === 'sleeping_bag') {
                    fontSize = 40;
                } else if (entity.type === 'storage_box') {
                    fontSize = 28;
                } else if (GameUtils.ALL_BURNABLE_TYPES.includes(entity.type)) {
                    fontSize = 36; // 200% larger (22 * 2 = 44)
                } else if (entity.type === 'well') {
                    fontSize = 22; // Wells keep same size
                } else if (GameUtils.ALL_FOOD_TYPES.includes(entity.type)) {
                    // Check if it's an animal (has runspeed > 0)
                    const runspeed = GameUtils.getRunspeed(entity.type);
                    if (runspeed > 0) {
                        // It's an animal - make 50% larger
                        fontSize = 28; // 22 * 1.5 = 33
                    } else {
                        // It's a plant - keep same size
                        fontSize = 22;
                    }
                } else {
                    fontSize = 22; // Default size
                }

                // Make communal storage 2x larger
                if (entity.type === 'storage_box' && !entity.isPersonal) {
                    fontSize = 48; // 2x the normal 24px size
                }

                // Handle child resources - make them smaller
                if (entity.isChild) {
                    fontSize = 16; // Smaller size for children
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
                    assert(entity.waterLevel !== undefined, `Well entity missing waterLevel property: ${entity.type}`);
                    const waterLevel = entity.waterLevel;
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
                    assert(entity.wood !== undefined, `Fireplace entity missing wood property: ${entity.type}`);
                    const woodLevel = entity.wood;
                    const scaleFactor = Math.max(0, Math.min(1, woodLevel / maxWood));
                    const scaledSize = baseSize + (maxSize - baseSize) * scaleFactor;

                    fontSize = Math.round(scaledSize);
                    textObj = this.add.text(entity.position.x, entity.position.y, '🔥', { fontSize: fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
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
                if (GameUtils.ALL_FOOD_TYPES.includes(entity.type) || GameUtils.ALL_BURNABLE_TYPES.includes(entity.type)) {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        if (entity.collected) return;

                        // Check player is near
                        const dist = GameUtils.distance(this.playerState.position, entity.position);
                        if (dist >= GameConfig.player.interactionThreshold) {
                            return;
                        }

                        // Use shared collection logic
                        const collectionSuccess = GameUtils.collectResource(entity, this.playerState.inventory, 'Player');

                        if (collectionSuccess) {
                            this.updatePhaserUI();
                            this.showTempMessage(`Collected ${entity.type}!`, GameConfig.technical.messageDurations.short);
                        } else {
                            this.showTempMessage('Inventory full!', 1500);
                        }
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
                        assert(GameConfig.player.wellWaterRestore !== undefined, 'GameConfig.player.wellWaterRestore is missing - check GameConfig.js');
                        this.playerState.needs.water = Math.min(GameConfig.needs.fullValue, this.playerState.needs.water + GameConfig.player.wellWaterRestore);
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

                        // Check if player has burnable resources to add
                        const burnableSlot = this.playerState.inventory.findIndex(item => item && GameUtils.getFireValue(item.type) > 0);
                        if (burnableSlot !== -1 && entity.wood < entity.maxWood) {
                            const item = this.playerState.inventory[burnableSlot];
                            const fireValue = GameUtils.getFireValue(item.type);

                            // Add burnable resource to fire (enforce max limit)
                            entity.wood = Math.min(entity.maxWood, entity.wood + fireValue);
                            this.playerState.inventory[burnableSlot] = null;
                            entity.isBurning = true;

                            // Update fire visuals
                            this.updateFireVisuals(entity);

                            this.updatePhaserUI();
                            assert(typeof fireValue === 'number', 'fireValue must be a number when displaying fire stoking popup');
                            this.showTempMessage(`Burned ${item.type} for ${Math.round(fireValue)} wood!`, GameConfig.technical.messageDurations.short);
                        } else if (burnableSlot !== -1) {
                            this.showTempMessage('Fire is full of wood!', GameConfig.technical.messageDurations.short);
                        } else {
                            this.showTempMessage('Need burnable resources to fuel fire!', GameConfig.technical.messageDurations.short);
                        }
                    });
                }
                // --- Sleeping bag interaction: click to sleep if near ---
                if (entity.type === 'sleeping_bag') {
                    textObj.setInteractive({ useHandCursor: true });
                    textObj.on('pointerdown', () => {
                        const dist = GameUtils.distance(this.playerState.position, entity.position);

                        if (dist > GameConfig.player.interactionThreshold) {
                            this.showTempMessage('Too far away from the sleepingbag!', GameConfig.technical.messageDurations.short);
                            return;
                        }

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
            // Create player with unique character customization
            this.playerCharacterCustomization = new CharacterCustomization(this.seededRandom);
            const playerEmoji = this.playerCharacterCustomization.getStateEmoji('standing');
            this.player = this.add.text(this.playerState.position.x, this.playerState.position.y, playerEmoji, { fontSize: GameConfig.player.fontSize + 'px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5);
            assert(this.player, 'Failed to create player emoji.');

            // Create player name text
            this.playerName = this.add.text(this.playerState.position.x, this.playerState.position.y - 40, 'You', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5);

            // Initialize line of sight system
            this.initializeLineOfSight();

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
            this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.ui);
            // Use margin for all UI elements
            const margin = GameConfig.ui.uiMargin;
            // Needs bars (top right)
            this.ui.needsBars = [];
            const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
            const needLabels = ['🌡️', '💧', '🍽️', 'A', 'B', 'C', 'D', 'E'];
            const iconWidth = 25; // Width reserved for icons
            const barStartX = window.innerWidth - margin - GameConfig.ui.barWidth - GameConfig.ui.dimensions.valueOffset - iconWidth - 5; // Start bars from right side

            for (let i = 0; i < needLabels.length; i++) {
                const barBg = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, GameConfig.ui.colors.barBackground).setOrigin(0.5, 0).setScrollFactor(0);
                const barFill = this.add.rectangle(barStartX + GameConfig.ui.barWidth / 2, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing), GameConfig.ui.barWidth, GameConfig.ui.barHeight, getPhaserBarColor(needTypes[i])).setOrigin(0.5, 0).setScrollFactor(0);
                let x_dist = needTypes[i] === 'vitaminA' || needTypes[i] === 'vitaminB' || needTypes[i] === 'vitaminC' || needTypes[i] === 'vitaminD' || needTypes[i] === 'vitaminE' ? 10 : 14;
                const label = this.add.text(barStartX - iconWidth + x_dist, margin + i * (GameConfig.ui.barHeight + GameConfig.ui.needBarSpacing) + GameConfig.ui.barHeight / 2, needLabels[i], { fontSize: GameConfig.ui.fontSizes.needLabel, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary }).setOrigin(1, 0.5).setScrollFactor(0);
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

                        // Use the unified resource usage method
                        this.useResourceFromInventoryPlayer(i, item);
                    }
                });
            }

            // Time display (top left) - fixed to camera viewport
            this.ui.timeText = this.add.text(margin, margin, '', {
                fontSize: GameConfig.ui.fontSizes.time,
                fontFamily: 'monospace',
                color: GameConfig.ui.colors.textPrimary,
                backgroundColor: GameConfig.ui.colors.boxBackground,
                padding: GameConfig.ui.dimensions.textPadding.large
            }).setOrigin(0, 0).setScrollFactor(0);
            this.uiContainer.add(this.ui.timeText);

            // --- Visual Temperature State Tracking ---
            // No longer caching - recalculated every frame // Offset for temp randomness

            // Game title (top center) - fixed to camera viewport
            this.ui.titleText = this.add.text(window.innerWidth / 2, margin, 'Participant Observer', {
                fontSize: '24px',
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: GameConfig.ui.colors.boxBackground,
                padding: GameConfig.ui.dimensions.textPadding.large
            }).setOrigin(0.5, 0).setScrollFactor(0);
            this.uiContainer.add(this.ui.titleText);

            // Info box (bottom left) - fixed to camera viewport
            this.ui.infoBox = this.add.text(margin, window.innerHeight - margin, 'Participant Observer v0.1\nControls: WASD to move\nClick objects or inventory to use', { fontSize: GameConfig.ui.fontSizes.debug, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.boxBackground, padding: GameConfig.ui.dimensions.textPadding.large }).setOrigin(0, 1).setScrollFactor(0);
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

            // FPS counter (above debug button) - fixed to camera viewport
            this.ui.fpsCounter = this.add.text(margin, window.innerHeight - margin - GameConfig.ui.dimensions.fpsCounterOffset, 'FPS: 60', { fontSize: GameConfig.ui.fontSizes.fps, fontFamily: 'monospace', color: GameConfig.ui.colors.textSecondary, backgroundColor: GameConfig.ui.colors.fpsBackground, padding: GameConfig.ui.dimensions.textPadding.large }).setOrigin(0, 1).setScrollFactor(0).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);
            this.uiContainer.add(this.ui.fpsCounter);

            // Invulnerability indicator - shows when player is invulnerable
            this.ui.invulIndicator = this.add.text(margin, window.innerHeight - margin - GameConfig.ui.dimensions.fpsCounterOffset - 30, '🛡️ INVULNERABLE', { fontSize: GameConfig.ui.fontSizes.debug, fontFamily: 'monospace', color: '#00ff00', backgroundColor: '#000000', padding: GameConfig.ui.dimensions.textPadding.small }).setOrigin(0, 1).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.debug);
            this.uiContainer.add(this.ui.invulIndicator);

            // Smoke indicator - directional pointer to distant smoke
            this.createSmokeIndicator();
        }

        update(time, delta) {
            // Update day/night lighting
            this.updateDayNightLighting();

            // Update smoke indicator direction
            this.updateSmokeIndicator();

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

            // Update line of sight system
            this.updateLineOfSight(delta);

            // Debug visualization for pathfinding
            this.updatePathfindingDebugVisualization();

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
            const newX = this.playerState.position.x + vx * moveSpeed * (effectiveDelta / 1000);
            const newY = this.playerState.position.y + vy * moveSpeed * (effectiveDelta / 1000);

            // Check wall collision before applying movement
            const newPosition = { x: newX, y: newY };
            const hasCollision = this.checkWallCollision(newPosition, 20); // 20px collision radius for player

            // Only apply movement if no collision
            if (!hasCollision) {
                this.playerState.position.x = newX;
                this.playerState.position.y = newY;
            }

            // Check for deadly gate collision
            this.checkGateCollision(newPosition);

            // Allow player to move freely within the large world bounds
            // Only clamp to prevent going outside the actual world boundaries
            this.playerState.position.x = Math.max(0, Math.min(GameConfig.world.width, this.playerState.position.x));
            this.playerState.position.y = Math.max(0, Math.min(GameConfig.world.height, this.playerState.position.y));

            // Update player emoji based on state (sleeping takes priority over movement)
            const isPlayerMoving = vx !== 0 || vy !== 0;

            // Determine player movement direction (only left/right matters for emoji flipping)
            let playerDirection = null;
            if (isPlayerMoving && Math.abs(vx) > 0.1) { // Only consider horizontal movement
                playerDirection = vx > 0 ? 'right' : 'left';
            }

            let playerEmojiResult;

            if (this.isSleeping) {
                // Player is sleeping - use sleeping emoji
                playerEmojiResult = this.playerCharacterCustomization.getStateEmoji('sleeping');
            } else if (isPlayerMoving) {
                // Player is moving - use running emoji with direction
                playerEmojiResult = this.playerCharacterCustomization.getStateEmoji('running', true, playerDirection);
            } else {
                // Player is standing still - use standing emoji
                playerEmojiResult = this.playerCharacterCustomization.getStateEmoji('standing');
            }

            // Handle emoji result (could be string or object with direction)
            if (typeof playerEmojiResult === 'object' && playerEmojiResult.emoji) {
                // Running state with direction info
                this.player.setText(playerEmojiResult.emoji);

                // Flip sprite horizontally for left movement
                if (playerEmojiResult.direction === 'left') {
                    this.player.setScale(1, 1); // Face left (no flip needed for left-facing emoji)
                } else {
                    this.player.setScale(-1, 1); // Face right (flip for right movement)
                }
            } else {
                // Standing or sleeping state (string emoji)
                this.player.setText(playerEmojiResult);
                this.player.setScale(1, 1); // Reset scale for non-running states
            }
            this.player.setPosition(this.playerState.position.x, this.playerState.position.y);

            // Update player name position
            this.playerName.setPosition(this.playerState.position.x, this.playerState.position.y - 40);

            // --- Visual Temperature State Update ---
            // No longer caching - recalculated every frame in updatePhaserUI()
        }

        updatePathfindingDebugVisualization() {
            // Only render if debug visualization is enabled AND debug button is on
            if (!GameConfig.navigation.debugVisualization.enabled || !this.pathfinder || !window.villagerDebugEnabled) {
                if (this.debugGraphics) this.debugGraphics.clear();
                return;
            }

            // Clear previous debug graphics
            if (this.debugGraphics) {
                this.debugGraphics.clear();
            } else {
                // Create debug graphics layer if it doesn't exist
                this.debugGraphics = this.add.graphics();
                this.debugGraphics.setDepth(1000); // Render on top of everything
            }

            const debugData = this.pathfinder.getDebugData();
            const config = GameConfig.navigation.debugVisualization;

            // Draw active paths
            if (config.showPaths && debugData.activePaths) {
                for (const activePath of debugData.activePaths) {
                    if (!activePath.path || activePath.path.length < 2) continue;

                    // Draw path lines
                    this.debugGraphics.lineStyle(config.pathWidth, config.pathColor, config.pathAlpha);

                    // Start from entity position
                    this.debugGraphics.moveTo(activePath.entity.position.x, activePath.entity.position.y);

                    // Draw lines to each waypoint
                    for (let i = 0; i < activePath.path.length; i++) {
                        const waypoint = activePath.path[i];
                        this.debugGraphics.lineTo(waypoint.x, waypoint.y);
                    }

                    // Draw waypoint markers
                    for (let i = 0; i < activePath.path.length; i++) {
                        const waypoint = activePath.path[i];
                        const isCurrentWaypoint = i === activePath.currentWaypointIndex;
                        const color = isCurrentWaypoint ? config.waypointColor : config.pathColor;
                        const size = isCurrentWaypoint ? config.waypointSize * 1.5 : config.waypointSize;

                        this.debugGraphics.fillStyle(color, config.pathAlpha);
                        this.debugGraphics.fillCircle(waypoint.x, waypoint.y, size);
                    }

                    // Draw target marker
                    if (activePath.target) {
                        this.debugGraphics.fillStyle(config.targetColor, config.pathAlpha);
                        this.debugGraphics.fillCircle(activePath.target.x, activePath.target.y, config.targetSize);
                    }
                }
            }

            // Draw grid (optional, can be performance intensive)
            if (config.showGrid && this.pathfinder) {
                this.debugGraphics.lineStyle(1, config.gridColor, config.gridAlpha);

                const gridSize = this.pathfinder.gridSize;
                const worldWidth = this.pathfinder.worldWidth;
                const worldHeight = this.pathfinder.worldHeight;

                // Draw vertical lines
                for (let x = 0; x <= worldWidth; x += gridSize) {
                    this.debugGraphics.moveTo(x, 0);
                    this.debugGraphics.lineTo(x, worldHeight);
                }

                // Draw horizontal lines
                for (let y = 0; y <= worldHeight; y += gridSize) {
                    this.debugGraphics.moveTo(0, y);
                    this.debugGraphics.lineTo(worldWidth, y);
                }
            }
        }

        updatePhaserUI() {
            // Needs
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

            // Visual temperature display - recalculate every frame
            let tempState = this._calculateVisualTemperatureState(t);
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

            const tempLabel = GameConfig.visualTemperature.labels[tempState];
            if (tempState === 'freezing') tempEmoji = '🥶';
            else if (tempState === 'cold') tempEmoji = '🧊';
            else if (tempState === 'warm') tempEmoji = '🌤️';
            else if (tempState === 'hot') tempEmoji = '🔥';
            else tempEmoji = '🌡️';

            // Count living villagers
            const livingVillagers = this.villagers ? this.villagers.filter(v => !v.isDead).length : 0;
            this.ui.timeText.setText(`📅 Day ${t.day}\n${timeEmoji} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}\n${tempEmoji} ${tempLabel}\n👥 Neighbours: ${livingVillagers}`);


            // Update debug elements
            this.updateDebugElements();

            // Update FPS counter
            if (window.villagerDebugEnabled && this.ui.fpsCounter) {
                const fps = Math.round(1000 / this.game.loop.delta);
                this.ui.fpsCounter.setText(`FPS: ${fps}`);
            }

            // Update invulnerability indicator
            if (this.ui.invulIndicator) {
                const isInvulnerable = new URLSearchParams(window.location.search).get('invul');
                this.ui.invulIndicator.setVisible(isInvulnerable);
            }

        }

        updateVillagers(delta) {
            if (!this.villagers) return;

            // Get storage boxes for villager interactions
            const storageBoxes = this.entities.filter(e => e.type === 'storage_box');

            // Debug: Log entity count occasionally (behind log spam gate)
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 1% chance per frame when spam enabled
                const resourceEntities = this.entities.filter(e => [...GameUtils.ALL_FOOD_TYPES, ...GameUtils.ALL_BURNABLE_TYPES].includes(e.type));
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

        isPositionBlockedByWall(pos, safetyMargin = null) {
            // Check if position collides with any wall (including mountains)
            const margin = safetyMargin !== null ? safetyMargin : GameConfig.walls.spawnSafetyMargin;
            return this.checkWallCollision(pos, margin);
        }

        findSafePositionInGridCell(gridCell, maxAttempts = 50) {
            // Find a safe position within a specific grid cell that doesn't collide with walls
            const tileSize = GameConfig.world.tileSize;
            const wallConfig = GameConfig.walls;

            // Calculate cell boundaries
            const cellMinX = gridCell.x * tileSize;
            const cellMaxX = (gridCell.x + 1) * tileSize;
            const cellMinY = gridCell.y * tileSize;
            const cellMaxY = (gridCell.y + 1) * tileSize;

            // Add margin to avoid cell edges (from config)
            const margin = wallConfig.spawnCellMargin;
            const spawnMinX = cellMinX + margin;
            const spawnMaxX = cellMaxX - margin;
            const spawnMinY = cellMinY + margin;
            const spawnMaxY = cellMaxY - margin;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Generate random position within the cell
                const pos = {
                    x: this.seededRandom.randomRange(spawnMinX, spawnMaxX),
                    y: this.seededRandom.randomRange(spawnMinY, spawnMaxY)
                };

                // Check if position is safe (not blocked by walls)
                if (!this.isPositionBlockedByWall(pos, wallConfig.spawnSafetyMargin)) {
                    return pos;
                }
            }

            // If no safe position found, return null
            console.warn(`[Safe Position] Could not find safe position in grid cell (${gridCell.x}, ${gridCell.y}) after ${maxAttempts} attempts`);
            return null;
        }
        getResourceEmoji(type) {
            // Get emoji from GameConfig.resources.resourceData
            if (GameConfig.resources.resourceData[type]) {
                return GameConfig.resources.resourceData[type].emoji;
            }
            return GameConfig.entityEmojis[type];
        }
        showTempMessage(msg, duration = GameConfig.ui.tempMessageDuration) {
            if (this._tempMsg) this._tempMsg.destroy();
            this._tempMsg = this.add.text(this.player.x, this.player.y - GameConfig.ui.dimensions.tempMessageOffset, msg, { fontSize: GameConfig.ui.fontSizes.overlayMessage, fontFamily: 'monospace', color: GameConfig.ui.colors.textPrimary, backgroundColor: GameConfig.ui.colors.textDark, padding: GameConfig.ui.dimensions.buttonPadding.medium }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.ui);
            this.time.delayedCall(duration, () => { if (this._tempMsg) { this._tempMsg.destroy(); this._tempMsg = null; } });
        }
        startFadeIn() {
            // Create fade overlay starting at full opacity
            this._fadeOverlay = this.add.rectangle(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                this.cameras.main.width,
                this.cameras.main.height,
                0x000000,
                1
            ).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlay + 1).setScrollFactor(0);

            // Fade in over 2.4 seconds (3x longer)
            this.tweens.add({
                targets: this._fadeOverlay,
                alpha: 0,
                duration: 2400,
                ease: 'Power2',
                onComplete: () => {
                    // Remove fade overlay after fade in
                    if (this._fadeOverlay) {
                        this._fadeOverlay.destroy();
                        this._fadeOverlay = null;
                    }
                }
            });
        }

        showGameOverOverlay(reason) {
            // Get player stats for the outro
            assert(this.playerState, 'Player state is required for game over');
            assert(this.playerState.needs, 'Player needs are required for game over');
            const playerStats = {
                needs: this.playerState.needs,
                causeOfDeath: reason
            };
            this.scene.start('OutroScene', playerStats);
        }



        generateBiomeData() {
            // Generate biome data for the entire world using Perlin noise
            const worldWidth = GameConfig.world.width;
            const worldHeight = GameConfig.world.height;
            const tileSize = GameConfig.world.tileSize;

            // Calculate number of tiles
            const tilesX = Math.ceil(worldWidth / tileSize);
            const tilesY = Math.ceil(worldHeight / tileSize);

            this.biomeData = [];

            // Generate biome noise at different scales for natural variation
            const biomeScale = 0.002; // Large-scale biome variation
            const detailScale = 0.01;  // Smaller detail variation

            for (let tileX = 0; tileX < tilesX; tileX++) {
                this.biomeData[tileX] = [];
                for (let tileY = 0; tileY < tilesY; tileY++) {
                    const worldX = tileX * tileSize;
                    const worldY = tileY * tileSize;

                    // Generate biome noise
                    const biomeNoise = this.noise.noise2D(worldX * biomeScale, worldY * biomeScale);
                    const detailNoise = this.noise.noise2D(worldX * detailScale, worldY * detailScale);

                    // Combine noise values for natural biome transitions
                    const combinedNoise = (biomeNoise * 0.7) + (detailNoise * 0.3);

                    // Calculate north-south temperature gradient (0 = north, 1 = south)
                    const northSouthRatio = worldY / worldHeight;

                    // Add some randomness to avoid perfect gradients
                    const temperatureVariation = (this.seededRandom.random() - 0.5) * 0.3; // ±15% variation
                    const adjustedRatio = Math.max(0, Math.min(1, northSouthRatio + temperatureVariation));

                    // Get all available biomes and their temperatures (exclude camp - it's created separately)
                    const biomes = GameConfig.resources.biomes;
                    const biomeEntries = Object.entries(biomes).filter(([name, config]) => name !== 'camp');

                    // Filter biomes by temperature based on north-south gradient
                    let availableBiomes;
                    if (adjustedRatio < 0.3) {
                        // North: prefer cold biomes
                        availableBiomes = biomeEntries.filter(([name, config]) =>
                            config.temperature === 'cold' || config.temperature === 'moderate'
                        );
                    } else if (adjustedRatio < 0.5) {
                        // Center: prefer moderate biomes
                        availableBiomes = biomeEntries.filter(([name, config]) =>
                            config.temperature === 'moderate');
                    } else {
                        // South: prefer warm biomes
                        availableBiomes = biomeEntries.filter(([name, config]) =>
                            config.temperature === 'warm' || config.temperature === 'moderate'
                        );
                    }

                    // If no biomes available for this temperature zone, use all biomes (except camp)
                    if (availableBiomes.length === 0) {
                        availableBiomes = biomeEntries;
                    }

                    // Select biome based on noise value and available biomes
                    const biomeIndex = Math.floor(Math.abs(combinedNoise) * availableBiomes.length);
                    const selectedBiome = availableBiomes[biomeIndex % availableBiomes.length];
                    const biomeType = selectedBiome[0];

                    this.biomeData[tileX][tileY] = {
                        type: biomeType,
                        noise: combinedNoise,
                        temperature: GameConfig.resources.biomes[biomeType].temperature
                    };
                }
            }

            console.log(`[Biome Generation] Generated biome data for ${tilesX}x${tilesY} tiles with north-south temperature gradient`);

            // Create a single camp area around the village center
            this.createCampArea();
        }

        createCampArea() {
            // Find the central biome for camp placement
            const centralBiome = this.findCentralBiome();
            const centerX = centralBiome.x;
            const centerY = centralBiome.y;

            const tileSize = GameConfig.world.tileSize;

            // Convert center position to tile coordinates
            const centerTileX = Math.floor(centerX / tileSize);
            const centerTileY = Math.floor(centerY / tileSize);

            // Assert bounds are valid
            assert(centerTileX >= 0 && centerTileX < this.biomeData.length,
                `Camp center tile X (${centerTileX}) out of bounds (0-${this.biomeData.length - 1})`);
            assert(centerTileY >= 0 && centerTileY < this.biomeData[centerTileX].length,
                `Camp center tile Y (${centerTileY}) out of bounds (0-${this.biomeData[centerTileX].length - 1})`);

            // Assert camp biome exists in config
            assert(GameConfig.resources.biomes.camp, 'Camp biome missing from config');
            assert(GameConfig.resources.biomes.camp.temperature, 'Camp biome missing temperature');

            // Create camp area by overriding just the center tile
            this.biomeData[centerTileX][centerTileY] = {
                type: 'camp',
                noise: 0.9, // High noise value for camp
                temperature: GameConfig.resources.biomes.camp.temperature
            };

            // Assert only one camp tile exists
            let campCount = 0;
            for (let x = 0; x < this.biomeData.length; x++) {
                for (let y = 0; y < this.biomeData[x].length; y++) {
                    if (this.biomeData[x][y].type === 'camp') {
                        campCount++;
                    }
                }
            }
            assert(campCount === 1, `Expected exactly 1 camp tile, found ${campCount}`);

            console.log(`[Camp Area] Created camp at center tile (${centerTileX}, ${centerTileY}) at world position (${Math.round(centerX)}, ${Math.round(centerY)})`);
        }

        getBiomeAtPosition(x, y) {
            // Convert world position to tile coordinates
            const tileSize = GameConfig.world.tileSize;
            const tileX = Math.floor(x / tileSize);
            const tileY = Math.floor(y / tileSize);

            // Ensure we're within bounds
            if (tileX < 0 || tileY < 0 || !this.biomeData[tileX] || !this.biomeData[tileX][tileY]) {
                return { type: 'plains', temperature: 'moderate' }; // Default fallback
            }

            return this.biomeData[tileX][tileY];
        }

        getTemperatureCompatibleResources(biomeTemperature) {
            // Get all resource types
            const allResourceTypes = [...GameUtils.ALL_FOOD_TYPES, ...GameUtils.ALL_BURNABLE_TYPES];
            const compatibleResources = [];

            // Filter resources by exact temperature match
            for (const resourceType of allResourceTypes) {
                const resourceData = GameConfig.resources.resourceData[resourceType];
                assert(resourceData, `Missing resource data for: ${resourceType}`);
                assert(resourceData.temperature, `Resource missing temperature: ${resourceType}`);

                // Check if this resource's temperature exactly matches the biome
                const resourceTemperatures = resourceData.temperature;
                const isCompatible = resourceTemperatures.includes(biomeTemperature);

                if (isCompatible) {
                    compatibleResources.push(resourceType);
                }
            }

            return compatibleResources;
        }

        selectRandomResourceTypes(availableResources, count) {
            // Select random resource types without duplicates
            const selected = [];
            const shuffled = [...availableResources]; // Create a copy to shuffle

            // Fisher-Yates shuffle
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = this.seededRandom.randomInt(0, i);
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            // Take the first 'count' items
            for (let i = 0; i < Math.min(count, shuffled.length); i++) {
                selected.push(shuffled[i]);
            }

            return selected;
        }

        findCentralBiome() {
            // Find the most central biome for camp placement
            const centerX = GameConfig.world.width / 2;
            const centerY = GameConfig.world.height / 2;

            // Check a small area around center for suitable biome
            const searchRadius = 200;
            const candidates = [];

            for (let x = centerX - searchRadius; x <= centerX + searchRadius; x += 50) {
                for (let y = centerY - searchRadius; y <= centerY + searchRadius; y += 50) {
                    const biome = this.getBiomeAtPosition(x, y);
                    if (biome.type === 'camp' || biome.type === 'plains' || biome.type === 'woodlands') {
                        candidates.push({
                            x: x,
                            y: y,
                            biome: biome,
                            distance: GameUtils.distance({ x, y }, { x: centerX, y: centerY })
                        });
                    }
                }
            }

            // Sort by distance and return the closest suitable position
            candidates.sort((a, b) => a.distance - b.distance);
            return candidates[0];
        }

        createGroundTexture() {
            try {
                // Create ground texture based on biome data
                const tileSize = GameConfig.world.tileSize;
                const worldWidth = GameConfig.world.width;
                const worldHeight = GameConfig.world.height;

                // Ensure noise and biome data are initialized
                if (!this.noise) {
                    console.error('[Ground Texture] Noise not initialized, skipping ground texture creation');
                    return;
                }

                if (!this.biomeData) {
                    console.error('[Ground Texture] Biome data not initialized, generating now');
                    this.generateBiomeData();
                }

                // Store biome debug texts for toggling
                this.biomeDebugTexts = [];

                // Create tiles across the entire world
                for (let x = 0; x < worldWidth; x += tileSize) {
                    for (let y = 0; y < worldHeight; y += tileSize) {
                        // Get biome for this tile
                        const biome = this.getBiomeAtPosition(x + tileSize / 2, y + tileSize / 2);
                        const biomeConfig = GameConfig.resources.biomes[biome.type];

                        // Convert hex color to integer (use exact biome color from config)
                        const color = parseInt(biomeConfig.color.replace('#', ''), 16);

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

                        // Add biome debug text at center of tile (only when debug is enabled)
                        const debugText = this.add.text(
                            x + tileSize / 2,
                            y + tileSize / 2,
                            biome.type,
                            {
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                color: '#ffffff',
                                backgroundColor: '#000000',
                                padding: { left: 4, right: 4, top: 2, bottom: 2 }
                            }
                        ).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.debug).setVisible(false);

                        this.biomeDebugTexts.push(debugText);
                    }
                }

                console.log(`[Ground Texture] Created ${this.groundTiles.length} biome-colored ground tiles`);
                console.log(`[Ground Texture] Created ${this.biomeDebugTexts.length} biome debug texts`);
            } catch (error) {
                console.error('[Ground Texture] Error creating ground texture:', error);
                // Don't crash the game if ground texture fails
            }
        }

        createWallSystem() {
            try {
                // Initialize walls array first
                this.walls = [];

                // Create walls between grid cells
                const tileSize = GameConfig.world.tileSize;
                const worldWidth = GameConfig.world.width;
                const worldHeight = GameConfig.world.height;
                const wallConfig = GameConfig.walls;

                // Calculate number of tiles
                const tilesX = Math.ceil(worldWidth / tileSize);
                const tilesY = Math.ceil(worldHeight / tileSize);

                // Find the camp grid cell using the same logic as createCampArea()
                const centralBiome = this.findCentralBiome();
                const centerX = centralBiome.x;
                const centerY = centralBiome.y;
                const campTileX = Math.floor(centerX / tileSize);
                const campTileY = Math.floor(centerY / tileSize);

                if (window.summaryLoggingEnabled) {
                    console.log(`[Wall System] Camp cell coordinates: (${campTileX}, ${campTileY})`);
                }

                // Generate per-cell opening plan
                const cellOpenings = this.generatePerCellOpenings(tilesX, tilesY);

                // Create horizontal walls (between rows)
                for (let tileY = 0; tileY <= tilesY; tileY++) {
                    for (let tileX = 0; tileX < tilesX; tileX++) {
                        // Check if this wall borders the camp cell
                        const isCampBorder = (tileY === campTileY || tileY === campTileY + 1) &&
                            (tileX >= campTileX && tileX <= campTileX + 1);

                        const wallX = tileX * tileSize;
                        const wallY = tileY * tileSize;

                        // Generate random wall height for this segment
                        const wallHeight = this.seededRandom.randomRange(wallConfig.height.min, wallConfig.height.max);

                        if (isCampBorder) {
                            // For camp cell borders, create walls with openings based on config
                            if (window.summaryLoggingEnabled) {
                                console.log(`[Wall System] Creating camp border horizontal wall at (${tileX}, ${tileY}) with opening`);
                            }
                            // Use configurable opening count for camp cell borders
                            const openingCount = wallConfig.campCell.wallOpeningsCount;
                            const openings = this.generateWallOpenings(tileSize, openingCount);
                            this.createWallSegments(wallX, wallY, tileSize, wallHeight, openings, 'horizontal');
                        } else {
                            // Regular wall generation for non-camp cells
                            const hasOpening = cellOpenings.horizontal[tileY] && cellOpenings.horizontal[tileY][tileX];
                            const openings = hasOpening ? this.generateWallOpenings(tileSize, 1) : [];
                            this.createWallSegments(wallX, wallY, tileSize, wallHeight, openings, 'horizontal');
                        }
                    }
                }

                // Create vertical walls (between columns)
                for (let tileX = 0; tileX <= tilesX; tileX++) {
                    for (let tileY = 0; tileY < tilesY; tileY++) {
                        // Check if this wall borders the camp cell
                        const isCampBorder = (tileX === campTileX || tileX === campTileX + 1) &&
                            (tileY >= campTileY && tileY <= campTileY + 1);

                        const wallX = tileX * tileSize;
                        const wallY = tileY * tileSize;

                        // Generate random wall height for this segment
                        const wallHeight = this.seededRandom.randomRange(wallConfig.height.min, wallConfig.height.max);

                        if (isCampBorder) {
                            // For camp cell borders, create walls with openings based on config
                            if (window.summaryLoggingEnabled) {
                                console.log(`[Wall System] Creating camp border vertical wall at (${tileX}, ${tileY}) with opening`);
                            }
                            // Use configurable opening count for camp cell borders
                            const openingCount = wallConfig.campCell.wallOpeningsCount;
                            const openings = this.generateWallOpenings(tileSize, openingCount);
                            this.createWallSegments(wallX, wallY, tileSize, wallHeight, openings, 'vertical');
                        } else {
                            // Regular wall generation for non-camp cells
                            const hasOpening = cellOpenings.vertical[tileX] && cellOpenings.vertical[tileX][tileY];
                            const openings = hasOpening ? this.generateWallOpenings(tileSize, 1) : [];
                            this.createWallSegments(wallX, wallY, tileSize, wallHeight, openings, 'vertical');
                        }
                    }
                }

                // Create mountains inside each grid cell
                this.createMountains(tilesX, tilesY, tileSize);

                if (window.summaryLoggingEnabled) {
                    console.log(`[Wall System] Created ${this.walls.length} wall segments`);
                }
            } catch (error) {
                console.error('[Wall System] Error creating wall system:', error);
                // Don't crash the game if wall system fails
            }
        }

        createMountains(tilesX, tilesY, tileSize) {
            const wallConfig = GameConfig.walls;

            // Find the camp grid cell using the same logic as createCampArea()
            const centralBiome = this.findCentralBiome();
            const centerX = centralBiome.x;
            const centerY = centralBiome.y;

            // Convert center position to tile coordinates (same as createCampArea)
            const campTileX = Math.floor(centerX / tileSize);
            const campTileY = Math.floor(centerY / tileSize);

            if (window.summaryLoggingEnabled) {
                console.log(`[Mountains] Camp cell coordinates: (${campTileX}, ${campTileY})`);
            }

            // Create 0-4 mountains per grid cell (including camp cell)
            for (let tileY = 0; tileY < tilesY; tileY++) {
                for (let tileX = 0; tileX < tilesX; tileX++) {
                    // Check if this is the camp grid cell
                    const isCampCell = (tileX === campTileX && tileY === campTileY);

                    // Skip camp cell if mountains are disabled for it
                    if (isCampCell && !wallConfig.campCell.allowMountains) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[Mountains] Skipping camp cell at (${tileX}, ${tileY}) - mountains disabled`);
                        }
                        continue;
                    }

                    if (isCampCell && window.summaryLoggingEnabled) {
                        console.log(`[Mountains] Processing camp cell at (${tileX}, ${tileY}) - allowing mountains`);
                    }

                    // Random number of mountains 
                    const mountainCount = this.seededRandom.randomInt(wallConfig.numMountains.min, wallConfig.numMountains.max + 1);

                    for (let mountainIndex = 0; mountainIndex < mountainCount; mountainIndex++) {
                        // Random mountain dimensions between 200-400
                        const mountainWidth = this.seededRandom.randomRange(wallConfig.mountainWidth.min, wallConfig.mountainWidth.max);
                        const mountainHeight = this.seededRandom.randomRange(wallConfig.mountainHeight.min, wallConfig.mountainHeight.max);

                        // Random position within the cell (with margin to avoid edges)
                        const margin = Math.max(mountainWidth, mountainHeight) / 2 + wallConfig.mountainMargin;
                        const minX = tileX * tileSize + margin;
                        const maxX = (tileX + 1) * tileSize - margin;
                        const minY = tileY * tileSize + margin;
                        const maxY = (tileY + 1) * tileSize - margin;

                        const mountainX = this.seededRandom.randomRange(minX, maxX);
                        const mountainY = this.seededRandom.randomRange(minY, maxY);

                        // Random rotation, disabled for now
                        //const rotation = this.seededRandom.random() * Math.PI * 2;
                        const rotation = 0;


                        // Create mountain as a wall rectangle
                        const mountain = this.add.rectangle(
                            mountainX,
                            mountainY,
                            mountainWidth,
                            mountainHeight,
                            wallConfig.wallColor
                        ).setOrigin(0.5)
                            .setDepth(GameConfig.ui.zIndex.walls)
                            .setAlpha(wallConfig.alpha)
                            .setRotation(rotation);

                        // Store mountain data for collision detection
                        const mountainData = {
                            x: mountainX,
                            y: mountainY,
                            width: mountainWidth,
                            height: mountainHeight,
                            direction: 'mountain',
                            visual: mountain
                        };

                        this.walls.push(mountainData);
                    }
                }
            }
        }

        generatePerCellOpenings(tilesX, tilesY) {
            const wallConfig = GameConfig.walls;
            const cellOpenings = {
                horizontal: {},
                vertical: {}
            };

            // Initialize opening arrays
            for (let y = 0; y <= tilesY; y++) {
                cellOpenings.horizontal[y] = {};
                for (let x = 0; x < tilesX; x++) {
                    cellOpenings.horizontal[y][x] = false;
                }
            }
            for (let x = 0; x <= tilesX; x++) {
                cellOpenings.vertical[x] = {};
                for (let y = 0; y < tilesY; y++) {
                    cellOpenings.vertical[x][y] = false;
                }
            }

            // For each cell, ensure it has 1-3 openings total
            for (let tileY = 0; tileY < tilesY; tileY++) {
                for (let tileX = 0; tileX < tilesX; tileX++) {
                    // Count how many openings this cell needs (1-3)
                    const openingCount = this.seededRandom.randomInt(
                        wallConfig.openingsPerCell.min,
                        wallConfig.openingsPerCell.max + 1
                    );

                    // Get the 4 edges of this cell
                    const edges = [
                        { type: 'horizontal', x: tileX, y: tileY }, // Top edge
                        { type: 'horizontal', x: tileX, y: tileY + 1 }, // Bottom edge
                        { type: 'vertical', x: tileX, y: tileY }, // Left edge
                        { type: 'vertical', x: tileX + 1, y: tileY } // Right edge
                    ];

                    // Shuffle edges using seeded random for consistent results
                    const shuffledEdges = [...edges];
                    for (let i = shuffledEdges.length - 1; i > 0; i--) {
                        const j = this.seededRandom.randomInt(0, i + 1);
                        [shuffledEdges[i], shuffledEdges[j]] = [shuffledEdges[j], shuffledEdges[i]];
                    }

                    // Place openings on random edges
                    for (let i = 0; i < Math.min(openingCount, shuffledEdges.length); i++) {
                        const edge = shuffledEdges[i];
                        if (edge && edge.type === 'horizontal') {
                            cellOpenings.horizontal[edge.y][edge.x] = true;
                        } else if (edge && edge.type === 'vertical') {
                            cellOpenings.vertical[edge.x][edge.y] = true;
                        }
                    }
                }
            }

            return cellOpenings;
        }

        generateWallOpenings(wallLength, openingCount) {
            // Generate random openings along a wall with seeded randomization
            const openings = [];

            for (let i = 0; i < openingCount; i++) {
                // Random opening size between 15% and 45% of wall length
                const minSize = wallLength * GameConfig.walls.openingMinSizePerc;
                const maxSize = wallLength * GameConfig.walls.openingMaxSizePerc;
                const openingSize = this.seededRandom.randomRange(minSize, maxSize);

                // Random position along the wall (not necessarily centered)
                const maxStartPosition = wallLength - openingSize;
                const openingStart = this.seededRandom.randomRange(0, maxStartPosition);
                const openingEnd = openingStart + openingSize;

                openings.push({
                    start: Math.max(0, openingStart),
                    end: Math.min(wallLength, openingEnd)
                });
            }

            return openings;
        }

        createWallSegments(wallX, wallY, wallLength, wallHeight, openings, direction) {
            const wallConfig = GameConfig.walls;

            // Sort openings by start position
            openings.sort((a, b) => a.start - b.start);

            // Create wall segments between openings
            for (let i = 0; i <= openings.length; i++) {
                let segmentStart, segmentEnd;

                if (i === 0) {
                    // First segment (from start to first opening)
                    segmentStart = 0;
                    segmentEnd = openings.length > 0 ? openings[0].start : wallLength;
                } else if (i === openings.length) {
                    // Last segment (from last opening to end)
                    segmentStart = openings[i - 1].end;
                    segmentEnd = wallLength;
                } else {
                    // Middle segment (between openings)
                    segmentStart = openings[i - 1].end;
                    segmentEnd = openings[i].start;
                }

                // Only create wall segment if it has meaningful width
                if (segmentEnd - segmentStart > 10) {
                    const segmentWidth = segmentEnd - segmentStart;
                    let segmentX, segmentY;

                    if (direction === 'horizontal') {
                        // Horizontal walls: X varies along wall, Y spans the boundary
                        segmentX = wallX + segmentStart + segmentWidth / 2;
                        // Position wall to span the boundary - center it on the boundary line
                        segmentY = wallY;
                    } else {
                        // Vertical walls: Y varies along wall, X spans the boundary
                        // Position wall to span the boundary - center it on the boundary line
                        segmentX = wallX;
                        segmentY = wallY + segmentStart + segmentWidth / 2;
                    }

                    // Create wall rectangle
                    const wallSegment = this.add.rectangle(
                        segmentX,
                        segmentY,
                        direction === 'horizontal' ? segmentWidth : wallHeight,
                        direction === 'horizontal' ? wallHeight : segmentWidth,
                        wallConfig.wallColor
                    ).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.walls).setAlpha(wallConfig.alpha);

                    // Debug: Log wall positioning occasionally
                    if (Math.random() < 0.01 && window.summaryLoggingEnabled) {
                        console.log(`[Wall System] Created ${direction} wall segment at (${Math.round(segmentX)}, ${Math.round(segmentY)}) with size ${Math.round(direction === 'horizontal' ? segmentWidth : wallHeight)}x${Math.round(direction === 'horizontal' ? wallHeight : segmentWidth)}`);
                    }

                    // Store wall data for collision detection
                    const wallData = {
                        x: segmentX,
                        y: segmentY,
                        width: direction === 'horizontal' ? segmentWidth : wallHeight,
                        height: direction === 'horizontal' ? wallHeight : segmentWidth,
                        direction: direction,
                        visual: wallSegment
                    };

                    this.walls.push(wallData);
                }
            }

            // Create gates at each opening if enabled
            if (GameConfig.walls.gates.enabled && openings.length > 0) {
                this.createGatesAtOpenings(wallX, wallY, wallLength, wallHeight, openings, direction);
            }
        }

        createGatesAtOpenings(wallX, wallY, wallLength, wallHeight, openings, direction) {
            assert(GameConfig.walls.gates, 'Gate configuration is required');
            assert(openings && openings.length > 0, 'Openings array must be provided and non-empty');
            assert(direction === 'horizontal' || direction === 'vertical', 'Direction must be horizontal or vertical');
            assert(typeof wallX === 'number' && typeof wallY === 'number', 'Wall position must be valid numbers');
            assert(typeof wallLength === 'number' && wallLength > 0, 'Wall length must be a positive number');
            assert(typeof wallHeight === 'number' && wallHeight > 0, 'Wall height must be a positive number');

            const gateConfig = GameConfig.walls.gates;

            // Initialize gate tracking if not already done
            if (!this.gateTracker) {
                this.gateTracker = {
                    totalGatesCreated: 0,
                    deadlyGatesCreated: 0,
                    gateColors: [...gateConfig.colors], // All available gate colors (can be reused)
                    deadlyColors: new Set() // Colors that are deadly
                };

                // Randomly select which colors are deadly (8 out of 8 colors)
                const colorCount = gateConfig.colors.length;
                const deadlyCount = Math.min(gateConfig.deadlyCount, colorCount);

                // Randomly select which colors are deadly
                const availableColorIndices = [...Array(colorCount).keys()];
                for (let i = 0; i < deadlyCount; i++) {
                    assert(availableColorIndices.length > 0, 'No available color indices left for deadly gate selection');
                    const randomIndex = this.seededRandom.randomInt(0, availableColorIndices.length - 1);
                    const colorIndex = availableColorIndices.splice(randomIndex, 1)[0];
                    this.gateTracker.deadlyColors.add(gateConfig.colors[colorIndex]);
                }

                if (window.summaryLoggingEnabled) {
                    console.log(`[Gate System] Initialized with ${this.gateTracker.gateColors.length} gate types, ${this.gateTracker.deadlyColors.size} deadly types`);
                    console.log(`[Gate System] Deadly colors: ${Array.from(this.gateTracker.deadlyColors).map(c => '0x' + c.toString(16).toUpperCase())}`);
                }
            }

            for (const opening of openings) {
                assert(opening.start >= 0, 'Opening start must be non-negative');
                assert(opening.end > opening.start, 'Opening end must be greater than start');
                assert(opening.end <= wallLength, 'Opening end must not exceed wall length');

                // Calculate gate dimensions
                const openingWidth = opening.end - opening.start;
                assert(openingWidth > 0, `Opening width must be positive, got: ${openingWidth}`);

                const gateWidth = openingWidth; // Gate width matches opening width
                const gateDepth = wallHeight * gateConfig.depthRatio; // Gate depth as ratio of wall depth

                assert(gateWidth > 0, `Gate width must be positive, got: ${gateWidth}`);
                assert(gateDepth > 0, `Gate depth must be positive, got: ${gateDepth} (wallHeight: ${wallHeight}, depthRatio: ${gateConfig.depthRatio})`);

                // Ensure minimum gate size for visibility
                const minGateSize = 5; // Minimum 5 pixels for visibility
                if (gateWidth < minGateSize || gateDepth < minGateSize) {
                    console.warn(`[Gate System] Gate dimensions too small: ${Math.round(gateWidth)}x${Math.round(gateDepth)} at (${Math.round(wallX)}, ${Math.round(wallY)})`);
                }

                // Calculate gate position
                let gateX, gateY;
                if (direction === 'horizontal') {
                    // Horizontal walls: X varies along wall, Y spans the boundary
                    gateX = wallX + opening.start + openingWidth / 2;
                    gateY = wallY;
                } else {
                    // Vertical walls: Y varies along wall, X spans the boundary
                    gateX = wallX;
                    gateY = wallY + opening.start + openingWidth / 2;
                }

                // Validate gate position
                assert(typeof gateX === 'number' && !isNaN(gateX), `Gate X position must be a valid number, got: ${gateX}`);
                assert(typeof gateY === 'number' && !isNaN(gateY), `Gate Y position must be a valid number, got: ${gateY}`);

                // Randomly select a gate color (colors can be reused)
                assert(this.gateTracker.gateColors && this.gateTracker.gateColors.length > 0,
                    'Gate colors array must exist and be non-empty');
                // Use exclusive upper bound to prevent array index out of bounds
                const randomColorIndex = this.seededRandom.randomInt(0, this.gateTracker.gateColors.length - 1);
                assert(randomColorIndex >= 0 && randomColorIndex < this.gateTracker.gateColors.length,
                    `Gate color index ${randomColorIndex} is out of bounds for array length ${this.gateTracker.gateColors.length}`);
                const gateColor = this.gateTracker.gateColors[randomColorIndex];
                assert(typeof gateColor === 'number' && gateColor > 0,
                    `Gate color must be a valid positive number, got: ${gateColor}`);

                // Check if this color is deadly
                const isDeadly = this.gateTracker.deadlyColors.has(gateColor);

                // Update tracking
                this.gateTracker.totalGatesCreated++;
                if (isDeadly) {
                    this.gateTracker.deadlyGatesCreated++;
                }

                // Create gate rectangle
                const gate = this.add.rectangle(
                    gateX,
                    gateY,
                    direction === 'horizontal' ? gateWidth : gateDepth,
                    direction === 'horizontal' ? gateDepth : gateWidth,
                    gateColor
                ).setOrigin(0.5)
                    .setDepth(gateConfig.zIndex)
                    .setAlpha(gateConfig.alpha);

                // Validate gate creation
                assert(gate, 'Gate rectangle must be created successfully');
                assert(gate.visible !== false, 'Gate must be visible');
                assert(gate.alpha > 0, `Gate alpha must be greater than 0, got: ${gate.alpha}`);
                assert(gate.width > 0 && gate.height > 0, `Gate dimensions must be positive: ${gate.width}x${gate.height}`);

                // Store gate data for future use
                const gateData = {
                    x: gateX,
                    y: gateY,
                    width: direction === 'horizontal' ? gateWidth : gateDepth,
                    height: direction === 'horizontal' ? gateDepth : gateWidth,
                    direction: direction,
                    opening: opening,
                    color: gateColor,
                    isDeadly: isDeadly,
                    visual: gate
                };

                // Validate gate data structure
                assert(typeof gateData.x === 'number' && typeof gateData.y === 'number',
                    'Gate data must have valid x,y coordinates');
                assert(typeof gateData.width === 'number' && gateData.width > 0,
                    'Gate data must have valid width');
                assert(typeof gateData.height === 'number' && gateData.height > 0,
                    'Gate data must have valid height');
                assert(typeof gateData.isDeadly === 'boolean',
                    'Gate data must have isDeadly boolean property');
                assert(gateData.visual, 'Gate data must have visual element');

                // Add debug text for gate type
                const gateTypeText = this.add.text(
                    gateX,
                    gateY - 20,
                    isDeadly ? 'DEADLY' : 'SAFE',
                    {
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: isDeadly ? '#ff0000' : '#00ff00',
                        backgroundColor: '#000',
                        padding: { left: 2, right: 2, top: 1, bottom: 1 }
                    }
                ).setOrigin(0.5).setVisible(false).setDepth(GameConfig.ui.zIndex.debug);

                gateData._debugText = gateTypeText;

                this.gates.push(gateData);

                // Debug: Log gate creation occasionally
                if (Math.random() < 0.01 && window.summaryLoggingEnabled) {
                    console.log(`[Gate System] Created ${direction} gate at (${Math.round(gateX)}, ${Math.round(gateY)}) with color 0x${gateColor.toString(16).toUpperCase()} ${isDeadly ? '(DEADLY)' : '(safe)'}`);
                    console.log(`[Gate System] Progress: ${this.gateTracker.deadlyGatesCreated} deadly gates out of ${this.gateTracker.totalGatesCreated} total gates created`);
                }

                // Always log gate creation for debugging invisible gate issue
                if (window.summaryLoggingEnabled) {
                    console.log(`[Gate System] Gate created: color=0x${gateColor.toString(16).toUpperCase()}, alpha=${gateConfig.alpha}, zIndex=${gateConfig.zIndex}, size=${Math.round(gateWidth)}x${Math.round(gateDepth)}`);
                }
            }
        }

        checkWallCollision(position, radius = 0) {
            // Check if a position collides with any wall
            if (!GameConfig.walls.collisionEnabled) return false;
            if (!this.walls || !Array.isArray(this.walls)) return false;

            const collisionMargin = GameConfig.walls.collisionMargin;
            const totalRadius = radius + collisionMargin;

            // Log wall collision checks occasionally
            if (Math.random() < 0.0001) { // Very rare logging
                if (window.summaryLoggingEnabled) {
                    console.log(`[WallCollision] Checking collision at (${Math.round(position.x)}, ${Math.round(position.y)}) with radius ${radius}, total radius ${totalRadius}, walls count: ${this.walls.length}`);
                }
            }

            for (const wall of this.walls) {
                // Calculate distance from position to wall center
                const dx = Math.abs(position.x - wall.x);
                const dy = Math.abs(position.y - wall.y);

                // Check if within collision bounds
                const halfWidth = wall.width / 2 + totalRadius;
                const halfHeight = wall.height / 2 + totalRadius;

                if (dx <= halfWidth && dy <= halfHeight) {
                    // Log collision detection occasionally
                    if (Math.random() < 0.0001) {
                        if (window.summaryLoggingEnabled) {
                            console.log(`[WallCollision] COLLISION DETECTED at (${Math.round(position.x)}, ${Math.round(position.y)}) with wall at (${Math.round(wall.x)}, ${Math.round(wall.y)})`);
                        }
                    }
                    return true; // Collision detected
                }
            }

            return false; // No collision
        }

        checkGateCollision(position) {
            // Check if player collides with any deadly gates
            if (!this.gates || !Array.isArray(this.gates)) return;

            const playerRadius = 20; // Same radius as wall collision

            for (const gate of this.gates) {
                if (!gate.isDeadly) continue; // Only check deadly gates

                // Calculate distance from position to gate center
                const dx = Math.abs(position.x - gate.x);
                const dy = Math.abs(position.y - gate.y);

                // Check if within collision bounds
                const halfWidth = gate.width / 2 + playerRadius;
                const halfHeight = gate.height / 2 + playerRadius;

                if (dx <= halfWidth && dy <= halfHeight) {
                    // Player hit a deadly gate - trigger death
                    this.playerState.deathCause = "Patient died from electrocution by force field.";
                    return; // Exit early since player is dead
                }
            }
        }

        showNewGameConfirmation() {
            if (this._confirmDialog) return;

            const w = this.cameras.main.width;
            const h = this.cameras.main.height;

            // Get current seed from stored value or UI
            let seed = getCurrentSeed();
            if (isNaN(seed) || seed < GameConfig.ui.seedInputMinValue || seed > GameConfig.ui.seedInputMaxValue) {
                console.error('[New Game] Invalid seed value');
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
                default:
                    // Check if it's a burnable resource using utility function
                    if (GameUtils.isBurnable(entity.type) || GameUtils.isFood(entity.type)) {
                        const status = entity.collected ? '(Collected)' : entity.isChild ? '(Child)' : '(Adult)';
                        return `${entity.type} ${status}`;
                    }
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

            // Update biome debug texts
            if (this.biomeDebugTexts) {
                for (const debugText of this.biomeDebugTexts) {
                    debugText.setVisible(window.villagerDebugEnabled);
                }
            }

            // Update gate debug texts
            if (this.gates && Array.isArray(this.gates)) {
                for (const gate of this.gates) {
                    if (gate._debugText) {
                        gate._debugText.setVisible(window.villagerDebugEnabled);
                        if (window.villagerDebugEnabled) {
                            gate._debugText.setPosition(gate.x, gate.y - 20);
                        }
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
            // Initialize all resource types to 0
            for (const type of [...GameUtils.ALL_FOOD_TYPES, ...GameUtils.ALL_BURNABLE_TYPES]) {
                wildCounts[type] = 0;
            }

            for (const entity of this.entities) {
                if ((GameUtils.ALL_FOOD_TYPES.includes(entity.type) || GameUtils.ALL_BURNABLE_TYPES.includes(entity.type)) && !entity.collected) {
                    wildCounts[entity.type]++;
                }
            }

            // Count resources in inventories and storage
            const storedCounts = {};
            // Initialize all resource types to 0
            for (const type of [...GameUtils.ALL_FOOD_TYPES, ...GameUtils.ALL_BURNABLE_TYPES]) {
                storedCounts[type] = 0;
            }

            // Player inventory
            for (const item of this.playerState.inventory) {
                if (item && (GameUtils.ALL_FOOD_TYPES.includes(item.type) || GameUtils.ALL_BURNABLE_TYPES.includes(item.type))) {
                    storedCounts[item.type]++;
                }
            }

            // Villager inventories
            for (const villager of this.villagers) {
                if (villager && !villager.isDead) {
                    for (const item of villager.inventory) {
                        if (item && (GameUtils.ALL_FOOD_TYPES.includes(item.type) || GameUtils.ALL_BURNABLE_TYPES.includes(item.type))) {
                            storedCounts[item.type]++;
                        }
                    }
                }
            }

            // Storage boxes
            for (const entity of this.entities) {
                if (entity.type === 'storage_box' && entity.items) {
                    for (const item of entity.items) {
                        if (item && (GameUtils.ALL_FOOD_TYPES.includes(item.type) || GameUtils.ALL_BURNABLE_TYPES.includes(item.type))) {
                            storedCounts[item.type]++;
                        }
                    }
                }
            }

            // Build display text with color coding - show ALL resource types
            let displayText = 'Resource Counts:\n';
            const sortedTypes = [...GameUtils.ALL_FOOD_TYPES, ...GameUtils.ALL_BURNABLE_TYPES].sort();

            for (const type of sortedTypes) {
                const emoji = this.getResourceEmoji(type);
                const wildCount = wildCounts[type];
                const storedCount = storedCounts[type];

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
            const columnWidth = 150; // Reduced width for 3 columns
            const leftColumnX = 20;
            const middleColumnX = leftColumnX + columnWidth;
            const rightColumnX = middleColumnX + columnWidth;

            // Separate header and total lines from resource lines
            const headerLines = [];
            const resourceLines = [];
            const totalLines = [];

            for (const line of lines) {
                if (line.trim() === '') continue;

                if (line.startsWith('Resource Counts:') || line.startsWith('Total:')) {
                    // Header and total lines go in the left column
                    headerLines.push(line);
                } else if (line.includes(':')) {
                    // Resource lines will be split between three columns
                    resourceLines.push(line);
                }
            }

            // Display header lines in left column
            for (const line of headerLines) {
                const textObj = this.add.text(leftColumnX, currentY, line, {
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    backgroundColor: '#000',
                    padding: { left: 5, right: 5, top: 2, bottom: 2 }
                }).setOrigin(0, 0).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.debug);

                this.uiContainer.add(textObj);
                this.resourceCountTexts.push(textObj);
                currentY += lineHeight;
            }

            // Split resource lines into three columns
            const itemsPerColumn = Math.ceil(resourceLines.length / 3);
            const leftColumnResources = resourceLines.slice(0, itemsPerColumn);
            const middleColumnResources = resourceLines.slice(itemsPerColumn, itemsPerColumn * 2);
            const rightColumnResources = resourceLines.slice(itemsPerColumn * 2);

            // Helper function to display resources in a column
            const displayColumnResources = (resources, columnX, startY) => {
                let y = startY;
                for (const line of resources) {
                    // Check if this line should be grey (contains a resource with wild count = 0)
                    let isGrey = false;
                    const match = line.match(/: (\d+)\+(\d+)/);
                    if (match) {
                        const wildCount = parseInt(match[1], 10);
                        isGrey = wildCount === 0;
                    }

                    const color = isGrey ? '#888888' : '#ffffff';

                    // Debug: log the color assignment for resource lines
                    if (window.summaryLoggingEnabled) {
                        console.log(`[ResourceCount] Column line: "${line.trim()}", isGrey: ${isGrey}, color: ${color}`);
                    }

                    const textObj = this.add.text(columnX, y, line, {
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: color,
                        backgroundColor: '#000',
                        padding: { left: 5, right: 5, top: 2, bottom: 2 }
                    }).setOrigin(0, 0).setScrollFactor(0).setDepth(GameConfig.ui.zIndex.debug);

                    this.uiContainer.add(textObj);
                    this.resourceCountTexts.push(textObj);
                    y += lineHeight;
                }
            };

            // Display all three columns
            const headerHeight = headerLines.length * lineHeight;
            displayColumnResources(leftColumnResources, leftColumnX, 275 + headerHeight);
            displayColumnResources(middleColumnResources, middleColumnX, 275 + headerHeight);
            displayColumnResources(rightColumnResources, rightColumnX, 275 + headerHeight);
        }



        sleepUntilMorning(sleepingBag) {
            if (sleepingBag.isOccupied) {
                this.showTempMessage('Sleeping bag is occupied!', 1200);
                return;
            }

            // Check current time before starting sleep
            const currentTime = getCurrentTime(this.playerState);
            if (window.summaryLoggingEnabled) {
                console.log(`[Sleep] Starting sleep at ${currentTime.hour}:${currentTime.minute}`);
            }

            // Mark as occupied
            sleepingBag.isOccupied = true;

            // Enable sleeping mode with time acceleration
            this.isSleeping = true;
            this.sleepingBag = sleepingBag;
            this.sleepTimeAcceleration = 25; // 25x faster

            // Show ZZZ above player
            this.sleepZZZ = this.add.text(this.player.x, this.player.y - 60, '💤', { fontSize: '24px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.ui);

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

                if (window.summaryLoggingEnabled) {
                    console.log('[Sleep] Player stopped sleeping');
                }
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
            const title = this.add.text(w / 2, h / 2 - (bgHeight / 2) + 30, `${storageBox.isPersonal ? 'Personal' : 'Communal'} Storage`, { fontSize: '20px', fontFamily: 'monospace', color: '#fff' }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Storage slots
            const capacity = storageBox.isPersonal ? GameConfig.storage.personalCapacity : GameConfig.storage.communalCapacity;
            const storageSlots = [];
            const storageEmojis = [];

            for (let i = 0; i < capacity; i++) {
                const slotX = w / 2 - 150 + (i % 5) * 60;
                const slotY = h / 2 - (bgHeight / 2) + 80 + Math.floor(i / 5) * 60;

                const slot = this.add.rectangle(slotX, slotY, 50, 50, 0x333333).setOrigin(0.5).setStrokeStyle(2, 0x666666).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);
                const emoji = this.add.text(slotX, slotY, storageBox.items[i] ? storageBox.items[i].emoji : '', { fontSize: '20px', fontFamily: 'Arial', color: '#fff' }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

                storageSlots.push(slot);
                storageEmojis.push(emoji);

                // Make slots interactive
                slot.setInteractive({ useHandCursor: true });
                slot.on('pointerdown', () => {
                    this.transferItemFromStorage(i, storageBox);
                });
            }

            // Instructions - position below the slots
            const instructions = this.add.text(w / 2, h / 2 + (bgHeight / 2) - 60, 'Click items to transfer to your inventory\nMove away to close', { fontSize: '12px', fontFamily: 'monospace', color: '#ccc', align: 'center' }).setOrigin(0.5).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

            // Close button - position at the bottom
            const closeBtn = this.add.text(w / 2, h / 2 + (bgHeight / 2) - 20, 'Close', { fontSize: '16px', fontFamily: 'monospace', color: '#fff', backgroundColor: '#666', padding: { left: 12, right: 12, top: 6, bottom: 6 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(GameConfig.ui.zIndex.overlayContent).setScrollFactor(0);

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

        useResourceFromInventoryPlayer(slot, item) {
            assert(slot >= 0 && slot < this.playerState.inventory.length, `Invalid inventory slot: ${slot}`);
            assert(item && item.type, `Invalid item: ${JSON.stringify(item)}`);

            // Only allow using resources if near a burning fire
            const nearbyFire = this.findNearbyFire();
            if (nearbyFire) {
                const fireValue = GameUtils.getFireValue(item.type);

                // If item has fire value > 0, burn it instead of eating
                if (fireValue > 0) {
                    const oldWood = nearbyFire.wood;
                    nearbyFire.wood = Math.min(GameConfig.fires.maxWood, nearbyFire.wood + fireValue);
                    this.playerState.inventory[slot] = null;
                    this.updatePhaserUI();
                    this.showTempMessage(`Burned ${item.type} for ${Math.round(fireValue)} wood!`, GameConfig.technical.messageDurations.short);
                } else {
                    // Otherwise, eat it as food
                    const nutrition = GameUtils.getNutrition(item.type);
                    assert(nutrition && typeof nutrition.calories === 'number', `Nutrition data missing or invalid for ${item.type}`);
                    GameUtils.applyNutrition(this.playerState, item.type);
                    this.playerState.inventory[slot] = null;
                    this.updatePhaserUI();

                    if (nutrition.calories > 0) {
                        this.showTempMessage(`Ate ${item.type} - tastes good!`, GameConfig.technical.messageDurations.short);
                    } else if (nutrition.calories < 0) {
                        this.showTempMessage(`Tastes horrible! Is ${item.type} poisonous?`, GameConfig.technical.messageDurations.medium);
                    } else {
                        this.showTempMessage(`Ate ${item.type}!`, GameConfig.technical.messageDurations.short);
                    }
                }
            } else {
                // Provide specific error messages based on item type
                const fireValue = GameUtils.getFireValue(item.type);
                if (fireValue > 0) {
                    this.showTempMessage('Must be near a burning fire to burn this!', GameConfig.technical.messageDurations.medium);
                } else if (GameUtils.isFood(item.type)) {
                    this.showTempMessage('Must be near a burning fire to eat!', GameConfig.technical.messageDurations.medium);
                } else {
                    this.showTempMessage('Must be near a burning fire to use this!', GameConfig.technical.messageDurations.medium);
                }
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
            const isNight = GameUtils.isNightTime(t.hour);

            // Apply fire effects anytime - allows warming up during day

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
                assert(fire.wood !== undefined, `Fire entity missing wood property`);
                const woodLevel = fire.wood;
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

                // Group resources by tile and type for simplified reproduction logic
                const tileSize = GameConfig.world.tileSize;
                const resourceGroups = new Map(); // Map: "tileX,tileY,type" -> array of entities

                // Group uncollected resources by tile and type
                for (const entity of this.entities) {
                    if (!entity.collected && (GameUtils.ALL_FOOD_TYPES.includes(entity.type) || GameUtils.ALL_BURNABLE_TYPES.includes(entity.type))) {
                        const tileX = Math.floor(entity.position.x / tileSize);
                        const tileY = Math.floor(entity.position.y / tileSize);
                        const key = `${tileX},${tileY},${entity.type}`;

                        if (!resourceGroups.has(key)) {
                            resourceGroups.set(key, []);
                        }
                        resourceGroups.get(key).push(entity);
                    }
                }

                // Check each group for reproduction (2+ of same type in same tile)
                for (const [key, entities] of resourceGroups) {
                    if (entities.length >= 2) {
                        // Parse tile and type from key
                        const [tileXStr, tileYStr, resourceType] = key.split(',');
                        const tileX = parseInt(tileXStr);
                        const tileY = parseInt(tileYStr);

                        // Calculate propagation chance based on global resource count
                        const globalCount = this.getGlobalResourceCount(resourceType);
                        const baseChance = 0.5; // 50% base chance
                        const maxCount = GameUtils.ALL_BURNABLE_TYPES.includes(resourceType) ? GameConfig.resources.maxCounts.tree : GameConfig.resources.maxCounts.default;
                        const finalChance = Math.max(0, baseChance * (1 - globalCount / maxCount)); // Decreases to 0% at max count

                        // Attempt to spawn new resource in the same tile
                        if (this.seededRandom.random() < finalChance) {
                            // Find a random position within the same tile
                            const tileStartX = tileX * tileSize;
                            const tileStartY = tileY * tileSize;
                            const tileEndX = Math.min(tileStartX + tileSize, GameConfig.world.width);
                            const tileEndY = Math.min(tileStartY + tileSize, GameConfig.world.height);

                            // Generate random position within tile bounds, avoiding walls
                            const gridCell = { x: tileX, y: tileY };
                            const newPosition = this.findSafePositionInGridCell(gridCell, 20);

                            // Skip if we couldn't find a safe position
                            if (!newPosition) continue;

                            // Additional check for village proximity
                            if (this.isTooCloseToVillage(newPosition)) continue;

                            // Check if position is already occupied
                            const tooClose = this.entities.some(e =>
                                !e.collected &&
                                GameUtils.distance(newPosition, e.position) < 20
                            );

                            if (!tooClose) {
                                const emoji = this.getResourceEmoji(resourceType);
                                const newEntity = {
                                    position: newPosition,
                                    type: resourceType,
                                    emoji: emoji,
                                    collected: false,
                                    isChild: true, // Mark as child
                                    birthTime: this.playerState.currentTime, // Track when born
                                    tileX: tileX,
                                    tileY: tileY
                                };

                                // Add to entities array - visual creation will be handled by main entity system
                                this.entities.push(newEntity);

                                if (window.summaryLoggingEnabled) {
                                    console.log(`[Propagation] ${resourceType} spawned child at (${Math.round(newPosition.x)}, ${Math.round(newPosition.y)}) in tile (${tileX}, ${tileY}) - Global count: ${globalCount + 1}`);
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

        updateAnimalFleeing(delta) {
            // Get all animals (only check entities that are in resourceData)
            const animals = this.entities.filter(e => {
                if (e.collected) return false;
                // Only check entities that are in resourceData (animals, plants, burnables)
                if (!GameConfig.resources.resourceData[e.type]) return false;
                const runspeed = GameUtils.getRunspeed(e.type);
                return runspeed > 0;
            });

            // Debug: Log animal count occasionally
            if (window.summaryLoggingEnabled && Math.random() < GameConfig.logging.loggingChance) { // 1% chance per frame when spam enabled
                console.log(`[Animals] Processing ${animals.length} animals with delta ${delta}ms`);
            }

            for (const animal of animals) {
                let isFleeing = false;

                // Check distance to player
                const distToPlayer = GameUtils.distance(this.playerState.position, animal.position);
                if (distToPlayer < GameConfig.technical.distances.animalSenseDistance) {
                    this.fleeFromTarget(animal, this.playerState.position, delta);
                    isFleeing = true;

                    // Set fleeing sprite to blue cube emoji
                    if (animal.phaserText) {
                        animal.phaserText.setText('🟦');
                    }
                }

                // Check distance to villagers
                for (const villager of this.villagers) {
                    if (villager && !villager.isDead) {
                        const distToVillager = GameUtils.distance(villager.position, animal.position);
                        if (distToVillager < GameConfig.technical.distances.animalSenseDistance) {
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
                // Calculate flee target 
                const fleeDistance = GameConfig.technical.distances.animalFleeDistance;
                const fleeTarget = {
                    x: animal.position.x + (dx / dist) * fleeDistance,
                    y: animal.position.y + (dy / dist) * fleeDistance
                };

                // Keep flee target within world bounds
                fleeTarget.x = Math.max(0, Math.min(GameConfig.world.width, fleeTarget.x));
                fleeTarget.y = Math.max(0, Math.min(GameConfig.world.height, fleeTarget.y));

                // Use direct fleeing (no A* pathfinding for animals)
                // Remove from debug visualization
                if (this.pathfinder && GameConfig.navigation.debugVisualization.enabled) {
                    this.pathfinder.removeActivePath(animal);
                }

                // Direct movement to flee target
                this.moveAnimalTowards(animal, fleeTarget, delta);
            }
        }

        // Helper method for animal movement
        moveAnimalTowards(animal, target, delta) {
            const dx = target.x - animal.position.x;
            const dy = target.y - animal.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                // Move at procedurally generated animal speed using actual delta time
                const animalSpeed = GameUtils.getRunspeed(animal.type);
                const moveSpeed = animalSpeed * (delta / 1000); // Procedurally generated animal speed, actual delta
                const moveX = (dx / dist) * moveSpeed;
                const moveY = (dy / dist) * moveSpeed;

                // Calculate new position
                const newX = animal.position.x + moveX;
                const newY = animal.position.y + moveY;

                // Check wall collision before applying movement
                const newPosition = { x: newX, y: newY };
                const hasCollision = this.checkWallCollision(newPosition, 10); // 10px collision radius for animals

                // Only apply movement if no collision
                if (!hasCollision) {
                    animal.position.x = newX;
                    animal.position.y = newY;
                } else {
                    // If we hit a wall, try to move along the wall instead of stopping completely
                    // This helps animals navigate around obstacles
                    const reducedMoveSpeed = moveSpeed * 0.5; // Move slower when hitting walls

                    // Try horizontal movement only
                    const horizontalMoveX = (dx / dist) * reducedMoveSpeed;
                    const horizontalPosition = { x: animal.position.x + horizontalMoveX, y: animal.position.y };
                    if (!this.checkWallCollision(horizontalPosition, 10)) {
                        animal.position.x += horizontalMoveX;
                    } else {
                        // Try vertical movement only
                        const verticalMoveY = (dy / dist) * reducedMoveSpeed;
                        const verticalPosition = { x: animal.position.x, y: animal.position.y + verticalMoveY };
                        if (!this.checkWallCollision(verticalPosition, 10)) {
                            animal.position.y += verticalMoveY;
                        }
                    }
                }

                // Keep within world bounds
                animal.position.x = Math.max(0, Math.min(GameConfig.world.width, animal.position.x));
                animal.position.y = Math.max(0, Math.min(GameConfig.world.height, animal.position.y));

                // Update visual position and direction
                if (animal._phaserText && animal._phaserText.setPosition) {
                    animal._phaserText.setPosition(animal.position.x, animal.position.y);

                    // Flip animal based on movement direction (only horizontal movement matters)
                    if (Math.abs(moveX) > 0.1) {
                        if (moveX > 0) {
                            // Moving right - flip horizontally
                            animal._phaserText.setScale(-1, 1);
                        } else {
                            // Moving left - no flip (natural direction)
                            animal._phaserText.setScale(1, 1);
                        }
                    }
                }
            }
        }

        updateAnimalWandering(animal, delta) {
            // Initialize wandering state if not exists
            if (!animal.wanderState) {
                animal.wanderState = {
                    targetPosition: null,
                    wanderSpeed: GameUtils.getRunspeed(animal.type) / 2, // Half the procedurally generated animal speed
                    changeDirectionTimer: 0,
                    changeDirectionInterval: GameConfig.animals.directionChangeInterval.min + this.seededRandom.random() * (GameConfig.animals.directionChangeInterval.max - GameConfig.animals.directionChangeInterval.min) // 2-5 seconds
                };
            }

            const wander = animal.wanderState;
            wander.changeDirectionTimer += delta; // Use actual delta time instead of fixed 16ms

            // Change direction periodically or if reached target
            if (wander.changeDirectionTimer >= wander.changeDirectionInterval ||
                (wander.targetPosition && GameUtils.distance(animal.position, wander.targetPosition) < 20)) {

                // Pick new random direction using seeded random
                const angle = this.seededRandom.random() * 2 * Math.PI;
                const distance = GameConfig.technical.distances.animalWanderRange.min + this.seededRandom.random() * (GameConfig.technical.distances.animalWanderRange.max - GameConfig.technical.distances.animalWanderRange.min); // 50-150 pixels away
                wander.targetPosition = {
                    x: animal.position.x + Math.cos(angle) * distance,
                    y: animal.position.y + Math.sin(angle) * distance
                };

                // Keep within world bounds
                wander.targetPosition.x = Math.max(0, Math.min(GameConfig.world.width, wander.targetPosition.x));
                wander.targetPosition.y = Math.max(0, Math.min(GameConfig.world.height, wander.targetPosition.y));

                // Reset timer (speed stays constant)
                wander.changeDirectionTimer = 0;
                wander.changeDirectionInterval = GameConfig.animals.directionChangeInterval.min + this.seededRandom.random() * (GameConfig.animals.directionChangeInterval.max - GameConfig.animals.directionChangeInterval.min); // 2-5 seconds
            }

            // Move towards target if we have one (DIRECT MOVEMENT ONLY - NO PATHFINDING)
            if (wander.targetPosition) {
                const dx = wander.targetPosition.x - animal.position.x;
                const dy = wander.targetPosition.y - animal.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    // Move at wandering speed using actual delta time
                    const moveSpeed = wander.wanderSpeed * (delta / 1000); // Convert to per-frame movement using actual delta
                    const moveX = (dx / dist) * moveSpeed;
                    const moveY = (dy / dist) * moveSpeed;

                    // Calculate new position
                    const newX = animal.position.x + moveX;
                    const newY = animal.position.y + moveY;

                    // Check wall collision before applying movement
                    const newPosition = { x: newX, y: newY };
                    const hasCollision = this.checkWallCollision(newPosition, 10); // 10px collision radius for animals

                    // Only apply movement if no collision
                    if (!hasCollision) {
                        animal.position.x = newX;
                        animal.position.y = newY;
                    }

                    // Keep within world bounds
                    animal.position.x = Math.max(0, Math.min(GameConfig.world.width, animal.position.x));
                    animal.position.y = Math.max(0, Math.min(GameConfig.world.height, animal.position.y));

                    // Update visual position and direction
                    if (animal._phaserText && animal._phaserText.setPosition) {
                        animal._phaserText.setPosition(animal.position.x, animal.position.y);

                        // Flip animal based on movement direction (only horizontal movement matters)
                        if (Math.abs(moveX) > 0.1) {
                            if (moveX > 0) {
                                // Moving right - flip horizontally
                                animal._phaserText.setScale(-1, 1);
                            } else {
                                // Moving left - no flip (natural direction)
                                animal._phaserText.setScale(1, 1);
                            }
                        }
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

            // Day: use biome temperature (no randomness)
            if (inRange(t.hour, cfg.day)) {
                // Get biome at current player position
                const biome = this.getBiomeAtPosition(this.playerState.position.x, this.playerState.position.y);
                assert(biome, 'Failed to get biome at player position');

                // Use biome temperature from config
                const biomeConfig = GameConfig.resources.biomes[biome.type];
                assert(biomeConfig, `Missing biome config for type: ${biome.type}`);

                // Return biome temperature (should be 'moderate', 'warm', 'cold', or 'freezing')
                return biomeConfig.temperature;
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
                assert(well.waterLevel !== undefined, `Well entity missing waterLevel property`);
                const waterLevel = well.waterLevel;
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

        createSmokeIndicator() {
            // Generate smoke location based on seed (3x world distance)
            const worldWidth = GameConfig.world.width;
            const worldHeight = GameConfig.world.height;
            const distanceMultiplier = GameConfig.smokeIndicator.distanceMultiplier;

            // Use seeded random to generate consistent smoke direction
            const angle = this.seededRandom.random() * 2 * Math.PI;
            const distance = Math.max(worldWidth, worldHeight) * distanceMultiplier;

            this.smokeLocation = {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance
            };

            console.log(`[SmokeIndicator] Generated smoke location at (${Math.round(this.smokeLocation.x)}, ${Math.round(this.smokeLocation.y)})`);

            // Create smoke indicator UI elements
            const config = GameConfig.smokeIndicator;

            // Create arrow sprite (triangle shape)
            this.smokeArrow = this.add.graphics()
                .setScrollFactor(0)
                .setDepth(GameConfig.ui.zIndex.overlayContent);

            // Create text label (50% smaller)
            this.smokeText = this.add.text(0, 0, `💨 ${config.label}`, {
                fontSize: (config.fontSize * 0.5) + 'px',
                fontFamily: 'monospace',
                color: config.textColor,
                backgroundColor: config.backgroundColor,
                padding: { x: config.padding, y: config.padding }
            })
                .setOrigin(0.5, 0.5)
                .setScrollFactor(0)
                .setDepth(GameConfig.ui.zIndex.overlayContent);

            // Add to UI container
            this.uiContainer.add([this.smokeArrow, this.smokeText]);

            // Start gentle blinking animation
            this.startSmokeBlinking();
        }

        updateSmokeIndicator() {
            // Always point to 135 degrees (southeast)
            const angle = Math.PI * 0.25;

            // Always place in bottom-right quadrant for simplicity
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const margin = GameConfig.smokeIndicator.edgeMargin;
            const arrowSize = GameConfig.smokeIndicator.arrowSize;

            // Fixed position in bottom-right corner
            const edgeX = screenWidth - margin;
            const edgeY = screenHeight - margin;


            // Update arrow position and rotation
            this.smokeArrow.clear();
            this.smokeArrow.lineStyle(3, GameConfig.smokeIndicator.arrowColor, GameConfig.smokeIndicator.arrowAlpha);
            this.smokeArrow.fillStyle(GameConfig.smokeIndicator.arrowColor, GameConfig.smokeIndicator.arrowAlpha);

            // Draw arrow triangle pointing in the direction of smoke
            const arrowLength = arrowSize;
            const arrowWidth = arrowSize * 0.6;

            // Arrow points toward smoke direction
            const arrowAngle = angle;

            // Calculate arrow points
            const tipX = edgeX + Math.cos(arrowAngle) * arrowLength;
            const tipY = edgeY + Math.sin(arrowAngle) * arrowLength;

            const base1X = edgeX + Math.cos(arrowAngle + Math.PI / 2) * arrowWidth / 2;
            const base1Y = edgeY + Math.sin(arrowAngle + Math.PI / 2) * arrowWidth / 2;

            const base2X = edgeX + Math.cos(arrowAngle - Math.PI / 2) * arrowWidth / 2;
            const base2Y = edgeY + Math.sin(arrowAngle - Math.PI / 2) * arrowWidth / 2;

            // Draw arrow triangle
            this.smokeArrow.beginPath();
            this.smokeArrow.moveTo(tipX, tipY);
            this.smokeArrow.lineTo(base1X, base1Y);
            this.smokeArrow.lineTo(base2X, base2Y);
            this.smokeArrow.closePath();
            this.smokeArrow.fill();
            this.smokeArrow.stroke();

            // Position text to the left and above the arrow
            const textX = edgeX - arrowSize - 20;
            const textY = edgeY - arrowSize + 10;

            this.smokeText.setPosition(textX, textY);
        }

        startSmokeBlinking() {
            const config = GameConfig.smokeIndicator;

            this.tweens.add({
                targets: this.smokeArrow,
                alpha: 0.4,
                duration: 750,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

            this.tweens.add({
                targets: this.smokeText,
                alpha: 0.6,
                duration: 750,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
        }

        shutdown() {
            // Clean up debug graphics
            if (this.debugGraphics) {
                this.debugGraphics.destroy();
                this.debugGraphics = null;
            }
        }

        // Line of sight system
        initializeLineOfSight() {
            assert(GameConfig.lineOfSight, 'Line of sight config is missing');
            assert(GameConfig.lineOfSight.enabled !== undefined, 'Line of sight enabled flag is missing');

            if (!GameConfig.lineOfSight.enabled) {
                console.log('[LineOfSight] System disabled in config');
                return;
            }

            console.log('[LineOfSight] Initializing line of sight system...');

            // Calculate grid dimensions
            const tileSize = GameConfig.lineOfSight.tileSize;
            const worldWidth = GameConfig.world.width;
            const worldHeight = GameConfig.world.height;

            this.lineOfSightTilesX = Math.ceil(worldWidth / tileSize);
            this.lineOfSightTilesY = Math.ceil(worldHeight / tileSize);

            // Create overlay rectangles for each grid cell
            this.lineOfSightOverlays = [];

            for (let tileX = 0; tileX < this.lineOfSightTilesX; tileX++) {
                this.lineOfSightOverlays[tileX] = [];
                for (let tileY = 0; tileY < this.lineOfSightTilesY; tileY++) {
                    const overlayX = tileX * tileSize + tileSize / 2;
                    const overlayY = tileY * tileSize + tileSize / 2;

                    const overlay = this.add.rectangle(
                        overlayX,
                        overlayY,
                        tileSize,
                        tileSize,
                        GameConfig.lineOfSight.overlayColor
                    ).setOrigin(0.5)
                        .setDepth(GameConfig.ui.zIndex.lineOfSight)
                        .setAlpha(GameConfig.lineOfSight.overlayAlpha);

                    this.lineOfSightOverlays[tileX][tileY] = overlay;
                }
            }

            // Initialize update timer
            this.lastLineOfSightUpdate = 0;

            console.log(`[LineOfSight] Created ${this.lineOfSightTilesX}x${this.lineOfSightTilesY} overlay grid`);
        }

        updateLineOfSight(deltaTime) {
            if (!GameConfig.lineOfSight.enabled || !this.lineOfSightOverlays) {
                return;
            }

            // Update at specified interval for performance
            this.lastLineOfSightUpdate += deltaTime;
            if (this.lastLineOfSightUpdate < GameConfig.lineOfSight.updateInterval) {
                return;
            }
            this.lastLineOfSightUpdate = 0;

            // Get player's current grid cell
            const playerGridCell = this.getPlayerGridCell();
            assert(playerGridCell, 'Failed to get player grid cell');

            // Update visibility for all grid cells
            for (let tileX = 0; tileX < this.lineOfSightTilesX; tileX++) {
                for (let tileY = 0; tileY < this.lineOfSightTilesY; tileY++) {
                    const overlay = this.lineOfSightOverlays[tileX][tileY];
                    assert(overlay, `Missing overlay at grid cell (${tileX}, ${tileY})`);

                    // Check if this cell is the player's current cell
                    const isPlayerCell = (tileX === playerGridCell.x && tileY === playerGridCell.y);

                    // Hide overlay if player is in this cell, show otherwise
                    overlay.setVisible(!isPlayerCell);
                }
            }
        }

        getPlayerGridCell() {
            assert(this.playerState, 'Player state is required');
            assert(this.playerState.position, 'Player position is required');

            const tileSize = GameConfig.lineOfSight.tileSize;
            const position = this.playerState.position;

            return {
                x: Math.floor(position.x / tileSize),
                y: Math.floor(position.y / tileSize)
            };
        }

        // Organic camp clustering system
        createOrganicCampClusters(centerX, centerY, campCount) {
            const camps = [];
            // Scale distances based on world size - use more space when available
            const worldSize = Math.max(GameConfig.world.width, GameConfig.world.height);
            const scaleFactor = Math.min(worldSize / 20000, 3); // Scale up to 3x for larger worlds

            const minDistance = 250 * scaleFactor; // Minimum distance between camps
            const maxRadius = 400 * scaleFactor;   // Maximum distance from center
            const minCenterDistance = 250 * scaleFactor; // Minimum distance from village center

            for (let i = 0; i < campCount; i++) {
                let attempts = 0;
                let campPosition;

                do {
                    // Use organic placement instead of perfect circle
                    const angle = this.seededRandom.random() * Math.PI * 2;
                    const radius = this.seededRandom.randomRange(200 * scaleFactor, maxRadius);

                    // Add natural clustering variation (scaled)
                    const clusterVariation = this.seededRandom.randomRange(-50 * scaleFactor, 50 * scaleFactor);
                    const finalRadius = radius + clusterVariation;

                    campPosition = {
                        x: centerX + Math.cos(angle) * finalRadius,
                        y: centerY + Math.sin(angle) * finalRadius
                    };

                    attempts++;
                } while (
                    this.isTooCloseToOtherCamps(campPosition, camps, minDistance) ||
                    this.isTooCloseToCenter(campPosition, centerX, centerY, minCenterDistance) ||
                    attempts < 50
                );

                camps.push({ position: campPosition, villagerId: i });
            }

            return camps;
        }

        isTooCloseToOtherCamps(position, existingCamps, minDistance) {
            for (const camp of existingCamps) {
                const dist = GameUtils.distance(position, camp.position);
                if (dist < minDistance) {
                    return true;
                }
            }
            return false;
        }

        isTooCloseToCenter(position, centerX, centerY, minDistance) {
            const dist = GameUtils.distance(position, { x: centerX, y: centerY });
            return dist < minDistance;
        }

        placeCampFacilities(campCenter, villagerId) {
            // Add natural variation to facility placement
            const orientation = this.seededRandom.random() * Math.PI * 2;
            const baseSpacing = 60;
            const variation = 20;

            // Fireplace - slightly offset from camp center
            const fireplaceOffset = {
                x: Math.cos(orientation) * (baseSpacing + this.seededRandom.randomRange(-variation, variation)),
                y: Math.sin(orientation) * (baseSpacing + this.seededRandom.randomRange(-variation, variation))
            };

            // Sleeping bag - opposite side from fireplace
            const sleepingBagOffset = {
                x: Math.cos(orientation + Math.PI) * (baseSpacing + this.seededRandom.randomRange(-variation, variation)),
                y: Math.sin(orientation + Math.PI) * (baseSpacing + this.seededRandom.randomRange(-variation, variation))
            };

            // Personal storage - perpendicular to fireplace
            const storageOffset = {
                x: Math.cos(orientation + Math.PI / 2) * (baseSpacing + this.seededRandom.randomRange(-variation, variation)),
                y: Math.sin(orientation + Math.PI / 2) * (baseSpacing + this.seededRandom.randomRange(-variation, variation))
            };

            return {
                fireplace: { x: campCenter.x + fireplaceOffset.x, y: campCenter.y + fireplaceOffset.y },
                sleepingBag: { x: campCenter.x + sleepingBagOffset.x, y: campCenter.y + sleepingBagOffset.y },
                storage: { x: campCenter.x + storageOffset.x, y: campCenter.y + storageOffset.y }
            };
        }

        // Generate random position within a camp cell area
        generateRandomCampPosition(campCenter) {
            assert(campCenter && typeof campCenter.x === 'number' && typeof campCenter.y === 'number',
                'Camp center must have valid x,y coordinates');

            // Define camp cell radius (area where villager can spawn)
            const campRadius = GameConfig.villager.spawn.campRadius;

            // Generate random angle and distance from camp center
            const angle = this.seededRandom.random() * Math.PI * 2;
            const distance = this.seededRandom.randomRange(0, campRadius);

            return {
                x: campCenter.x + Math.cos(angle) * distance,
                y: campCenter.y + Math.sin(angle) * distance
            };
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
        assert(colors[type] !== undefined, `Missing color for type: ${type}`);
        return colors[type];
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

    // Resource generation system for procedural nutrition values
    class ResourceGeneration {
        constructor(seededRandom) {
            this.seededRandom = seededRandom;
            this.generatedNutrition = {};

            // Initialize all nutrition values
            this.initializeAllNutrition();
        }

        // Initialize all nutrition values at game start
        initializeAllNutrition() {
            assert(this.seededRandom, 'SeededRandom instance required for resource generation');
            this.generatedNutrition = {};

            // Generate nutrition for every resource
            for (const [resourceName, resourceData] of Object.entries(GameConfig.resources.resourceData)) {
                this.generatedNutrition[resourceName] = this.generateNutritionForResource(resourceName, resourceData);
            }

            console.log('[ResourceGeneration] Generated nutrition for', Object.keys(this.generatedNutrition).length, 'resources');
        }

        // Generate nutrition for a single resource
        generateNutritionForResource(resourceName, resourceData) {
            const category = resourceData.category;
            const rules = GameConfig.resources.resourceCategories[category];
            const random = this.seededRandom;

            assert(category, `Resource ${resourceName} missing category`);
            assert(rules, `Unknown category: ${category}`);
            assert(random, 'SeededRandom not initialized');

            // Start with base category values
            let nutrition = {
                calories: rules.calories,
                water: rules.water,
                fire: rules.fire,
                vitamins: Array.isArray(rules.vitamins) ? [...rules.vitamins] : [0, 0, 0, 0, 0], // Copy base vitamins or create array
                runspeed: rules.runspeed // Copy base runspeed
            };

            // Generate random values for ranges
            if (typeof rules.calories === 'object') {
                nutrition.calories = random.randomRange(rules.calories.min, rules.calories.max);
            }
            if (typeof rules.water === 'object') {
                nutrition.water = random.randomRange(rules.water.min, rules.water.max);
            }
            if (typeof rules.fire === 'object') {
                nutrition.fire = random.randomRange(rules.fire.min, rules.fire.max);
            }

            // Check for poisonous variants
            if (rules.poisonousChance && random.random() < rules.poisonousChance) {
                nutrition.calories = random.randomRange(rules.poisonousCalories.min, rules.poisonousCalories.max);
                nutrition.water = rules.poisonousWater;
                nutrition.vitamins = [0, 0, 0, 0, 0]; // Poisonous variants have no vitamins
            }

            // Generate vitamins for non-burnables
            if (category !== 'burnable') {
                nutrition.vitamins = this.generateVitamins(random);
            }

            // Generate runspeed for animals
            if (category === 'animal') {
                nutrition.runspeed = this.generateRunspeed(random);
            }

            return nutrition;
        }

        // Generate vitamin distribution
        generateVitamins(random) {
            const vitamins = [0, 0, 0, 0, 0];
            const vitaminCount = random.randomInt(
                GameConfig.resources.vitaminDistribution.vitaminCount.min,
                GameConfig.resources.vitaminDistribution.vitaminCount.max
            );

            // Select random vitamins to assign
            const vitaminIndices = [];
            for (let i = 0; i < 5; i++) {
                vitaminIndices.push(i);
            }

            // Shuffle and take first vitaminCount
            for (let i = vitaminIndices.length - 1; i > 0; i--) {
                const j = random.randomInt(0, i + 1);
                [vitaminIndices[i], vitaminIndices[j]] = [vitaminIndices[j], vitaminIndices[i]];
            }

            // Assign vitamins
            for (let i = 0; i < vitaminCount; i++) {
                const vitaminIndex = vitaminIndices[i];
                const strength = random.randomRange(
                    GameConfig.resources.vitaminDistribution.vitaminStrength.min,
                    GameConfig.resources.vitaminDistribution.vitaminStrength.max
                );
                vitamins[vitaminIndex] = strength;
            }

            return vitamins;
        }

        // Generate runspeed for animals
        generateRunspeed(random) {
            const villagerSpeed = GameConfig.villager.moveSpeed; // Base villager speed
            const rules = GameConfig.resources.resourceCategories.animal.runspeed;

            // 75% chance to be slower, 25% chance to be faster
            if (random.random() < rules.slowChance) {
                // Slower: 10-20 units slower than villager
                const speedReduction = random.randomRange(rules.slowRange.min, rules.slowRange.max);
                return Math.max(0, villagerSpeed + speedReduction); // Ensure non-negative
            } else {
                // Faster: 20-30 units faster than villager
                const speedIncrease = random.randomRange(rules.fastRange.min, rules.fastRange.max);
                return villagerSpeed + speedIncrease;
            }
        }

        // Get nutrition for a resource (use cached values)
        getNutrition(resourceName) {
            assert(this.generatedNutrition[resourceName], `No nutrition data for resource: ${resourceName}`);
            return this.generatedNutrition[resourceName];
        }

        // Get runspeed for a resource (use cached values)
        getRunspeed(resourceName) {
            assert(this.generatedNutrition[resourceName], `No nutrition data for resource: ${resourceName}`);
            assert(this.generatedNutrition[resourceName].runspeed !== undefined, `Resource ${resourceName} missing runspeed property`);
            return this.generatedNutrition[resourceName].runspeed;
        }
    }

    // === BEGIN: Minimal Binary Heap for A* ===
    class MinHeap {
        constructor(scoreFn) {
            assert(scoreFn && typeof scoreFn === 'function', 'Score function required for MinHeap');
            this.content = [];
            this.scoreFn = scoreFn;
        }
        push(element) {
            this.content.push(element);
            this.bubbleUp(this.content.length - 1);
        }
        pop() {
            assert(this.content.length > 0, 'Heap underflow');
            const result = this.content[0];
            const end = this.content.pop();
            if (this.content.length > 0) {
                this.content[0] = end;
                this.sinkDown(0);
            }
            return result;
        }
        size() {
            return this.content.length;
        }
        bubbleUp(n) {
            const element = this.content[n];
            while (n > 0) {
                const parentN = Math.floor((n + 1) / 2) - 1;
                const parent = this.content[parentN];
                if (this.scoreFn(element) >= this.scoreFn(parent)) break;
                this.content[parentN] = element;
                this.content[n] = parent;
                n = parentN;
            }
        }
        sinkDown(n) {
            const element = this.content[n];
            while (true) {
                const child2N = (n + 1) * 2;
                const child1N = child2N - 1;
                let swap = null;
                if (child1N < this.content.length) {
                    const child1 = this.content[child1N];
                    if (this.scoreFn(child1) < this.scoreFn(element)) swap = child1N;
                }
                if (child2N < this.content.length) {
                    const child2 = this.content[child2N];
                    if (this.scoreFn(child2) < (swap === null ? this.scoreFn(element) : this.scoreFn(this.content[swap]))) swap = child2N;
                }
                if (swap === null) break;
                this.content[n] = this.content[swap];
                this.content[swap] = element;
                n = swap;
            }
        }
    }
    // === END: Minimal Binary Heap for A* ===

    // A* Pathfinding system for villagers and animals
    class Pathfinder {
        // Precomputed directions for neighbor checking
        static NEIGHBOR_DIRECTIONS = [
            { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
        ];

        constructor(scene, worldWidth, worldHeight) {
            assert(scene, 'Scene required for pathfinder');
            assert(worldWidth > 0, 'World width must be positive');
            assert(worldHeight > 0, 'World height must be positive');

            this.scene = scene;
            this.worldWidth = worldWidth;
            this.worldHeight = worldHeight;
            this.gridSize = GameConfig.navigation.gridSize;
            this.walls = scene.walls || []; // Store reference to wall data

            // Calculate grid dimensions
            this.gridWidth = Math.ceil(worldWidth / this.gridSize);
            this.gridHeight = Math.ceil(worldHeight / this.gridSize);

            console.log(`[Pathfinder] Initialized with ${this.gridWidth}x${this.gridHeight} grid (${this.gridSize}px cells) and ${this.walls.length} walls`);

            // Debug visualization data
            this.debugData = {
                activePaths: [], // Array of { entity, path, target, startTime }
                lastPathfindingResult: null, // Last pathfinding attempt result
                gridDebugInfo: null // Grid debug information
            };

            // Don't initialize blocked grid immediately - wait for gates to be created
            this.blockedGrid = null;
            this.wallPartitions = null;
        }

        // Method to initialize the blocked grid after gates are created
        initializeBlockedGridAfterGates() {
            console.log(`[Pathfinder] Initializing blocked grid after gates are created...`);

            // Pre-calculate blocked grid cells
            this.initializeBlockedGrid();
        }

        // Convert world coordinates to grid coordinates
        worldToGrid(worldPos) {
            assert(worldPos && typeof worldPos.x === 'number' && typeof worldPos.y === 'number', 'Invalid world position');

            const gridX = Math.floor(worldPos.x / this.gridSize);
            const gridY = Math.floor(worldPos.y / this.gridSize);

            // Clamp to grid bounds
            return {
                x: Math.max(0, Math.min(gridX, this.gridWidth - 1)),
                y: Math.max(0, Math.min(gridY, this.gridHeight - 1))
            };
        }

        // Convert grid coordinates to world coordinates (center of cell)
        gridToWorld(gridPos) {
            assert(gridPos && typeof gridPos.x === 'number' && typeof gridPos.y === 'number', 'Invalid grid position');
            assert(gridPos.x >= 0 && gridPos.x < this.gridWidth, 'Grid X out of bounds');
            assert(gridPos.y >= 0 && gridPos.y < this.gridHeight, 'Grid Y out of bounds');

            return {
                x: gridPos.x * this.gridSize + this.gridSize / 2,
                y: gridPos.y * this.gridSize + this.gridSize / 2
            };
        }

        // Initialize blocked grid cells (pre-calculated for performance)
        initializeBlockedGrid() {
            console.log(`[Pathfinder] Pre-calculating blocked grid cells...`);
            const startTime = performance.now();

            // Create 2D array for blocked cells
            this.blockedGrid = new Array(this.gridWidth);
            for (let x = 0; x < this.gridWidth; x++) {
                this.blockedGrid[x] = new Array(this.gridHeight);
            }

            // Build spatial partition for walls
            this.buildWallSpatialPartition();

            let blockedCount = 0;
            let totalCells = 0;

            // Check each grid cell
            for (let gridX = 0; gridX < this.gridWidth; gridX++) {
                for (let gridY = 0; gridY < this.gridHeight; gridY++) {
                    totalCells++;

                    // Convert grid cell center to world coordinates
                    const worldPos = this.gridToWorld({ x: gridX, y: gridY });

                    // Check if the center of the grid cell is blocked by walls (using spatial partitioning)
                    // Add pathfinding wall margin to make NPCs stay further from walls
                    const pathfindingRadius = this.gridSize / 2 + GameConfig.navigation.pathfindingWallMargin;
                    const isBlockedByWalls = this.checkWallCollisionOptimized(worldPos, pathfindingRadius);

                    // Check if the center of the grid cell is blocked by deadly gates
                    const isBlockedByDeadlyGates = this.checkDeadlyGateCollision(worldPos, this.gridSize / 2);

                    // Grid cell is blocked if either walls or deadly gates block it
                    const isBlocked = isBlockedByWalls || isBlockedByDeadlyGates;

                    // Debug: Log when gates are blocking pathfinding
                    if (isBlockedByDeadlyGates && window.summaryLoggingEnabled) {
                        console.log(`[Pathfinder] Grid cell blocked by deadly gate at (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
                    }

                    this.blockedGrid[gridX][gridY] = isBlocked;

                    if (isBlocked) {
                        blockedCount++;
                    }
                }
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`[Pathfinder] Grid initialization complete: ${blockedCount}/${totalCells} cells blocked (${(blockedCount / totalCells * 100).toFixed(1)}%) in ${duration.toFixed(2)}ms`);

            // Debug: Log a few sample blocked cells
            if (blockedCount > 0) {
                let sampleCount = 0;
                for (let gridX = 0; gridX < this.gridWidth && sampleCount < 5; gridX++) {
                    for (let gridY = 0; gridY < this.gridHeight && sampleCount < 5; gridY++) {
                        if (this.blockedGrid[gridX][gridY]) {
                            const worldPos = this.gridToWorld({ x: gridX, y: gridY });
                            console.log(`[Pathfinder] Sample blocked cell: grid(${gridX}, ${gridY}) = world(${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
                            sampleCount++;
                        }
                    }
                }
            }
        }

        // Build spatial partition for walls to optimize collision checks
        buildWallSpatialPartition() {
            console.log(`[Pathfinder] Building wall spatial partition...`);

            // Get all wall segments from the stored wall data (same as movement collision)
            const wallSegments = this.walls;
            if (!wallSegments || wallSegments.length === 0) {
                console.warn(`[Pathfinder] Wall segments array is missing or empty. Expected non-empty array, got: ${wallSegments}`);
                return;
            }

            // Create spatial grid for walls (coarser than pathfinding grid)
            const partitionSize = GameConfig.navigation.partitioningGridSize;
            this.wallPartitionSize = partitionSize;
            this.wallPartitionWidth = Math.ceil(this.worldWidth / partitionSize);
            this.wallPartitionHeight = Math.ceil(this.worldHeight / partitionSize);

            // Initialize partition grid
            this.wallPartitions = new Array(this.wallPartitionWidth);
            for (let x = 0; x < this.wallPartitionWidth; x++) {
                this.wallPartitions[x] = new Array(this.wallPartitionHeight);
                for (let y = 0; y < this.wallPartitionHeight; y++) {
                    this.wallPartitions[x][y] = [];
                }
            }

            // Assign wall segments to partitions
            let totalWalls = 0;
            for (const wall of wallSegments) {
                totalWalls++;

                // Get wall bounds
                const bounds = this.getWallBounds(wall);

                // Find all partitions this wall intersects
                const partitions = this.getPartitionsForBounds(bounds);

                // Add wall to each relevant partition
                for (const partition of partitions) {
                    this.wallPartitions[partition.x][partition.y].push(wall);
                }
            }

            console.log(`[Pathfinder] Spatial partition complete: ${totalWalls} walls distributed across ${this.wallPartitionWidth}x${this.wallPartitionHeight} partitions`);

            // Debug: Log first few walls to verify data structure
            if (totalWalls > 0) {
                console.log(`[Pathfinder] Sample wall data:`, wallSegments.slice(0, 3).map(w => ({ x: w.x, y: w.y, width: w.width, height: w.height })));
            }
        }

        // Get bounding box for a wall segment
        getWallBounds(wall) {
            // Wall segments are typically rectangles, so we need their bounds
            // This assumes wall objects have position and size properties
            assert(wall, 'Wall object is required for bounds calculation');
            assert(typeof wall.x === 'number', `Wall x position must be a number, got: ${typeof wall.x}`);
            assert(typeof wall.y === 'number', `Wall y position must be a number, got: ${typeof wall.y}`);
            assert(typeof wall.width === 'number', `Wall width must be a number, got: ${typeof wall.width}`);
            assert(typeof wall.height === 'number', `Wall height must be a number, got: ${typeof wall.height}`);

            const x = wall.x;
            const y = wall.y;
            const width = wall.width;
            const height = wall.height;

            return {
                minX: x - width / 2,
                maxX: x + width / 2,
                minY: y - height / 2,
                maxY: y + height / 2
            };
        }

        // Get partition coordinates for a bounding box
        getPartitionsForBounds(bounds) {
            const partitions = [];

            const minPartX = Math.floor(bounds.minX / this.wallPartitionSize);
            const maxPartX = Math.floor(bounds.maxX / this.wallPartitionSize);
            const minPartY = Math.floor(bounds.minY / this.wallPartitionSize);
            const maxPartY = Math.floor(bounds.maxY / this.wallPartitionSize);

            for (let x = Math.max(0, minPartX); x <= Math.min(this.wallPartitionWidth - 1, maxPartX); x++) {
                for (let y = Math.max(0, minPartY); y <= Math.min(this.wallPartitionHeight - 1, maxPartY); y++) {
                    partitions.push({ x, y });
                }
            }

            return partitions;
        }

        // Optimized wall collision check using spatial partitioning
        checkWallCollisionOptimized(position, radius) {
            // Get partitions that could contain walls near this position
            const nearbyPartitions = this.getPartitionsForPosition(position, radius);

            // Check walls in nearby partitions only
            for (const partition of nearbyPartitions) {
                const walls = this.wallPartitions[partition.x][partition.y];

                for (const wall of walls) {
                    if (this.checkCollisionWithWall(position, radius, wall)) {
                        // Debug: Log collision detection occasionally
                        if (Math.random() < 0.001 && window.summaryLoggingEnabled) {
                            console.log(`[Pathfinder] Wall collision detected at (${Math.round(position.x)}, ${Math.round(position.y)}) with wall at (${Math.round(wall.x)}, ${Math.round(wall.y)})`);
                        }
                        return true;
                    }
                }
            }

            return false;
        }

        // Get partitions that could contain walls near a position
        getPartitionsForPosition(position, radius) {
            const bounds = {
                minX: position.x - radius,
                maxX: position.x + radius,
                minY: position.y - radius,
                maxY: position.y + radius
            };

            return this.getPartitionsForBounds(bounds);
        }

        // Check collision between a position and a specific wall
        checkCollisionWithWall(position, radius, wall) {
            // This is a simplified collision check - you may need to adapt this
            // based on how your wall objects are structured
            assert(wall, 'Wall object is required for collision check');
            assert(typeof wall.x === 'number', `Wall x position must be a number, got: ${typeof wall.x}`);
            assert(typeof wall.y === 'number', `Wall y position must be a number, got: ${typeof wall.y}`);
            assert(typeof wall.width === 'number', `Wall width must be a number, got: ${typeof wall.width}`);
            assert(typeof wall.height === 'number', `Wall height must be a number, got: ${typeof wall.height}`);

            const wallX = wall.x;
            const wallY = wall.y;
            const wallWidth = wall.width;
            const wallHeight = wall.height;

            // Simple rectangle-circle collision
            const closestX = Math.max(wallX - wallWidth / 2, Math.min(position.x, wallX + wallWidth / 2));
            const closestY = Math.max(wallY - wallHeight / 2, Math.min(position.y, wallY + wallHeight / 2));

            const distanceSquared = (position.x - closestX) ** 2 + (position.y - closestY) ** 2;
            return distanceSquared <= radius ** 2;
        }

        // Check collision between a position and deadly gates
        checkDeadlyGateCollision(position, radius) {
            assert(position && typeof position.x === 'number' && typeof position.y === 'number',
                'Position must have valid x,y coordinates for deadly gate collision check');
            assert(typeof radius === 'number' && radius >= 0,
                'Radius must be a non-negative number for deadly gate collision check');

            // Get gates from the scene
            const gates = this.scene.gates;
            if (!gates || !Array.isArray(gates)) {
                // If gates aren't available yet, return false (no blocking)
                if (window.summaryLoggingEnabled) {
                    console.log(`[Pathfinder] Gates not available yet for deadly gate collision check at (${Math.round(position.x)}, ${Math.round(position.y)})`);
                }
                return false;
            }

            // Debug: Log gate count occasionally
            if (Math.random() < 0.0001 && window.summaryLoggingEnabled) {
                const deadlyGates = gates.filter(g => g.isDeadly);
                console.log(`[Pathfinder] Checking deadly gate collision with ${gates.length} total gates, ${deadlyGates.length} deadly gates`);
            }

            for (const gate of gates) {
                assert(gate && typeof gate.x === 'number' && typeof gate.y === 'number',
                    'Gate must have valid x,y coordinates');
                assert(typeof gate.width === 'number' && typeof gate.height === 'number',
                    'Gate must have valid width/height');
                assert(typeof gate.isDeadly === 'boolean',
                    'Gate must have isDeadly boolean property');

                if (!gate.isDeadly) continue; // Only check deadly gates

                // Calculate distance from position to gate center
                const dx = Math.abs(position.x - gate.x);
                const dy = Math.abs(position.y - gate.y);

                // Check if within collision bounds
                const halfWidth = gate.width / 2 + radius;
                const halfHeight = gate.height / 2 + radius;

                if (dx <= halfWidth && dy <= halfHeight) {
                    // Debug: Log collision detection occasionally
                    if (Math.random() < 0.001 && window.summaryLoggingEnabled) {
                        console.log(`[Pathfinder] Deadly gate collision detected at (${Math.round(position.x)}, ${Math.round(position.y)}) with gate at (${Math.round(gate.x)}, ${Math.round(gate.y)})`);
                    }
                    return true;
                }
            }

            return false;
        }

        // Check if a grid cell is blocked by walls (using pre-calculated data)
        isGridCellBlocked(gridX, gridY) {
            assert(gridX >= 0 && gridX < this.gridWidth, 'Grid X out of bounds');
            assert(gridY >= 0 && gridY < this.gridHeight, 'Grid Y out of bounds');

            // Check if blocked grid is initialized
            if (!this.blockedGrid) {
                console.warn('[Pathfinder] Blocked grid not initialized yet, treating cell as unblocked');
                return false;
            }

            // Use pre-calculated blocked grid
            return this.blockedGrid[gridX][gridY];
        }

        // Find path using A* algorithm
        findPath(startPos, targetPos, maxAttempts = null, entity = null) {
            assert(startPos && typeof startPos.x === 'number' && typeof startPos.y === 'number', 'Invalid start position');
            assert(targetPos && typeof targetPos.x === 'number' && typeof targetPos.y === 'number', 'Invalid target position');
            assert(entity, 'Entity required for path caching');

            const now = Date.now();
            const minInterval = GameConfig.navigation?.pathfindingMinIntervalMs ?? 200;

            // Check if we should throttle based on time interval
            if (entity._lastPathTime && now - entity._lastPathTime < minInterval) {
                // Only return cached result if it exists and is valid
                if (entity._lastPathResult && entity._lastPathResult.length > 0) {
                    return entity._lastPathResult;
                }
                // If throttling but no valid cached result, continue with pathfinding
            }

            const startGrid = this.worldToGrid(startPos);
            const targetGrid = this.worldToGrid(targetPos);
            const cacheKey = `${startGrid.x},${startGrid.y}->${targetGrid.x},${targetGrid.y}`;

            // Check if we have a cached result for the same path
            if (entity._lastPathKey === cacheKey && entity._lastPathResult && entity._lastPathResult.length > 0) {
                return entity._lastPathResult;
            }

            const path = this.aStar(startGrid, targetGrid, maxAttempts || 10000, entity);

            // Only cache successful pathfinding results
            if (path && path.length > 0) {
                entity._lastPathKey = cacheKey;
                entity._lastPathResult = path;
                entity._lastPathTime = now;
            } else {
                // Don't cache failed pathfinding attempts
                entity._lastPathResult = null;
                entity._lastPathKey = null;
            }

            return path;
        }

        // Debug visualization methods
        addActivePath(entity, path, target) {
            assert(entity, 'Entity required for active path tracking');
            assert(path && Array.isArray(path), 'Path must be an array');
            assert(target && typeof target.x === 'number' && typeof target.y === 'number', 'Target must have x,y coordinates');

            // Remove any existing path for this entity
            this.removeActivePath(entity);

            // Add new active path
            this.debugData.activePaths.push({
                entity: entity,
                path: [...path], // Copy the path array
                target: { x: target.x, y: target.y },
                startTime: performance.now(),
                currentWaypointIndex: 0
            });
        }

        removeActivePath(entity) {
            assert(entity, 'Entity required for active path removal');

            const index = this.debugData.activePaths.findIndex(activePath => activePath.entity === entity);
            if (index !== -1) {
                this.debugData.activePaths.splice(index, 1);
            }
        }

        updateActivePathWaypoint(entity, waypointIndex) {
            assert(entity, 'Entity required for waypoint update');
            assert(typeof waypointIndex === 'number', 'Waypoint index must be a number');

            const activePath = this.debugData.activePaths.find(ap => ap.entity === entity);
            if (activePath) {
                activePath.currentWaypointIndex = waypointIndex;
            }
        }

        getDebugData() {
            return this.debugData;
        }

        // A* algorithm implementation
        aStar(startGrid, targetGrid, maxAttempts, entity = null) {
            assert(startGrid && targetGrid, 'Start and target grid positions required');
            assert(maxAttempts > 0, 'Max attempts must be positive');

            // Use MinHeap for open set
            const openSet = new MinHeap((node) => fScore.get(this.gridKey(node)) || Infinity);
            openSet.push(startGrid);
            const closedSet = new Set(); // Track visited nodes to prevent infinite loops
            const cameFrom = new Map();
            const gScore = new Map();
            const fScore = new Map();

            // Initialize scores
            gScore.set(this.gridKey(startGrid), 0);
            fScore.set(this.gridKey(startGrid), this.heuristic(startGrid, targetGrid));

            let attempts = 0;

            while (openSet.size() > 0 && attempts < maxAttempts) {
                attempts++;
                const current = openSet.pop();

                // Check if we reached the target
                if (current.x === targetGrid.x && current.y === targetGrid.y) {
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Pathfinder] A* found target after ${attempts} attempts`);
                    }
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Pathfinder] Starting path reconstruction...`);
                    }
                    const path = this.reconstructPath(cameFrom, current);
                    if (window.summaryLoggingEnabled) {
                        console.log(`[Pathfinder] Path reconstruction complete, path length: ${path ? path.length : 'null'}`);
                    }
                    return path;
                }

                closedSet.add(this.gridKey(current));

                // Check all neighbors
                const neighbors = this.getNeighbors(current);
                for (const neighbor of neighbors) {
                    const neighborKey = this.gridKey(neighbor);
                    if (closedSet.has(neighborKey)) continue;
                    const currentGScore = gScore.get(this.gridKey(current));
                    assert(typeof currentGScore === 'number', `G-score must be a number, got: ${typeof currentGScore}`);
                    const tentativeGScore = currentGScore + 1;
                    if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                        cameFrom.set(neighborKey, current);
                        gScore.set(neighborKey, tentativeGScore);
                        fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, targetGrid));
                        // Only add to open set if not already present
                        let alreadyInHeap = false;
                        for (let i = 0; i < openSet.content.length; i++) {
                            const n = openSet.content[i];
                            if (n.x === neighbor.x && n.y === neighbor.y) {
                                alreadyInHeap = true;
                                break;
                            }
                        }
                        if (!alreadyInHeap) openSet.push(neighbor);
                    }
                }
            }

            const entityInfo = entity ? `${entity.name || 'Unknown'} at (${Math.round(entity.position?.x || 0)}, ${Math.round(entity.position?.y || 0)})` : 'Unknown entity';
            if (window.summaryLoggingEnabled) {
                console.warn(`[Pathfinder] A* timeout after ${attempts} attempts for ${entityInfo}`);
            }
            return null;
        }

        // Get valid neighbors for a grid position (8-directional)
        getNeighbors(gridPos) {
            const neighbors = [];
            const directions = Pathfinder.NEIGHBOR_DIRECTIONS;
            let blockedCount = 0;
            let totalChecked = 0;
            for (const dir of directions) {
                const neighbor = {
                    x: gridPos.x + dir.x,
                    y: gridPos.y + dir.y
                };
                totalChecked++;
                if (neighbor.x >= 0 && neighbor.x < this.gridWidth &&
                    neighbor.y >= 0 && neighbor.y < this.gridHeight &&
                    !this.isGridCellBlocked(neighbor.x, neighbor.y)) {
                    neighbors.push(neighbor);
                } else {
                    blockedCount++;
                }
            }
            if (Math.random() < 0.0001 && GameConfig.logging.summaryLoggingEnabled) {
                console.log(`[Pathfinder] Neighbor check: grid(${gridPos.x},${gridPos.y}) -> ${neighbors.length} valid, ${blockedCount} blocked out of ${totalChecked} total`);
            }
            return neighbors;
        }

        // Manhattan distance heuristic
        heuristic(pos1, pos2) {
            return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
        }

        // Create unique key for grid position
        gridKey(gridPos) {
            return `${gridPos.x},${gridPos.y}`;
        }

        // Reconstruct path from cameFrom map
        reconstructPath(cameFrom, current) {
            const path = [current];
            const visited = new Set(); // Prevent infinite loops in path reconstruction
            visited.add(this.gridKey(current));

            let attempts = 0;
            const maxReconstructionAttempts = 1000; // Safety limit

            while (cameFrom.has(this.gridKey(current)) && attempts < maxReconstructionAttempts) {
                attempts++;
                current = cameFrom.get(this.gridKey(current));

                // Check for cycles
                const currentKey = this.gridKey(current);
                if (visited.has(currentKey)) {
                    console.warn(`[Pathfinder] Cycle detected in path reconstruction at ${currentKey}`);
                    break;
                }

                visited.add(currentKey);
                path.unshift(current);
            }

            if (attempts >= maxReconstructionAttempts) {
                console.warn(`[Pathfinder] Path reconstruction timeout after ${attempts} attempts`);
                return null;
            }

            // Convert grid coordinates back to world coordinates
            const worldPath = path.map(gridPos => this.gridToWorld(gridPos));

            if (window.summaryLoggingEnabled) {
                console.log(`[Pathfinder] Path reconstruction complete: ${worldPath.length} waypoints`);
                if (worldPath.length > 0) {
                    console.log(`[Pathfinder] First waypoint: grid(${path[0].x}, ${path[0].y}) -> world(${Math.round(worldPath[0].x)}, ${Math.round(worldPath[0].y)})`);
                    if (worldPath.length > 1) {
                        console.log(`[Pathfinder] Last waypoint: grid(${path[path.length - 1].x}, ${path[path.length - 1].y}) -> world(${Math.round(worldPath[worldPath.length - 1].x)}, ${Math.round(worldPath[worldPath.length - 1].y)})`);
                    }
                }
            }

            return worldPath;
        }
    }

    function getCurrentSeed() {
        const urlParams = new URLSearchParams(window.location.search);
        let seed = urlParams.get('seed');

        // Check if this is the initial load with no seed parameter
        const isInitialLoad = !seed && !window.seedInitialized;

        if (seed) {
            const parsedSeed = parseInt(seed, 10);
            if (!isNaN(parsedSeed) && parsedSeed >= GameConfig.ui.seedInputMinValue && parsedSeed <= GameConfig.ui.seedInputMaxValue) {
                window.seedInitialized = true;
                return parsedSeed;
            }
        }

        const randomSeed = Math.floor(Math.random() * (GameConfig.ui.seedInputMaxValue - GameConfig.ui.seedInputMinValue + 1)) + GameConfig.ui.seedInputMinValue;
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('seed', randomSeed.toString());
        window.history.replaceState({}, '', newUrl);
        console.log(`[Seed] Generated random seed: ${randomSeed} and updated URL`);

        // Track if this was the initial load for intro screen
        if (isInitialLoad) {
            window.showIntroScreen = true;
        }

        window.seedInitialized = true;
        return randomSeed;
    }

    function updateNeeds(playerState, delta) {
        const realSecondsPerGameDay = GameConfig.time.realSecondsPerGameDay;
        const inGameMinutesPerMs = (24 * 60) / (realSecondsPerGameDay * 1000);
        const inGameMinutes = delta * inGameMinutesPerMs;
        const t = getCurrentTime(playerState);
        const isNight = GameUtils.isNightTime(t.hour);

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
        // Check for custom death cause first (e.g., gate electrocution)
        if (playerState.deathCause) {
            return playerState.deathCause;
        }

        // Check invulnerability flag (from config or URL parameter)
        const invulFromUrl = new URLSearchParams(window.location.search).get('invul');

        if (invulFromUrl) {
            // Prevent death from needs depletion, but allow other death causes
            return null;
        }

        const n = playerState.needs;
        if (n.temperature <= 0) return 'Patient died from hypothermia.';
        if (n.water <= 0) return 'Patient died from dehydration.';
        if (n.calories <= 0) return 'Patient died from starvation.';
        for (let i = 0; i < n.vitamins.length; i++) {
            if (n.vitamins[i] <= 0) return `Patient died from vitamin ${String.fromCharCode(65 + i)} deficiency.`;
        }
        return null;
    }
    function getCurrentTime(playerState) {
        let gameStartTime = GameConfig.time.gameStartHour * GameConfig.time.secondsPerHour;
        assert(playerState.currentTime !== undefined, 'Player state missing currentTime property');
        const totalSeconds = playerState.currentTime;
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
                scene: [IntroScene, MainScene, OutroScene], // Register all scenes
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
            scene: [IntroScene, MainScene, OutroScene], // Register all scenes
            parent: 'game-area',
            fps: { target: 60, forceSetTimeOut: true }
        });
    }
})();