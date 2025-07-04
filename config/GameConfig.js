// Game Configuration - All configurable parameters for easy balancing
// 
// DESIGNER NOTES:
// - All time values are in real-world seconds unless specified otherwise
// - All distances are in pixels unless specified otherwise
// - All speeds are in pixels per second
// - All percentages are 0-100 scale unless specified otherwise
// - All needs drain rates are in in-game hours to empty (see needsDrain)
// - needsVariance is the ±% range applied to each need per day

window.GameConfig = {
    // World settings - Controls the size and layout of the game world
    world: {
        width: window.innerWidth * 10, // 10x viewport width
        height: window.innerHeight * 10, // 10x viewport height
        tileSize: 32, // Size of each "tile" for spatial calculations (used in distance checks)
        villagerCount: 8, // Total camps (7 AI villagers + 1 player camp)
        resourcesPerVillager: 50, // Initial resources spawned per villager (including player) 
        maxResourcesPerType: 500, // Global cap on resources per type (prevents overpopulation) 

        // Village and camp generation
        villageCenterOffset: { x: 50, y: 0 }, // Offset for village well from center
        campRadius: 300, // Distance from village center to camps (doubled from 150)
        campSpacing: { x: 40, y: 60 }, // Spacing between camp facilities (doubled from 20,30)
        playerStartOffset: { x: 40, y: 0 }, // Player start position relative to their camp

        // Resource generation
        resourceVillageMinDistance: 600, // Minimum distance from village center for resources
        wellMinDistance: 3000, // Minimum distance between wells
        wellCount: 30, // Number of additional wells beyond village well
        wellMaxAttempts: 50, // Maximum attempts to place a well

        // Perlin noise settings
        noiseScale: 5, // Scale factor for Perlin noise in resource placement - reduced for better clustering
        noiseBias: 0.7 // Bias factor for noise-based positioning - increased for better clustering
    },

    // Time settings - Controls how fast game time passes relative to real time
    time: {
        realSecondsPerGameDay: 600, // 1 game day = 10 minutes real time (600 seconds)
        // Formula: gameTime = realTime * (86400 / realSecondsPerGameDay)
        // Example: 1 real second = 144 game seconds (86400/600)

        dayStartHour: 8, // Hour when villagers wake up and start foraging
        nightStartHour: 18, // Hour when villagers return to camp
        sleepAcceleration: 10, // Seconds to reach 8:00 when sleeping (time acceleration multiplier)

        // Time constants
        secondsPerDay: 86400, // Seconds in a game day (24 * 60 * 60)
        secondsPerHour: 3600, // Seconds in a game hour (60 * 60)
        secondsPerMinute: 60, // Seconds in a game minute

        // Game start time
        gameStartHour: 8, // Hour when the game starts (08:00)
        gameStartTime: 8 * 3600 // Seconds from midnight when game starts
    },

    // Needs system constants
    needs: {
        maxValue: 100, // Maximum value for any need
        minValue: 0, // Minimum value for any need
        fullValue: 100, // Starting value for all needs

        // Decay calculation constants
        decayCalculationFactor: 100, // Used in: 100 / (hoursToEmpty * 60)
        minutesPerHour: 60, // Minutes in an hour
        hoursPerDay: 24, // Hours in a day

        // UI thresholds
        criticalThreshold: 20, // Value below which needs are critical (red)
        warningThreshold: 50, // Value below which needs show warning (orange)

        // Vitamin count
        vitaminCount: 5 // Number of vitamins (A, B, C, D, E)
    },

    // Needs drain settings (in in-game hours to empty)
    needsDrain: {
        temperature: 8,   // 8 in-game hours to empty (only drains at night when not near fire)
        water: 24,        // 24 in-game hours to empty
        calories: 36,     // 36 in-game hours to empty
        vitamins: 48      // 48 in-game hours to empty
        // Formula: decayRate = 100 / (hoursToEmpty * 60) [per in-game minute]
    },

    // Needs drain variance (applied per day, per character, per need)
    needsVariance: 0.2, // 20% (0.2) ± variance, configurable

    // Player settings - Controls player character behavior and needs
    player: {
        moveSpeed: 100, // Player movement speed in pixels per second
        // Formula: newPosition = oldPosition + (moveSpeed * deltaTime / 1000)
        inventorySize: 6, // Number of inventory slots (Minecraft-style hotbar)

        needsDecayRate: {
            temperature: 5, // Temperature loss per minute of real time
            // Formula: temperature -= decayRate * (deltaTime / 60000)
            // Higher values = faster temperature loss

            water: 10, // Water loss per minute of real time
            // Formula: water -= decayRate * (deltaTime / 60000)
            // Higher values = faster dehydration

            calories: 15, // Calorie loss per minute of real time
            // Formula: calories -= decayRate * (deltaTime / 60000)
            // Higher values = faster hunger

            vitamins: 2 // Vitamin loss per minute of real time (applies to all vitamins A-E)
            // Formula: vitamins[i] -= decayRate * (deltaTime / 60000)
            // Higher values = faster vitamin deficiency
        },

        // Movement constants
        diagonalMovementFactor: 0.707, // 1/√2 for normalized diagonal movement
        millisecondsPerSecond: 1000, // Conversion factor for deltaTime

        // Interaction constants
        interactionThreshold: 48, // Distance threshold for interactions (pixels) - increased by 50%

        // Rendering
        fontSize: 32, // Player emoji font size
        zIndex: 100 // Player rendering z-index
    },

    // Villager settings - Controls AI villager behavior and capabilities
    villager: {
        moveSpeed: 100, // Villager movement speed in pixels per second (same as player)
        // Formula: newPosition = oldPosition + (moveSpeed * deltaTime / 1000)
        memoryCapacity: 10, // Maximum number of resource locations a villager can remember
        // Used in: villager.memory.knownFoodLocations.length <= memoryCapacity
        explorationRadius: 400, // How far villagers explore when they don't know of nearby food (doubled from 200)
        // Formula: if (distanceToNearestKnownFood > explorationRadius) { exploreNewArea() }
        // Higher values = villagers explore further from their camp
        foragingEfficiency: 0.8, // Success rate when villagers try to collect resources
        // Formula: if (Math.random() < foragingEfficiency) { collectResource() }
        // Lower values = villagers fail to collect resources more often

        // Behavior timing
        maxForagingAttempts: 10, // Maximum attempts before giving up on foraging
        goalPersistenceTime: 10000, // 10 seconds to stick with current goal
        eatingCooldown: 5000, // 5 second cooldown after eating when calories > 80
        criticalLogCooldown: 10000, // 10 seconds between critical need logs

        // Daily task ranges
        dailyTasks: {
            woodTrips: { min: 1, max: 2 }, // 1-2 wood trips per day
            foodTrips: { min: 3, max: 4 }, // 3-4 food trips per day
            waterTrips: { min: 1, max: 2 } // 1-2 water trips per day
        },

        // Need thresholds
        waterTripThreshold: 70, // Water level below which to prioritize water trips
        eatingCalorieThreshold: 80, // Calorie level above which eating cooldown applies
        criticalNeedThreshold: 2 // Need level below which is considered critical
    },

    // Animal behavior settings
    animals: {
        fleeSpeedMultiplier: 0.8, // Animals flee at 80% of player speed
        wanderSpeedRange: { min: 0.3, max: 0.5 }, // 30-50% of player speed
        directionChangeInterval: { min: 2000, max: 5000 }, // 2-5 seconds between direction changes
        fixedDeltaTime: 16 // Fixed delta time for consistent animal movement
    },

    // Resource settings - Controls how resources spawn and spread
    resources: {
        propagationRadius: 80, // Distance within which resources can spawn new ones - reduced for tighter clustering
        propagationChance: 0.15, // Probability of resource spawning a new one overnight - increased for faster growth
        maxDensity: 8, // Maximum resources per area (prevents overcrowding) - increased for denser clusters

        // Resource type limits
        maxCounts: {
            tree: 50, // Trees cap at 50
            default: 10 // Other resources cap at 10
        },

        // === DESIGNER BALANCING SECTION ===
        // All food/resource types with complete data (easier to maintain)
        foodData: {
            // Plants
            'blackberry': { calories: 25, vitamins: [0, 0, 0, 20, 0], water: 5, emoji: '🫐' },
            'mushroom': { calories: 20, vitamins: [0, 0, 20, 0, 0], water: 0, emoji: '🍄' },
            'herb': { calories: 15, vitamins: [20, 0, 0, 0, 0], water: 0, emoji: '🌿' },
            'blueberry': { calories: 25, vitamins: [0, 0, 0, 20, 0], water: 5, emoji: '🫐' },
            'raspberry': { calories: 25, vitamins: [0, 0, 0, 20, 0], water: 5, emoji: '🍓' },
            'elderberry': { calories: 20, vitamins: [0, 0, 0, 20, 10], water: 0, emoji: '🫐' },
            'wild_garlic': { calories: 20, vitamins: [10, 20, 0, 0, 0], water: 0, emoji: '🧄' },
            'dandelion': { calories: 15, vitamins: [0, 20, 0, 0, 10], water: 0, emoji: '🌼' },
            'nettle': { calories: 20, vitamins: [20, 0, 10, 0, 0], water: 0, emoji: '🌿' },
            'sorrel': { calories: 18, vitamins: [0, 10, 20, 0, 0], water: 0, emoji: '🌿' },
            'watercress': { calories: 15, vitamins: [0, 0, 20, 10, 0], water: 5, emoji: '🌿' },
            'wild_onion': { calories: 20, vitamins: [10, 10, 0, 10, 0], water: 0, emoji: '🧅' },
            'chickweed': { calories: 15, vitamins: [0, 20, 0, 10, 0], water: 0, emoji: '🌱' },
            'plantain': { calories: 20, vitamins: [20, 0, 0, 10, 0], water: 0, emoji: '🌿' },
            'yarrow': { calories: 15, vitamins: [0, 0, 10, 20, 0], water: 5, emoji: '🌸' },
            // Animals
            'rabbit': { calories: 35, vitamins: [0, 20, 0, 0, 0], water: 0, emoji: '🐰' },
            'deer': { calories: 40, vitamins: [0, 20, 0, 0, 20], water: 0, emoji: '🦌' },
            'squirrel': { calories: 30, vitamins: [10, 10, 0, 0, 0], water: 0, emoji: '🐿️' },
            'pheasant': { calories: 32, vitamins: [0, 20, 10, 0, 0], water: 0, emoji: '🦃' },
            'duck': { calories: 30, vitamins: [0, 10, 20, 0, 0], water: 0, emoji: '🦆' },
            'goose': { calories: 32, vitamins: [0, 10, 10, 10, 0], water: 0, emoji: '🦢' },
            'hare': { calories: 35, vitamins: [0, 20, 0, 10, 0], water: 0, emoji: '🐰' },
            'fox': { calories: 28, vitamins: [10, 0, 20, 0, 0], water: 0, emoji: '🦊' },
            'boar': { calories: 38, vitamins: [0, 20, 0, 20, 0], water: 0, emoji: '🐗' },
            'elk': { calories: 40, vitamins: [0, 20, 0, 0, 20], water: 0, emoji: '🦌' },
            'marten': { calories: 25, vitamins: [10, 0, 10, 10, 0], water: 0, emoji: '🦦' },
            'grouse': { calories: 28, vitamins: [0, 10, 20, 0, 0], water: 0, emoji: '🦃' },
            'woodcock': { calories: 25, vitamins: [0, 10, 10, 10, 0], water: 0, emoji: '🦅' },
            'beaver': { calories: 30, vitamins: [10, 10, 0, 10, 0], water: 0, emoji: '🦫' },
            'otter': { calories: 28, vitamins: [10, 0, 10, 10, 0], water: 0, emoji: '🦦' },
            // Resources (non-food)
            'tree': { calories: 0, vitamins: [0, 0, 0, 0, 0], water: 0, emoji: '🌲' }
        }
    },

    // Entity types - Centralized entity type definitions
    entityTypes: {
        // Infrastructure
        camp: 'camp',
        fireplace: 'fireplace',
        sleeping_bag: 'sleeping_bag',
        storage_box: 'storage_box',
        well: 'well',

        // Resources
        tree: 'tree',

        // Tasks
        wood: 'wood',
        food: 'food',
        water: 'water'
    },

    // Villager states - Centralized state definitions
    villagerStates: {
        SLEEPING: 'SLEEPING',
        FORAGING: 'FORAGING',
        RETURNING: 'RETURNING',
        EATING: 'EATING'
    },

    // Emoji definitions - Centralized emoji assignments
    emojis: {
        // Health and status
        health: '😊',

        // Actions
        foraging: '🏃',
        returning: '🏠',
        eating: '🍽️',
        sleeping: '😴',

        // Tasks
        wood: '🪵',
        food: '🍎',
        water: '💧',

        // Entities
        fireplace: '🔥',
        tree: '🌲'
    },

    // UI settings - Controls the appearance and layout of user interface elements
    ui: {
        barHeight: 20, // Height of need bars in pixels
        barWidth: 150, // Width of need bars in pixels
        inventorySlotSize: 50, // Size of inventory slots in pixels (width and height)

        // Seed input
        seedInputWidth: 60, // Width of seed input field in pixels
        seedInputMaxValue: 999, // Maximum seed value
        seedInputMinValue: 1, // Minimum seed value

        // Spacing and padding
        needBarSpacing: 5, // Spacing between need bars
        uiMargin: 20, // Margin from screen edges for all UI elements,

        // Overlay settings
        overlayZIndex: 1000, // Z-index for UI overlays
        overlayColor: 0x222222, // Background color for overlays
        overlayAlpha: 0.95, // Transparency for overlays
        overlayDimensions: { width: 400, height: 200 }, // Default overlay size

        // Message display
        tempMessageDuration: 2000, // Duration for temporary messages in milliseconds

        // Colors - Centralized color definitions
        colors: {
            // Background colors
            background: '#2d3748', // Main background color
            backgroundDark: '#1a1f2e', // Night background color
            overlay: 0x222222, // Overlay background
            slotBackground: 0x333333, // Inventory slot background
            barBackground: 0x333333, // Need bar background
            debugBackground: '#444', // Debug panel background
            fpsBackground: '#444', // FPS counter background

            // Border and stroke colors
            border: 0x666666, // Default border color
            stroke: 0x666666, // Default stroke color
            slotBorder: 0x666666, // Inventory slot border

            // Text colors
            textPrimary: '#fff', // Primary text color
            textSecondary: '#ccc', // Secondary text color
            textMuted: '#888888', // Muted text color
            textDark: '#222', // Dark text color

            // Button colors
            buttonPrimary: '#228B22', // Primary button (green)
            buttonSecondary: '#666', // Secondary button (gray)
            buttonSuccess: '#228B22', // Success state (green)
            buttonWarning: '#ff6600', // Warning state (orange)

            // Status colors
            healthGood: '#228B22', // Good health (green)
            healthWarning: '#ff6600', // Warning health (orange)
            healthCritical: '#ff0000', // Critical health (red)

            // Special colors
            warmth: 0xff6600, // Orange color for warmth
            groundTexture: {
                darkGreen: 0x4a5d23,
                mediumGreen: 0x5a6d33,
                lightGreen: 0x6a7d43,
                lightGrey: 0x6b6b6b,
                mediumGrey: 0x5a5a5a
            }
        },

        // Font sizes - Centralized font size definitions
        fontSizes: {
            tiny: '8px', // Very small text
            small: '10px', // Small text
            medium: '12px', // Medium text
            large: '14px', // Large text
            xlarge: '16px', // Extra large text
            xxlarge: '18px', // Double extra large text
            huge: '20px', // Huge text
            title: '24px', // Title text
            subtitle: '28px', // Subtitle text
            massive: '32px', // Massive text
            entity: '22px', // Entity emoji size
            entityLarge: '48px', // Large entity emoji size
            player: '32px', // Player emoji size
            inventory: '24px', // Inventory emoji size
            sleeping: '24px', // Sleeping emoji size
            debug: '13px', // Debug text size
            fps: '13px', // FPS counter size
            time: '18px', // Time display size
            needLabel: '16px', // Need bar label size
            needValue: '12px', // Need bar value size
            button: '16px', // Button text size
            overlayTitle: '24px', // Overlay title size
            overlayMessage: '18px', // Overlay message size
            storageTitle: '16px', // Storage title size
            storageInstructions: '12px' // Storage instructions size
        },

        // Dimensions - Centralized dimension definitions
        dimensions: {
            // Overlay dimensions
            overlayWidth: 400,
            overlayHeight: 200,
            confirmationWidth: 400,
            confirmationHeight: 200,
            storageWidth: 300,
            storageHeight: 450,
            communalStorageHeight: 450,
            personalStorageHeight: 300,

            // Button dimensions
            buttonPadding: {
                small: { left: 6, right: 6, top: 2, bottom: 2 },
                medium: { left: 8, right: 8, top: 4, bottom: 4 },
                large: { left: 12, right: 12, top: 6, bottom: 6 },
                xlarge: { left: 16, right: 16, top: 8, bottom: 8 }
            },

            // Slot dimensions
            slotSize: 50,
            slotSpacing: 56,
            slotGridColumns: 5,
            slotGridRows: 2,

            // Text dimensions
            textPadding: {
                small: { left: 2, right: 2, top: 1, bottom: 1 },
                medium: { left: 8, right: 8, top: 4, bottom: 4 },
                large: { left: 8, right: 8, top: 8, bottom: 8 }
            },

            // UI element dimensions
            seedInputHeight: 20,
            fpsCounterOffset: 150,
            debugButtonOffset: 120,
            logSpamButtonOffset: 90,
            tempMessageOffset: 40,
            sleepingOffset: 60,
            storageSlotOffset: 80,
            storageInstructionsOffset: 60
        },

        // Padding - Centralized padding definitions
        padding: {
            tiny: 1,
            small: 2,
            medium: 4,
            large: 6,
            xlarge: 8,
            xxlarge: 12,
            huge: 16
        },

        // Z-indices - Centralized z-index definitions
        zIndex: {
            ground: 0,
            entity: 100,
            player: 200,
            ui: 1000,
            overlay: 1000,
            overlayContent: 1001,
            debug: 1002
        },

        // Alpha values - Centralized transparency definitions
        alpha: {
            groundTexture: 0.3,
            debugOverlay: 0.1,
            debugCircle: 0.05,
            overlay: 0.95
        }
    },

    // Logging system settings
    logging: {
        logTransmissionInterval: 2000, // Send logs every 2 seconds
        domSnapshotInterval: 5000, // Capture DOM every 5 seconds
        domElementLimit: 1000, // Maximum DOM elements to capture
        serverPort: 3000, // Local server port for logging
        serverUrl: 'http://localhost:3000' // Server URL for logging
    },

    // Game loop settings
    gameLoop: {
        targetFPS: 60, // Target frames per second
        maxDeltaTime: 200, // Maximum delta time per frame (milliseconds)
        timestep: 1000 / 60 // Fixed timestep for consistent physics
    },

    // Storage settings
    storage: {
        communalCapacity: 20, // Capacity of communal storage box
        personalCapacity: 4, // Capacity of personal storage boxes
        localStorageKey: 'alpine-seed' // LocalStorage key for seed persistence
    },

    // Well settings
    wells: {
        initialWaterLevel: 10, // Starting water level for wells
        dailyRefill: 4, // Water refilled per day
        drinkingAmount: 50 // Amount of water restored when drinking from well
    },

    // Fire settings
    fires: {
        maxWood: 2, // Maximum wood that can be stored in a fire
        dailyWoodConsumption: 1 // Wood consumed per day when burning
    },

    // Technical constants
    technical: {
        // Perlin noise constants
        perlinPermutationSize: 256,
        perlinMask: 255,
        perlinHashConstant: 0x45d9f3b,

        // Math constants
        pi: Math.PI,
        sqrt2: Math.sqrt(2),

        // Time constants
        millisecondsPerSecond: 1000,
        secondsPerMinute: 60,
        minutesPerHour: 60,
        hoursPerDay: 24,

        // Distance constants
        distances: {
            wellDetection: 200, // Distance to detect nearby wells
            fireDetection: 100, // Distance to detect nearby fires
            campRadius: 50, // Distance considered "at camp"
            campMinDistance: 200, // Minimum distance from camps for resources
            explorationTarget: 100, // Distance for exploration targets
            explorationRange: { min: 150, max: 250 }, // Range for exploration distances
            animalFleeDistance: 100, // Distance at which animals flee
            animalWanderRange: { min: 50, max: 150 }, // Range for animal wandering
            resourcePlacementAttempts: 100, // Max attempts to place resources
            groundTextureScale: 200, // Scale for ground texture noise
            tileSize: 64, // Size of ground texture tiles
            noiseScale: 200 // Scale for noise calculations
        },

        // Message durations
        messageDurations: {
            short: 1200, // Short message duration
            medium: 1500, // Medium message duration
            long: 2000 // Long message duration
        },

        // Font sizes for entities
        entityFontSizes: {
            child: 16, // Child entity size
            adult: 22, // Adult entity size
            camp: 28, // Camp size
            fireplace: 24, // Fireplace size
            sleepingBag: 24, // Sleeping bag size
            storageBox: 24, // Storage box size
            well: 22, // Well size
            resource: 22, // Resource size
            tree: 22, // Tree size
            large: 48 // Large size (2x normal)
        },

        // Animation and movement constants
        animation: {
            cameraFollowLerp: 0.1, // Camera follow interpolation
            diagonalMovementFactor: 0.707, // 1/√2 for normalized diagonal movement
            fixedDeltaTime: 16, // Fixed delta time for consistent movement
            maxDeltaTime: 200 // Maximum delta time per frame
        },

        // Random and probability constants
        random: {
            baseChance: 0.5, // 50% base chance
            clusterChance: 0.8, // 80% chance for cluster consistency
            spamChanceLow: 0.05, // 5% chance for spam logging
            spamChanceHigh: 0.1, // 10% chance for spam logging
            wakeUpTimeVariance: 1.0, // ±1 hour wake up time variance
            directionChangeInterval: { min: 2000, max: 5000 }, // 2-5 seconds
            wanderSpeedRange: { min: 0.3, max: 0.5 }, // 30-50% speed
            fleeSpeedMultiplier: 0.8 // 80% speed for fleeing
        },

        // Time constants
        time: {
            hoursPerDay: 24, // Hours in a day
            minutesPerHour: 60, // Minutes in an hour
            secondsPerMinute: 60, // Seconds in a minute
            millisecondsPerSecond: 1000, // Milliseconds in a second
            gameStartHour: 8, // Hour when game starts
            wakeUpHour: 8, // Hour when villagers wake up
            returnHour: 18, // Hour when villagers return
            nightStartHour: 18, // Hour when night starts
            dayStartHour: 8, // Hour when day starts
            sleepAcceleration: 10, // Time acceleration when sleeping
            dayNightTransition: { evening: 18, morning: 8 }, // Day/night transition hours
            dayNightDuration: { evening: 3, morning: 3 } // Duration of transitions
        },

        // UI constants
        ui: {
            iconWidth: 25, // Width reserved for icons
            iconSpacing: 5, // Spacing after icons
            barStartOffset: 5, // Offset for bars after icons
            valueOffset: 10, // Offset for value text after bars
            inventorySlotSpacing: 56, // Spacing between inventory slots
            seedBoxWidth: 200, // Width of seed input box
            seedInputOffset: 30, // Offset for seed input field
            seedButtonOffset: 85, // Offset for seed buttons
            seedButtonSpacing: 15, // Spacing for seed buttons
            buttonSpacing: 60, // Spacing between buttons
            titleOffset: 60, // Offset for titles
            messageOffset: 20, // Offset for messages
            buttonOffset: 30, // Offset for buttons
            closeButtonOffset: 20, // Offset for close buttons
            instructionsOffset: 60, // Offset for instructions
            storageSlotOffset: 80, // Offset for storage slots
            storageGridSpacing: 60, // Spacing for storage grid
            storageGridColumns: 5, // Number of columns in storage grid
            storageGridRows: 2, // Number of rows in storage grid
            storageSlotSize: 50, // Size of storage slots
            storageBackgroundHeight: { communal: 450, personal: 300 }, // Storage background heights
            storageBackgroundWidth: 300, // Storage background width
            storageTitleOffset: 150, // Offset for storage titles
            storageInstructionsOffset: 60, // Offset for storage instructions
            storageCloseButtonOffset: 20, // Offset for storage close button
            storageSlotGridOffset: { x: 150, y: 80 }, // Offset for storage slot grid
            storageSlotGridSpacing: { x: 60, y: 60 } // Spacing for storage slot grid
        },

        // Color constants for different states
        colors: {
            // Health states
            healthCritical: 50, // Critical health threshold
            healthWarning: 80, // Warning health threshold
            healthGood: 80, // Good health threshold

            // Need thresholds
            needCritical: 20, // Critical need threshold
            needWarning: 50, // Warning need threshold
            needGood: 80, // Good need threshold

            // Temperature thresholds
            temperatureCritical: 50, // Critical temperature threshold
            temperatureWarning: 80, // Warning temperature threshold

            // Water thresholds
            waterCritical: 50, // Critical water threshold
            waterWarning: 80, // Warning water threshold

            // Calorie thresholds
            calorieCritical: 50, // Critical calorie threshold
            calorieWarning: 80, // Warning calorie threshold

            // Vitamin thresholds
            vitaminCritical: 50, // Critical vitamin threshold
            vitaminWarning: 80 // Warning vitamin threshold
        }
    },

    // Villager names for random generation
    villagerNames: [
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
    ],

    // Visual temperature display settings (purely cosmetic)
    visualTemperature: {
        states: ['freezing', 'cold', 'moderate', 'warm', 'hot'],
        labels: {
            freezing: 'Freezing',
            cold: 'Cold',
            moderate: 'Moderate',
            warm: 'Warm',
            hot: 'Hot'
        },
        // Time ranges (24h format)
        day: { start: 9, end: 17 }, // 09:00 to 17:59 is day
        dusk: { start: 18, end: 19 }, // 18:00 to 19:59 is dusk
        dawn: { start: 7, end: 8 },  // 07:00 to 08:59 is dawn
        night: { start: 20, end: 6 }, // 20:00 to 06:59 is night (wraps around)
        // Chance for day temp to change per hour (0.25 = 25%)
        dayChangeChance: 0.25
    }
};

// Assert world is much larger than viewport
console.assert(window.GameConfig.world.width >= window.innerWidth * 10, '[GameConfig] World width should be at least 10x viewport width');
console.assert(window.GameConfig.world.height >= window.innerHeight * 10, '[GameConfig] World height should be at least 10x viewport height');

console.log('[GameConfig.js] Loaded at', new Date().toISOString(), 'cache-bust:', Math.random()); 