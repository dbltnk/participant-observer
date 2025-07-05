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
        villageCenterOffset: { x: 50, y: 25 }, // Offset for village storage from center
        villageWellOffset: { x: 25, y: 50 }, // Offset for village well from center
        campRadius: 400, // Distance from village center to camps (doubled from 150)
        campSpacing: { x: 40, y: 60 }, // Spacing between camp facilities (doubled from 20,30)
        playerStartOffset: { x: 40, y: 0 }, // Player start position relative to their camp,

        // Villager spawning
        villagerSpawnRadius: 5000, // Maximum distance from village center for villager spawning

        // Resource generation
        resourceVillageMinDistance: 700, // Minimum distance from village center for resources
        wellMinDistance: 3000, // Minimum distance between wells
        wellCount: 30, // Number of additional wells beyond village well
        wellMaxAttempts: 50, // Maximum attempts to place a well

        // Perlin noise settings
        noiseScale: 5, // Scale factor for Perlin noise in resource placement - reduced for better clustering
        noiseBias: 0.7 // Bias factor for noise-based positioning - increased for better clustering
    },

    // Time settings - Controls how fast game time passes relative to real time
    time: {
        // Time conversion settings
        realSecondsPerGameDay: 600, // 1 game day = 10 minutes real time (600 seconds)
        // Formula: gameTime = realTime * (86400 / realSecondsPerGameDay)
        // Example: 1 real second = 144 game seconds (86400/600)

        // Time constants (standard time units)
        secondsPerDay: 86400, // Seconds in a game day (24 * 60 * 60)
        secondsPerHour: 3600, // Seconds in a game hour (60 * 60)
        secondsPerMinute: 60, // Seconds in a game minute
        minutesPerHour: 60, // Minutes in an hour
        millisecondsPerSecond: 1000, // Milliseconds in a second

        // Game start time
        gameStartHour: 12, // Hour when the game starts (12:00)
        nightStartHour: 20, // Hour when night starts (20:00)
    },

    // Needs system constants
    needs: {
        maxValue: 100, // Maximum value for any need
        minValue: 0, // Minimum value for any need
        fullValue: 100, // Starting value for all needs

        // Decay calculation constants
        decayCalculationFactor: 100, // Used in: 100 / (hoursToEmpty * 60)

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
        moveSpeed: 125, // Player movement speed in pixels per second
        // Formula: newPosition = oldPosition + (moveSpeed * deltaTime / 1000)
        inventorySize: 6, // Number of inventory slots (Minecraft-style hotbar)

        // Movement constants
        diagonalMovementFactor: 0.707, // 1/√2 for normalized diagonal movement

        // Interaction constants
        interactionThreshold: 48, // Distance threshold for interactions (pixels) - increased by 50%
        fireHeatingRange: 144, // Distance threshold for fire heating effects (pixels) - 3x interaction threshold

        // Rendering
        fontSize: 32, // Player emoji font size

        // Random starting stats ranges
        startingStats: {
            temperature: { min: 80, max: 100 }, // Temperature range at game start
            water: { min: 60, max: 90 }, // Water range at game start
            calories: { min: 60, max: 90 }, // Calories range at game start
            vitamins: { min: 50, max: 80 } // Vitamin range at game start (applies to all vitamins A-E)
        }
    },

    // Villager settings - Controls AI villager behavior and capabilities
    villager: {
        moveSpeed: 100, // Villager movement speed in pixels per second (same as player)
        // Formula: newPosition = oldPosition + (moveSpeed * deltaTime / 1000)

        // State machine settings
        emergencyThresholds: {
            water: 20,           // Water <20% triggers emergency drink
            calories: 20,        // Calories <20% triggers emergency eat
            temperature: 20      // Temperature <20% triggers emergency warm up
        },

        regularThresholds: {
            water: 50,           // Water <50% triggers regular drink
            temperature: 70,     // Temperature <70% triggers regular warm up
            calories: 60         // Calories <60% triggers regular eat
        },

        fireThresholds: {
            emergency: 2,        // <3 logs triggers emergency refill
            regular: 8          // <10 logs triggers regular refill
        },

        sleepSchedule: {
            startHour: 22,       // Start sleeping at 22:00
            endHour: 7,          // Wake up at 07:00
            variance: 1          // ±1 hour daily variation
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
    },

    // Animal behavior settings
    animals: {
        moveSpeed: 80, // Fixed animal movement speed in pixels per second
        directionChangeInterval: { min: 2000, max: 5000 }, // 2-5 seconds between direction changes
    },

    // Resource settings - Controls how resources spawn and spread
    resources: {
        propagationRadius: 80, // Distance within which resources can spawn new ones - reduced for tighter clustering

        // Resource type limits
        maxCounts: {
            tree: 200, // Trees cap at 200
            default: 10 // Other resources cap at 10
        },


        // === DESIGNER BALANCING SECTION ===
        // All food/resource types with complete data (easier to maintain)
        foodData: {
            // Plants
            'blackberry': { calories: 25, vitamins: [20, 0, 0, 0, 0], water: 10, emoji: '🫐' },
            'mushroom': { calories: 20, vitamins: [0, 20, 20, 0, 0], water: 5, emoji: '🍄' },
            'herb': { calories: 15, vitamins: [0, 0, 0, 20, 0], water: 5, emoji: '🌿' },
            'blueberry': { calories: 25, vitamins: [20, 20, 0, 0, 0], water: 10, emoji: '🫐' },
            'raspberry': { calories: 25, vitamins: [0, 0, 20, 0, 0], water: 10, emoji: '🍓' },
            'elderberry': { calories: 20, vitamins: [20, 0, 20, 0, 0], water: 10, emoji: '🫐' },
            'wild_garlic': { calories: 20, vitamins: [0, 20, 0, 0, 0], water: 5, emoji: '🧄' },
            'dandelion': { calories: 15, vitamins: [20, 0, 0, 0, 0], water: 5, emoji: '🌼' },
            'nettle': { calories: 20, vitamins: [0, 0, 20, 0, 0], water: 5, emoji: '🌿' },
            'sorrel': { calories: 18, vitamins: [20, 20, 0, 0, 0], water: 5, emoji: '🌿' },
            'watercress': { calories: 15, vitamins: [0, 0, 0, 20, 0], water: 5, emoji: '🌿' },
            'wild_onion': { calories: 20, vitamins: [20, 0, 20, 0, 0], water: 5, emoji: '🧅' },
            'chickweed': { calories: 15, vitamins: [0, 20, 0, 0, 0], water: 5, emoji: '🌱' },
            'plantain': { calories: 20, vitamins: [0, 0, 20, 0, 0], water: 5, emoji: '🌿' },
            'yarrow': { calories: 15, vitamins: [20, 0, 0, 0, 0], water: 5, emoji: '🌸' },
            // Animals
            'rabbit': { calories: 35, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🐰' },
            'deer': { calories: 40, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🦌' },
            'squirrel': { calories: 30, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🐿️' },
            'pheasant': { calories: 32, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🦃' },
            'duck': { calories: 30, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🦆' },
            'goose': { calories: 32, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🦢' },
            'hare': { calories: 35, vitamins: [0, 0, 20, 0, 20], water: 0, emoji: '🐰' },
            'fox': { calories: 28, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🦊' },
            'boar': { calories: 38, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🐗' },
            'elk': { calories: 40, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🦌' },
            'marten': { calories: 25, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🦦' },
            'grouse': { calories: 28, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🦃' },
            'woodcock': { calories: 25, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🦅' },
            'beaver': { calories: 30, vitamins: [0, 0, 20, 20, 0], water: 0, emoji: '🦫' },
            'otter': { calories: 28, vitamins: [0, 0, 0, 20, 20], water: 0, emoji: '🦦' },
            // Resources (non-food)
            'tree': { calories: 0, vitamins: [0, 0, 0, 0, 0], water: 0, emoji: '🌲' }
        },
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
        needBarSpacing: 5, // Spacing between need bars
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
            textDark: '#222', // Dark text color

            // Button colors
            buttonPrimary: '#228B22', // Primary button (green)
            buttonSecondary: '#666', // Secondary button (gray)
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
            seedInputWidth: 60,
            seedBoxWidth: 200,
            seedInputOffset: 30,
            seedButtonOffset: 85,
            fpsCounterOffset: 150,
            debugButtonOffset: 120,
            logSpamButtonOffset: 90,
            tempMessageOffset: 40,
            sleepingOffset: 60,
            storageSlotOffset: 80,
            storageInstructionsOffset: 60,
            titleOffset: 60,
            messageOffset: 20,
            buttonOffset: 30,
            buttonSpacing: 60,
            valueOffset: 10,
            slotSpacing: 56,
            slotSize: 50,
            confirmationWidth: 400,
            confirmationHeight: 200
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
    },

    // Logging system settings
    logging: {
        logTransmissionInterval: 2000, // Send logs every 2 seconds
        domSnapshotInterval: 5000, // Capture DOM every 5 seconds
        domElementLimit: 1000, // Maximum DOM elements to capture
        serverPort: 3000, // Local server port for logging
        serverUrl: 'http://localhost:3000', // Server URL for logging
        loggingChance: 0.01 // 1% chance per frame
    },

    // Storage settings
    storage: {
        communalCapacity: 20, // Capacity of communal storage box
        personalCapacity: 8, // Capacity of personal storage boxes
        localStorageKey: 'alpine-seed', // LocalStorage key for seed persistence

        // Random initial items configuration
        initialItems: {
            wood: { min: 0, max: 2 }, // Wood items per storage box at game start
            food: { min: 0, max: 3 }  // Food items per storage box at game start
        }
    },

    // Well settings
    wells: {
        initialWaterLevel: 10, // Starting water level for wells
        hourlyRefill: 0.5, // Water refilled per hour (1 unit every 2 hours)
        drinkingAmount: 50 // Amount of water restored when drinking from well
    },

    // Fire settings
    fires: {
        maxWood: 10, // Maximum wood that can be stored in a fire
        initialWoodRange: { min: 7, max: 9 }, // Random initial wood range
        hourlyConsumption: 0.167 // Wood consumed per hour (1 unit every 6 hours)
    },

    // Technical constants
    technical: {
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
            storageBackgroundHeight: { ss: 450, personal: 300 }, // Storage background heights
            storageBackgroundWidth: 300, // Storage background width
            storageTitleOffset: 150, // Offset for storage titles
            storageInstructionsOffset: 60, // Offset for storage instructions
            storageCloseButtonOffset: 20, // Offset for storage close button
            storageSlotGridOffset: { x: 150, y: 80 }, // Offset for storage slot grid
            storageSlotGridSpacing: { x: 60, y: 60 } // Spacing for storage slot grid
        },
    },

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

console.log('[GameConfig.js] Loaded at', new Date().toISOString(), 'cache-bust:', Math.random()); 