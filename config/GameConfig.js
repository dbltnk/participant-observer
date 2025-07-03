// Game Configuration - All configurable parameters for easy balancing
// 
// DESIGNER NOTES:
// - All time values are in real-world seconds unless specified otherwise
// - All distances are in pixels unless specified otherwise
// - All speeds are in pixels per second
// - All percentages are 0-100 scale unless specified otherwise
// - All needs drain rates are in in-game hours to empty (see needsDrain)
// - needsVariance is the ±% range applied to each need per day

const GameConfig = {
    // World settings - Controls the size and layout of the game world
    world: {
        width: 1200,  // Total world width in pixels (3-4 screens worth)
        height: 800,  // Total world height in pixels (3-4 screens worth)
        tileSize: 32, // Size of each "tile" for spatial calculations (used in distance checks)
        villagerCount: 7, // Number of AI villagers (excluding player)
        resourcesPerVillager: 3, // Initial resources spawned per villager (including player)
        maxResourcesPerType: 10 // Global cap on resources per type (prevents overpopulation)
    },

    // Time settings - Controls how fast game time passes relative to real time
    time: {
        realSecondsPerGameDay: 600, // 1 game day = 10 minutes real time (600 seconds)
        // Formula: gameTime = realTime * (86400 / realSecondsPerGameDay)
        // Example: 1 real second = 144 game seconds (86400/600)

        dayStartHour: 8, // Hour when villagers wake up and start foraging
        nightStartHour: 18, // Hour when villagers return to camp
        sleepAcceleration: 10 // Seconds to reach 8:00 when sleeping (time acceleration multiplier)
    },

    // Needs drain settings (in in-game hours to empty)
    needsDrain: {
        temperature: 8,   // 8 in-game hours to empty (only drains at night when not near fire)
        water: 24,        // 24 in-game hours to empty
        calories: 36,     // 36 in-game hours to empty
        vitamins: 48      // 12 in-game hours to empty (reduced from 48 for better visibility)
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
        }
    },

    // Villager settings - Controls AI villager behavior and capabilities
    villager: {
        moveSpeed: 100, // Villager movement speed in pixels per second (same as player)
        // Formula: newPosition = oldPosition + (moveSpeed * deltaTime / 1000)
        memoryCapacity: 10, // Maximum number of resource locations a villager can remember
        // Used in: villager.memory.knownFoodLocations.length <= memoryCapacity
        explorationRadius: 200, // How far villagers explore when they don't know of nearby food
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
        inventorySlotSize: 50 // Size of inventory slots in pixels (width and height)
    }
}; 