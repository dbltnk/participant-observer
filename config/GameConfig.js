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
        width: 20000,
        height: 20000,
        tileSize: 1500, // Size of each "tile" for spatial calculations (used in distance checks)
        villagerCount: 8, // Total camps (7 AI villagers + 1 player camp)

        // Village and camp generation
        villageCenterOffset: { x: 50, y: 25 }, // Offset for village storage from center
        villageWellOffset: { x: 25, y: 50 }, // Offset for village well from center
        campSpacing: { x: 40, y: 60 }, // Spacing between camp facilities (doubled from 20,30)

        // Even camp placement settings
        campPlacement: {
            baseRadius: 450, // Increased base distance from village center to camps
            minDistanceBetweenCamps: 350, // Increased minimum distance between camps in pixels
            angleVariationRange: 0.3, // Reduced ±radians for angle variation
            radiusVariationRange: 50, // Reduced maximum radius variation in pixels
            additionalRandomAngle: 0.2, // Reduced ±radians for additional random angle variation
            additionalRandomRadius: 25, // Reduced ±pixels for additional random radius variation
            maxPlacementAttempts: 10 // Maximum attempts to place a camp without overlap
        },

        // Villager spawning
        villagerSpawnRadius: 5000, // Maximum distance from village center for villager spawning

        // Resource generation
        resourceVillageMinDistance: 512, // Minimum distance from village center for resources
        wellMinDistance: 2000, // Minimum distance between wells
        wellCount: 30, // Number of additional wells beyond village well
        wellMaxAttempts: 500, // Maximum attempts to place a well
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
        vitamins: 96      // 96 in-game hours to empty
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
        interactionThreshold: 64, // Distance threshold for interactions (pixels) - increased by 50%
        fireHeatingRange: 144, // Distance threshold for fire heating effects (pixels) - 3x interaction threshold

        // Rendering
        fontSize: 48, // Player emoji font size

        // Random starting stats ranges
        startingStats: {
            temperature: { min: 80, max: 100 }, // Temperature range at game start
            water: { min: 60, max: 90 }, // Water range at game start
            calories: { min: 60, max: 90 }, // Calories range at game start
            vitamins: { min: 50, max: 80 } // Vitamin range at game start (applies to all vitamins A-E)
        },

        // Well interaction settings
        wellWaterRestore: 50 // Amount of water restored when drinking from well
    },

    // Villager settings - Controls AI villager behavior and capabilities
    villager: {
        moveSpeed: 100, // Villager movement speed in pixels per second (same as player)
        // Formula: newPosition = oldPosition + (moveSpeed * deltaTime / 1000)

        // Golden rule foraging settings
        foraging: {
            minResourcesPerGridCell: 3, // Minimum resources required in grid cell before collection
            skipPoisonousFood: true, // Skip poisonous food variants
            skipFasterAnimals: true, // Skip animals faster than villager
        },

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

        // Hierarchical state machine settings
        collection: {
            maxBatchSize: 6,     // Maximum items to collect in one batch (normal mode)
            emergencyBatchSize: 1, // Items to collect in emergency mode
            targetInvalidationTimeout: 5000, // Time in ms before replanning if target becomes unavailable
        },

        // Startup settings
        startup: {
            minDelayMs: 1000,    // Minimum delay before villagers start AI behavior (1 second)
            maxDelayMs: 5000,    // Maximum delay before villagers start AI behavior (5 seconds)
        },

        // Spawn settings
        spawn: {
            campRadius: 80,       // Radius around camp center where villagers can spawn randomly
        },

        // Villager names for random generation
        villagerNames: [
            'Alex', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper',
            'Indigo', 'Jordan', 'Kai', 'Lane', 'Morgan', 'Nova', 'Oakley', 'Parker',
            'Quinn', 'Remy', 'Sage', 'Tatum', 'Uma', 'Vale', 'Wren', 'Xander',
            'Yuki', 'Zane', 'Avery', 'Blair', 'Cedar', 'Dakota', 'Echo', 'Fallon',
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
        directionChangeInterval: { min: 2000, max: 5000 }, // 2-5 seconds between direction changes
    },

    // Resource settings - Controls how resources spawn and spread
    resources: {
        // Density-based spawning system
        density: {
            resourcesPerTile: 6, // Average number of resources per tile 
            variance: 3, // ±variance for random variation (10-20 per tile when resourcesPerTile=15 & variance=5)
        },

        // Resource type limits
        maxCounts: {
            tree: 200, // Trees cap at 200
            default: 10 // Other resources cap at 10
        },


        // === DESIGNER BALANCING SECTION ===
        // All food/resource types with complete data (easier to maintain)

        // Biome definitions for world generation
        biomes: {
            camp: { color: '#D2B48C', temperature: 'moderate' },    // Light brown
            woodlands: { color: '#4A7C59', temperature: 'moderate' },    // Forest green
            plains: { color: '#8FBC8F', temperature: 'moderate' },        // Light green
            wetlands: { color: '#556B2F', temperature: 'warm' },      // Dark olive green
            desert: { color: '#DEB887', temperature: 'warm' },            // Burlywood
            mountains: { color: '#696969', temperature: 'cold' },          // Dim gray
            tundra: { color: '#F0F8FF', temperature: 'cold' },            // Alice blue
        },

        // Resource category rules for procedural generation
        resourceCategories: {
            burnable: {
                fire: { min: 1, max: 3 },
                calories: 0,
                water: 0,
                vitamins: [0, 0, 0, 0, 0],
                runspeed: 0 // Burnables don't move
            },
            plant: {
                calories: { min: 10, max: 20 },
                water: { min: 0, max: 15 },
                fire: 0,
                poisonousChance: 0.15, // 15% chance to be poisonous
                poisonousCalories: { min: -25, max: -15 },
                poisonousWater: 0,
                runspeed: 0 // Plants don't move
            },
            animal: {
                calories: { min: 25, max: 40 },
                water: 0,
                fire: 0,
                poisonousChance: 0.12, // 12% chance to be poisonous  
                poisonousCalories: { min: -35, max: -25 },
                poisonousWater: 0,
                // Animal runspeed: 75% are slower (10-20 units slower), 25% are faster (20-30 units faster)
                runspeed: {
                    slowChance: 0.75, // 75% chance to be slower
                    slowRange: { min: -50, max: -40 }, // 20-30 units slower than villager speed
                    fastRange: { min: 40, max: 50 } // 30-40 units faster than villager speed
                }
            }
        },

        // Vitamin distribution system
        vitaminDistribution: {
            // Each resource gets 1-2 vitamins, ensuring variety
            vitaminCount: { min: 1, max: 2 },
            vitaminStrength: { min: 15, max: 30 },
            // Ensure all 5 vitamins are well-represented across all resources
            vitaminBalance: {
                vitaminA: { targetPercentage: 20 }, // 20% of resources should have vitamin A
                vitaminB: { targetPercentage: 20 },
                vitaminC: { targetPercentage: 20 },
                vitaminD: { targetPercentage: 20 },
                vitaminE: { targetPercentage: 20 }
            }
        },

        // Resource data with categories (nutrition and runspeed values generated procedurally)
        resourceData: {
            // Burnables (fire only)
            'oak': { category: 'burnable', emoji: '🌳', temperature: ['moderate'] },
            'pine': { category: 'burnable', emoji: '🌲', temperature: ['cold'] },
            'maple': { category: 'burnable', emoji: '🍁', temperature: ['moderate'] },
            'palm': { category: 'burnable', emoji: '🌴', temperature: ['warm'] },
            'reed': { category: 'burnable', emoji: '🪾', temperature: ['warm'] },
            'spruce': { category: 'burnable', emoji: '🎄', temperature: ['cold'] },
            'bamboo': { category: 'burnable', emoji: '🎋', temperature: ['warm'] },
            'leaf': { category: 'burnable', emoji: '🍂', temperature: ['cold'] },
            'plant': { category: 'burnable', emoji: '🪴', temperature: ['moderate'] },
            'cactus': { category: 'burnable', emoji: '🌵', temperature: ['warm'] },

            // Plants (calories + water + vitamins)
            'apple': { category: 'plant', emoji: '🍎', temperature: ['cold'] },
            'banana': { category: 'plant', emoji: '🍌', temperature: ['warm'] },
            'orange': { category: 'plant', emoji: '🍊', temperature: ['warm'] },
            'grape': { category: 'plant', emoji: '🍇', temperature: ['moderate'] },
            'strawberry': { category: 'plant', emoji: '🍓', temperature: ['moderate'] },
            'pear': { category: 'plant', emoji: '🍐', temperature: ['moderate'] },
            'peach': { category: 'plant', emoji: '🍑', temperature: ['warm'] },
            'plum': { category: 'plant', emoji: '🫐', temperature: ['moderate'] },
            'cherry': { category: 'plant', emoji: '🍒', temperature: ['moderate'] },
            'lemon': { category: 'plant', emoji: '🍋', temperature: ['warm'] },
            'pineapple': { category: 'plant', emoji: '🍍', temperature: ['warm'] },
            'mango': { category: 'plant', emoji: '🥭', temperature: ['warm'] },
            'coconut': { category: 'plant', emoji: '🥥', temperature: ['warm'] },
            'kiwi': { category: 'plant', emoji: '🥝', temperature: ['moderate'] },
            'avocado': { category: 'plant', emoji: '🥑', temperature: ['warm'] },
            'shroom': { category: 'plant', emoji: '🍄‍🟫', temperature: ['cold'] },
            'mushroom': { category: 'plant', emoji: '🍄', temperature: ['moderate'] },
            'rose': { category: 'plant', emoji: '🌹', temperature: ['moderate'] },
            'tulip': { category: 'plant', emoji: '🌷', temperature: ['moderate'] },
            'sunflower': { category: 'plant', emoji: '🌻', temperature: ['warm'] },
            'daisy': { category: 'plant', emoji: '🌼', temperature: ['cold'] },
            'lily': { category: 'plant', emoji: '🌸', temperature: ['cold'] },
            'lotus': { category: 'plant', emoji: '🪷', temperature: ['warm'] },
            'hibiscus': { category: 'plant', emoji: '🌺', temperature: ['warm'] },
            'carrot': { category: 'plant', emoji: '🥕', temperature: ['moderate'] },
            'potato': { category: 'plant', emoji: '🥔', temperature: ['cold'] },
            'tomato': { category: 'plant', emoji: '🍅', temperature: ['warm'] },
            'onion': { category: 'plant', emoji: '🧅', temperature: ['moderate'] },
            'garlic': { category: 'plant', emoji: '🧄', temperature: ['moderate'] },
            'pepper': { category: 'plant', emoji: '🫑', temperature: ['warm'] },
            'cucumber': { category: 'plant', emoji: '🥒', temperature: ['cold'] },
            'lettuce': { category: 'plant', emoji: '🥬', temperature: ['cold'] },
            'broccoli': { category: 'plant', emoji: '🥦', temperature: ['cold'] },
            'cauliflower': { category: 'plant', emoji: '🥬', temperature: ['cold'] },
            'pumpkin': { category: 'plant', emoji: '🎃', temperature: ['cold'] },
            'eggplant': { category: 'plant', emoji: '🍆', temperature: ['warm'] },

            // Animals (calories + vitamins + runspeed)
            'rabbit': { category: 'animal', emoji: '🐰', temperature: ['moderate'] },
            'deer': { category: 'animal', emoji: '🦌', temperature: ['moderate'] },
            'squirrel': { category: 'animal', emoji: '🐿️', temperature: ['moderate'] },
            'pheasant': { category: 'animal', emoji: '🦃', temperature: ['moderate'] },
            'duck': { category: 'animal', emoji: '🦆', temperature: ['moderate'] },
            'goose': { category: 'animal', emoji: '🦢', temperature: ['cold'] },
            'hare': { category: 'animal', emoji: '🐰', temperature: ['moderate'] },
            'fox': { category: 'animal', emoji: '🦊', temperature: ['moderate'] },
            'boar': { category: 'animal', emoji: '🐗', temperature: ['moderate'] },
            'woodcock': { category: 'animal', emoji: '🦅', temperature: ['moderate'] },
            'beaver': { category: 'animal', emoji: '🦫', temperature: ['cold'] },
            'otter': { category: 'animal', emoji: '🦦', temperature: ['cold'] },
            'bear': { category: 'animal', emoji: '🐻', temperature: ['cold'] },
            'wolf': { category: 'animal', emoji: '🐺', temperature: ['cold'] },
            'lynx': { category: 'animal', emoji: '🐱', temperature: ['cold'] },
            'weasel': { category: 'animal', emoji: '🦡', temperature: ['moderate'] },
            'raccoon': { category: 'animal', emoji: '🦝', temperature: ['moderate'] },
            'skunk': { category: 'animal', emoji: '🦨', temperature: ['moderate'] },
            'porcupine': { category: 'animal', emoji: '🦔', temperature: ['moderate'] },
            'mole': { category: 'animal', emoji: '🦫', temperature: ['moderate'] },
            'vole': { category: 'animal', emoji: '🐭', temperature: ['moderate'] },
            'hyena': { category: 'animal', emoji: '🦁', temperature: ['warm'] },
            'leopard': { category: 'animal', emoji: '🐆', temperature: ['warm'] },
            'bobcat': { category: 'animal', emoji: '🐱', temperature: ['moderate'] },
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
    },

    entityEmojis: {
        'well': '💧',
        'fireplace': '🔥',
        'sleeping_bag': '🛏️',
        'storage_box': '📦'
    },

    // Character emoji system - State-based character representation
    characters: {
        // Pre-composed emoji characters with skin tone and gender variants
        // Each array contains: [light skin, medium-light, medium, medium-dark, dark skin]
        emojiSets: {
            standing: {
                male: ['🧍🏻', '🧍🏼', '🧍🏽', '🧍🏾', '🧍🏿'],
                female: ['🧍🏻‍♀️', '🧍🏼‍♀️', '🧍🏽‍♀️', '🧍🏾‍♀️', '🧍🏿‍♀️'],
                neutral: ['🧍🏻', '🧍🏼', '🧍🏽', '🧍🏾', '🧍🏿']
            },
            running: {
                male: ['🏃🏻‍♂️', '🏃🏼‍♂️', '🏃🏽‍♂️', '🏃🏾‍♂️', '🏃🏿‍♂️'],
                female: ['🏃🏻‍♀️', '🏃🏼‍♀️', '🏃🏽‍♀️', '🏃🏾‍♀️', '🏃🏿‍♀️'],
                neutral: ['🏃🏻', '🏃🏼', '🏃🏽', '🏃🏾', '🏃🏿']
            },
            sleeping: {
                male: ['🧘🏻‍♂️', '🧘🏼‍♂️', '🧘🏽‍♂️', '🧘🏾‍♂️', '🧘🏿‍♂️'],
                female: ['🧘🏻‍♀️', '🧘🏼‍♀️', '🧘🏽‍♀️', '🧘🏾‍♀️', '🧘🏿‍♀️'],
                neutral: ['🧘🏻', '🧘🏼', '🧘🏽', '🧘🏾', '🧘🏿']
            }
        },

        // Character customization settings
        customization: {
            // Randomization seed for consistent character appearance
            useGameSeed: true,   // Use game seed for character customization

            // Default appearance (fallback if no customization)
            defaultSkinTone: 1,  // Index for medium-light skin
            defaultGender: 'neutral'
        }
    },

    // UI settings - Controls the appearance and layout of user interface elements
    ui: {
        barHeight: 20, // Height of need bars in pixels
        barWidth: 150, // Width of need bars in pixels
        needBarSpacing: 5, // Spacing between need bars

        // Seed validation (for URL parameters)
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
            boxBackground: '#222', // Dark text color´

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
            buttonSuccess: '#228B22', // Success button (green)
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
            walls: -1,
            entity: 100,
            player: 200,
            lineOfSight: 600,
            ui: 1000,
            overlay: 1000,
            overlayContent: 1001,
            debug: 1002
        },
    },

    // Logging system settings
    logging: {
        summaryLoggingInitialState: false, // spammy gate
        logTransmissionInterval: 2000, // Send logs every 2 seconds
        domSnapshotInterval: 5000, // Capture DOM every 5 seconds
        domElementLimit: 1000, // Maximum DOM elements to capture
        serverPort: 3000, // Local server port for logging
        serverUrl: 'http://localhost:3000', // Server URL for logging
        loggingChance: 0.001 // .1% chance per frame
    },

    // Storage settings
    storage: {
        communalCapacity: 20, // Capacity of communal storage box
        personalCapacity: 8, // Capacity of personal storage boxes

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
        // Note: drinking amount is now GameConfig.player.wellWaterRestore for consistency
    },

    // Fire settings
    fires: {
        maxWood: 10, // Maximum wood that can be stored in a fire
        initialWoodRange: { min: 7, max: 9 }, // Random initial wood range
        hourlyConsumption: 0.167 // Wood consumed per hour (1 unit every 6 hours)
    },

    // Wall system settings
    walls: {
        // Wall dimensions and positioning
        height: { min: 60, max: 210 }, // Random height range for wall segments
        openingsPerCell: { min: 1, max: 3 }, // Number of openings per cell (not per edge)

        // Camp cell wall settings
        campCell: {
            forceWallsWithOpenings: true, // Force camp cell to have 4 walls with openings
            allowMountains: false, // Allow mountains to spawn in camp cell
            wallOpeningsCount: 1, // Number of openings per camp cell wall
        },

        // Wall colors
        wallColor: 0x000000, // Black walls
        openingColor: 0xFFFFFF, // White openings

        // Rendering settings
        alpha: 1, // opaque

        // Collision settings
        collisionEnabled: true, // Whether walls block movement
        collisionMargin: 0, // Extra collision margin around wall segments, so you collide with the "air" around them

        // Spawning safety settings
        spawnSafetyMargin: 50, // Minimum distance from walls for resource spawning
        spawnCellMargin: 50, // Margin from cell edges for safe spawning

        // Openings
        openingMinSizePerc: 0.15,
        openingMaxSizePerc: 0.45,

        // Mountains
        numMountains: { min: 0, max: 7 }, // Random height range for mountain segments
        mountainHeight: { min: 200, max: 600 }, // Random height range for mountain segments
        mountainWidth: { min: 200, max: 600 }, // Random width range for mountain segments
        mountainMargin: 50, // Margin from cell edges for mountain placement

        // Gates
        gates: {
            enabled: true, // Whether to create gates at wall openings
            colors: [
                0xFF0000, // Red
                0xFF8000, // Orange
                0xFFFF00, // Yellow
                0x00FF00, // Green
                0x0080FF, // Blue
                0x8000FF, // Purple
                0xFF0080, // Pink
                0xFF4000, // Red-Orange
            ],
            deadlyCount: 2, // Number of deadly gate types per seed (out of 8 types)
            depthRatio: 0.60, // Gate depth as ratio of wall depth (0.5 = half depth)
            overlapRatio: 0.5, // Gate overlap with biomes as ratio (0.5 = half overlap)
            zIndex: -11, // Z-index for gates (above ground)
            alpha: 1, // Gate opacity
        },
    },

    // Navigation settings - A* pathfinding system
    navigation: {
        gridSize: 24, // Size of each grid cell in pixels (back to 64px with caching)
        partitioningGridSize: 1024, // Size of each grid cell in pixels (back to 64px with caching)
        minDistanceForPathfinding: 0, // Only use pathfinding for targets > 1 grid cell away
        maxPathfindingAttempts: 2000, // Maximum iterations for A* algorithm (increased for complex wall systems)
        enableForVillagers: true, // Enable pathfinding for villagers

        // Pathfinding wall margin - Extra space around walls for pathfinding (doesn't affect actual collision)
        pathfindingWallMargin: 8, // Extra pixels around walls for pathfinding grid

        // Debug visualization settings
        debugVisualization: {
            enabled: false, // Enable path visualization
        },

        // Path following settings
        waypointReachDistance: 32, // Distance within which a waypoint is considered "reached" (pixels)
        targetReachDistance: 8, // Distance within which the final target is considered "reached" (pixels)
        pathReplanningTolerance: 32, // Distance change that triggers path replanning (pixels)
    },

    // Technical constants
    technical: {
        // Distance constants
        distances: {
            animalSenseDistance: 100, // When animals sense you to flee
            animalFleeDistance: 1000, // How far animals flee
            animalWanderRange: { min: 50, max: 150 }, // Range for animal wandering
            resourcePlacementAttempts: 100, // Max attempts to place resources
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
    },

    // Intro screen settings - Controls the sci-fi survival mystery intro
    intro: {
        // Planet name generation
        planetNames: [
            'Copernicus Alpha', 'Kepler Omega', 'Galileo Zulu', 'Hubble Tango', 'Sagan Echo',
            'Newton Delta', 'Einstein Gamma', 'Curie Sigma', 'Tyson Theta', 'Hawking Lambda',
            'Herschel Beta', 'Brahe Phi', 'Ptolemy Rho', 'Tycho Xi', 'Cassini Omicron',
            'Halley Pi', 'Bessel Tau', 'Struve Upsilon', 'Messier Chi', 'Hipparchus Psi'
        ],

        // Survivor log entry text
        survivorLog: {
            title: 'PERSONAL LOG - ENTRY #137',
            timestamp: 'Epoch 2067413432',
            content: [
                'Emergency pod deployed successfully. Landing site appears to be a habitable zone.',
                '',
                'The locals here are... different. They pointed me to an empty bedroll but otherwise',
                'seem not very talkative. I\'ll have to figure out what to do on my own.',
                '',
                'I can see 💨 smoke rising from the horizon - maybe another crash site?',
                'Need to investigate once I get my bearings.',
                '',
                'Priority: Find food, water, and shelter. Then explore.',
                '',
                'End log.'
            ]
        },

        // Button text
        buttonText: 'OBSERVE CAREFULLY',

        // Visual settings
        overlayColor: 0x000000,
        overlayAlpha: 0.9,
        textColor: '#ffffff',
        titleColor: '#ffaa00',
        buttonColor: '#228B22',
        buttonHoverColor: '#32CD32',

        // Font sizes
        titleSize: '28px',
        contentSize: '16px',
        buttonSize: '18px',

        // Spacing
        titleMargin: 40,
        contentMargin: 20,
        buttonMargin: 30,
        lineSpacing: 8
    },

    // Outro screen settings - Controls the death log entry
    outro: {
        // Death log entry text
        deathLog: {
            title: 'PERSONAL LOG - ENTRY #138',
            timestamp: 'Epoch 2067918790',
            content: [
                'No pulse detected. Medical log entry triggered.',
                '',
                'VITAL SIGNS:',
                'Temperature: {temperature}%',
                'Hydration: {water}%',
                'Calories: {calories}%',
                'Vitamin A: {vitaminA}%',
                'Vitamin B: {vitaminB}%',
                'Vitamin C: {vitaminC}%',
                'Vitamin D: {vitaminD}%',
                'Vitamin E: {vitaminE}%',
                '',
                'CAUSE OF DEATH: {causeOfDeath}',
                '',
                'End log.'
            ]
        },

        // Visual settings
        overlayColor: 0x000000,
        overlayAlpha: 0.9,
        textColor: '#ffffff',
        titleColor: '#ff0000', // Red for death

        // Font sizes
        titleSize: '28px',
        contentSize: '16px',

        // Spacing
        titleMargin: 40,
        contentMargin: 20,
        lineSpacing: 8
    },

    // Smoke indicator settings - Controls the directional smoke pointer
    smokeIndicator: {
        // Distance multiplier for smoke location (3x world size)
        distanceMultiplier: 3,

        // Edge positioning settings
        edgeMargin: 40, // Distance from screen edge
        arrowSize: 20, // Size of the arrow sprite

        // Visual settings
        fontSize: 24,
        textColor: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        padding: 8,

        // Text label
        label: 'smoke',

        // Arrow color
        arrowColor: 0xffffff,
        arrowAlpha: 0.9
    },

    // Line of sight system settings
    lineOfSight: {
        enabled: true, // Whether line of sight is active
        overlayColor: 0x000000, // Black overlay for hidden areas
        overlayAlpha: 1.0, // Fully opaque overlay
        tileSize: 1500, // Use same tile size as world grid
        updateInterval: 100, // Update line of sight every 100ms for performance
    },
};

console.log('[GameConfig.js] Loaded at', new Date().toISOString(), 'cache-bust:', Math.random()); 