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
        width: 1200,  // Total world width in pixels (3-4 screens worth)
        height: 800,  // Total world height in pixels (3-4 screens worth)
        tileSize: 32, // Size of each "tile" for spatial calculations (used in distance checks)
        villagerCount: 8, // Total camps (7 AI villagers + 1 player camp)
        resourcesPerVillager: 3, // Initial resources spawned per villager (including player)
        maxResourcesPerType: 10, // Global cap on resources per type (prevents overpopulation)

        // Village and camp generation
        villageCenterOffset: { x: 50, y: 0 }, // Offset for village well from center
        campRadius: 300, // Distance from village center to camps (doubled from 150)
        campSpacing: { x: 40, y: 60 }, // Spacing between camp facilities (doubled from 20,30)
        playerStartOffset: { x: 40, y: 0 }, // Player start position relative to their camp

        // Resource generation
        resourceVillageMinDistance: 100, // Minimum distance from village center for resources
        wellMinDistance: 200, // Minimum distance between wells
        wellCount: 3, // Number of additional wells beyond village well
        wellMaxAttempts: 50, // Maximum attempts to place a well

        // Perlin noise settings
        noiseScale: 10, // Scale factor for Perlin noise in resource placement
        noiseBias: 0.5 // Bias factor for noise-based positioning
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
        interactionThreshold: 32, // Distance threshold for interactions (pixels)

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
        foragingEfficiency: 0.8 // Success rate when villagers try to collect resources
        // Formula: if (Math.random() < foragingEfficiency) { collectResource() }
        // Lower values = villagers fail to collect resources more often
    },

    // Resource settings - Controls how resources spawn and spread
    resources: {
        propagationRadius: 100, // Distance within which resources can spawn new ones
        // Formula: if (nearbyResources >= 2 && distance < propagationRadius) { chanceToSpawn() }
        // Higher values = resources spread over larger areas
        propagationChance: 0.1, // Probability of resource spawning a new one overnight
        // Formula: if (Math.random() < propagationChance) { spawnNewResource() }
        // Higher values = faster resource growth
        maxDensity: 5 // Maximum resources per area (prevents overcrowding)
        // Formula: if (resourcesInArea >= maxDensity) { noNewSpawns() }
        // Lower values = more sparse resource distribution
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
        uiMargin: 20, // Margin from screen edges for all UI elements
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
        dailyRefill: 4 // Water refilled per day
    },

    // Fire settings
    fires: {
        maxWood: 2, // Maximum wood that can be stored in a fire
        dailyWoodConsumption: 1 // Wood consumed per day when burning
    }
};

console.log('[GameConfig.js] Loaded at', new Date().toISOString(), 'cache-bust:', Math.random());
console.log('[GameConfig.js] window.GameConfig:', window.GameConfig); 