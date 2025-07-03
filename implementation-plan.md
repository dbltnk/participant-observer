# Alpine Sustainability - Implementation Plan

## Project Structure

```
sustain/
├── index.html          # Main game page ✅ COMPLETED
├── phaser-main.js      # Phaser 3 main entry point ✅ COMPLETED
├── config/
│   └── GameConfig.js   # All configurable game parameters ✅ COMPLETED
├── logs/               # Browser logging system ✅ PRESERVED
├── server.js           # Logging server ✅ PRESERVED
└── design-doc.md       # Game design document ✅ PRESERVED
```

## Development Phases

### Phase 1: Core Infrastructure ✅ COMPLETED - FULLY FUNCTIONAL
1. ✅ Set up project structure
2. ✅ Implement basic game loop
3. ✅ Create configuration system
4. ✅ Set up Phaser 3 rendering system (emoji-based)
5. ✅ Implement simple player movement

**Fully Functional Features:**
- ✅ Game initialization with randomized seed system (1-999)
- ✅ Basic game loop running at 60fps with deltaTime capping
- ✅ Player movement with WASD keys and collision detection
- ✅ World generation with village, camps, wells, and resources
- ✅ Complete UI system with need bars, time display, inventory, and seed management
- ✅ Player needs system (temperature, water, calories, vitamins A-E) with daily variance
- ✅ Game over conditions with detailed death messages
- ✅ Browser logging system preserved and working
- ✅ Assert system for error handling
- ✅ Time system with proper acceleration (1 real second = 144 game seconds)
- ✅ Game starts at 08:00 instead of midnight
- ✅ Seed system with editable input and confirmation dialogs
- ✅ Info box with game controls and version

### Phase 2: World Generation ✅ COMPLETED
1. ✅ Implement Perlin noise utility
2. ✅ Create world generation system
3. ✅ Generate village, camps, and wells
4. ✅ Generate initial resources
5. ✅ Implement basic collision detection (world bounds)

### Phase 3: Player Systems ✅ COMPLETED
1. ✅ Implement player needs system with daily variance (±20%)
2. ✅ Create inventory system (visual, 6 slots)
3. ✅ Add resource collection (click to collect, inventory management)
4. ✅ Implement complete UI (need bars, inventory, time, seed)
5. ✅ Add time system with proper acceleration

### Phase 4: Villager AI ✅ COMPLETED - FULLY FUNCTIONAL
1. ✅ Create villager class with complete state machine
2. ✅ Implement memory system for resource locations
3. ✅ Add foraging behavior with exploration and goal persistence
4. ✅ Create daily routine system (wake up, forage, return, eat, sleep)
5. ✅ Implement needs system for villagers (same as player)
6. ✅ Add visual representation with health emojis and debug info
7. ✅ Implement death system with corpses
8. ✅ Add camp leaving/returning logic
9. ✅ Create task-based foraging (wood, food, water priorities)
10. ✅ Add storage interaction system (personal and communal)
11. ✅ Implement fire management and wood collection
12. ✅ Add well interaction for water needs

**Fully Functional Villager Features:**
- ✅ 7 AI villagers with unique names and personalities
- ✅ Complete daily routine: wake up at 8:00, forage until 18:00, return to camp
- ✅ Memory system: villagers remember resource locations and return to known areas
- ✅ Exploration system: villagers explore new areas when no known resources nearby
- ✅ Needs management: temperature, water, calories, vitamins (same as player)
- ✅ Death system: villagers die when needs reach zero, become permanent corpses
- ✅ Visual feedback: health emojis, debug info, exploration radius indicators
- ✅ Storage interaction: use personal storage first, then communal storage
- ✅ Fire management: collect wood and add to camp fires
- ✅ Well interaction: drink from wells to restore water
- ✅ Task prioritization: water first, then food, then wood collection

### Phase 5: Game Mechanics ✅ COMPLETED - FULLY FUNCTIONAL
1. ✅ Implement cooking system (players and villagers can cook food near fires)
2. ✅ Add fire management (players and villagers can add wood to fires)
3. ✅ Create storage system (players and villagers can use storage boxes)
4. ✅ Add sleeping mechanics (players can sleep to skip night)
5. ✅ Implement resource propagation (SMART SYSTEM - DENSITY-BASED)
6. ✅ Add player interactions with all objects

**Fully Functional Game Mechanics:**
- ✅ **Cooking System**: Players and villagers can cook food near burning fires
- ✅ **Fire Management**: Add wood to fires, fires burn and provide warmth
- ✅ **Storage System**: Personal and communal storage boxes with transfer interface
- ✅ **Sleeping System**: Sleep until 8:00 AM with time acceleration
- ✅ **Food Nutrition**: Different foods provide different calories and vitamins
- ✅ **Raw vs Cooked Food**: Raw food provides half nutrition, cooked food provides full nutrition
- ✅ **Debug System**: Toggle debug mode to see interaction circles and object info
- ✅ **Object Interactions**: All objects (wells, fires, sleeping bags, storage) are interactive
- ✅ **Inventory Management**: Click slots to eat food or transfer items
- ✅ **Villager AI Integration**: Villagers use all the same mechanics as players
- ✅ **Day/Night Lighting**: Dynamic lighting changes based on time of day
- ✅ **Ground Texture**: Subtle ground texture using Perlin noise for better navigation

**MAJOR MISSING FEATURE:**
- ✅ **Resource Propagation**: Smart propagation system with density-based reproduction chance (prevents overpopulation while allowing die-off)

### Phase 6: Polish & UI ✅ COMPLETED
1. ✅ Complete UI implementation with all elements
2. ✅ Add robust seed system with randomization
3. ✅ Implement game over conditions
4. ✅ Add comprehensive error handling
5. ✅ Test and balance core systems

## Current Status: PHASE 5 COMPLETE - FULLY FUNCTIONAL GAME

**What you can test right now:**
1. **Game loads** - Open index.html, game initializes with random seed
2. **Player movement** - Use WASD to move the player character (👤) with smooth movement
3. **World rendering** - See village center, camps, wells (💧), resources (🫐🍄🌿🐰🦌🌲)
4. **UI elements** - Need bars with numbers, time display with emojis, inventory slots, seed management
5. **Time system** - Game time advances properly (10 minutes real time = 1 game day)
6. **Needs decay** - Player needs decrease over time with daily variance
7. **Game over** - If any need reaches 0, game ends with specific death message
8. **Seed system** - Random seed on first load, editable seed input, confirmation dialogs
9. **Logging** - Browser console and server logs capture everything
10. **Performance** - Smooth 60fps with deltaTime capping to prevent large jumps
11. **Resource collection** - Click on resources to collect them into inventory
12. **Inventory management** - Click slots to eat food or transfer items
13. **Well interaction** - Click wells to drink and restore water
14. **Villager AI** - 7 AI villagers with complete daily routines and needs management
15. **Villager memory** - Villagers remember resource locations and return to known areas
16. **Villager exploration** - Villagers explore new areas when no known resources nearby
17. **Villager death** - Villagers die when needs reach zero and become permanent corpses
18. **Villager storage** - Villagers use personal and communal storage boxes
19. **Villager fire management** - Villagers collect wood and add to camp fires
20. **Debug system** - Toggle debug mode to see villager states, tasks, exploration radius, and object info
21. **Ground texture** - Subtle ground texture using Perlin noise for better navigation
22. **Fire interaction** - Add wood to fires, cook food near burning fires
23. **Sleeping system** - Sleep at sleeping bags to skip night and restore needs
24. **Storage system** - Transfer items between inventory and storage boxes
25. **Cooking mechanics** - Cook food for better nutrition, eat raw food for half nutrition
26. **Debug visualization** - See interaction distance circles and object status when debug is enabled
27. **Day/Night cycle** - Dynamic lighting changes based on time of day
28. **Large world** - 10x viewport size world for exploration

**✅ FULLY FUNCTIONAL:**
- ✅ **Resource Propagation**: Smart propagation system prevents overpopulation while allowing natural die-off

## Core Architecture

### 1. Game State Management ✅ IMPLEMENTED
**Approach:** Scene-local state management with Phaser 3 integration.

```javascript
// MainScene.js - State structure within Phaser scene
class MainScene extends Phaser.Scene {
    create() {
        // Player state managed within scene
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
        
        // World entities stored in scene
        this.entities = []; // All game objects (resources, buildings, etc.)
        this.camps = []; // Camp locations for villager AI
        this.wells = []; // Well locations for water access
        this.villagers = []; // AI villagers with complete behavior
    }
}
```

### 2. Game Loop Architecture ✅ IMPLEMENTED
**Approach:** Phaser 3 scene-based game loop with built-in deltaTime handling.

```javascript
// MainScene.js - Phaser game loop
class MainScene extends Phaser.Scene {
    update(time, delta) {
        // Advance game time (accelerated)
        const timeAcceleration = GameConfig.time.secondsPerDay / GameConfig.time.realSecondsPerGameDay;
        const gameTimeDelta = (delta / 1000) * timeAcceleration;
        this.playerState.currentTime += gameTimeDelta;
        
        // Update villagers
        this.updateVillagers(delta);
        
        // Update needs
        updateNeeds(this.playerState, delta);
        
        // Update UI
        this.updatePhaserUI();
        
        // Check game over
        const reason = checkGameOver(this.playerState);
        if (reason) {
            this.showGameOverOverlay(reason);
            this.scene.pause();
            return;
        }
        
        // Player movement
        this.handlePlayerMovement(delta);
    }
}
```

### 3. World Generation System ✅ IMPLEMENTED
**Approach:** Perlin noise-based generation with configurable parameters, integrated into Phaser scene.

```javascript
// MainScene.js - World generation
class MainScene extends Phaser.Scene {
    create() {
        // Generate world using Perlin noise
        this.noise = new PerlinNoise(currentSeed);
        this.seededRandom = new SeededRandom(currentSeed);
        
        // Generate village, camps, wells, and resources
        this.generateVillage();
        this.generateCamps();
        this.generateWells();
        this.generateResources();
        
        // Render all entities as Phaser text objects
        this.renderEntities();
    }
    
    generateResources() {
        const totalResources = (cfg.villagerCount + 1) * cfg.resourcesPerVillager;
        for (let i = 0; i < totalResources; i++) {
            const position = this.findResourcePosition();
            const resourceType = resourceTypes[i % resourceTypes.length];
            const emoji = this.getResourceEmoji(resourceType);
            this.entities.push({ 
                position, 
                type: resourceType, 
                emoji, 
                collected: false, 
                propagationChance: GameConfig.resources.propagationChance 
            });
        }
    }
}
```

### 4. Villager AI System ✅ IMPLEMENTED
**Approach:** State machine with memory-based decision making.

```javascript
// Villager.js - AI system (COMPLETED)
class Villager {
    constructor(name, campPosition, villagerId) {
        this.name = name;
        this.campPosition = campPosition;
        this.villagerId = villagerId;
        this.state = 'SLEEPING';
        this.memory = {
            knownFoodLocations: [], // Array of {x, y, resourceType, lastSeen}
            knownWoodLocations: [],
            lastKnownPosition: null
        };
        this.needs = {temperature: 100, water: 100, calories: 100, vitamins: [100, 100, 100, 100, 100]};
        this.inventory = new Array(6).fill(null);
    }
    
    update(deltaTime, gameTime, entities, storageBoxes) {
        this.updateNeeds(deltaTime, gameTime);
        this.updateState(gameTime, deltaTime);
        this.executeCurrentState(deltaTime, entities, storageBoxes);
        this.updateVisuals();
        return this.checkDeath();
    }
    
    updateState(gameTime, deltaTime) {
        const t = this.getCurrentTime(gameTime);
        const hour = t.hour;
        
        if (this.state === 'SLEEPING' && hour >= this.wakeUpTime) {
            this.state = 'FORAGING';
        } else if (this.state === 'FORAGING' && hour >= 18) {
            this.state = 'RETURNING';
        } else if (this.state === 'RETURNING' && this.isAtCamp()) {
            this.state = 'EATING';
        } else if (this.state === 'EATING' && this.needs.calories > 80) {
            this.state = 'SLEEPING';
        }
    }
    
    executeCurrentState(deltaTime, entities, storageBoxes) {
        switch (this.state) {
            case 'FORAGING':
                this.forage(entities, deltaTime);
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
        // Check memory first, then explore new areas
        const knownTarget = this.findNearestKnownFood(entities);
        if (knownTarget) {
            this.currentTarget = knownTarget;
        } else {
            const foundTarget = this.exploreNewArea(entities);
            if (!foundTarget) {
                this.setExplorationTarget();
            }
        }
        
        // Move towards target and collect if close enough
        if (this.currentTarget) {
            this.moveTowards(this.currentTarget.position, deltaTime);
            if (distance(this.position, this.currentTarget.position) <= GameConfig.player.interactionThreshold) {
                this.collectResource(this.currentTarget);
            }
        }
    }
}
```

### 5. Resource System 🔄 PARTIALLY IMPLEMENTED
**Approach:** Entity-based system with type-specific behavior.

```javascript
// Resources.js - Resource management (PARTIALLY IMPLEMENTED)
class Resource {
    constructor(type, position) {
        this.type = type;
        this.position = position;
        this.emoji = this.getEmoji(type);
        this.collected = false;
        this.propagationChance = this.getPropagationChance(type);
    }
    
    static getEmoji(type) {
        const emojis = {
            'blackberry': '🫐',
            'mushroom': '🍄',
            'herb': '🌿',
            'rabbit': '🐰',
            'deer': '🦌',
            'tree': '🌲',
            'well': '💧',
            'fireplace': '🔥',
            'sleeping_bag': '🛏️',
            'storage_box': '📦'
        };
        return emojis[type] || '❓';
    }
    
    static getNutrition(type) {
        const nutrition = {
            'blackberry': {calories: 50, vitamins: [0, 0, 0, 1, 0]},
            'mushroom': {calories: 30, vitamins: [0, 0, 1, 0, 0]},
            'herb': {calories: 20, vitamins: [1, 0, 0, 0, 0]},
            'rabbit': {calories: 200, vitamins: [0, 1, 0, 0, 0]},
            'deer': {calories: 500, vitamins: [0, 1, 0, 0, 1]}
        };
        return nutrition[type] || {calories: 0, vitamins: [0, 0, 0, 0, 0]};
    }
}

// ❌ MISSING: Resource propagation system
// Resources should regrow over time based on propagationChance and density
```

### 6. UI System ✅ COMPLETED
**Approach:** Phaser-native UI with comprehensive functionality.

```javascript
// MainScene.js - UI management
class MainScene extends Phaser.Scene {
    create() {
        // Create UI container (fixed to camera)
        this.uiContainer = this.add.container(0, 0).setScrollFactor(0);
        
        // Create need bars (top left)
        this.createNeedBars();
        
        // Create inventory (bottom center)
        this.createInventory();
        
        // Create time display (top right)
        this.createTimeDisplay();
        
        // Create seed UI (bottom right)
        this.createSeedUI();
        
        // Create info box (bottom left)
        this.createInfoBox();
        
        // Create debug controls
        this.createDebugControls();
    }
    
    createNeedBars() {
        const needTypes = ['temperature', 'water', 'calories', 'vitaminA', 'vitaminB', 'vitaminC', 'vitaminD', 'vitaminE'];
        const needLabels = ['🌡️', '💧', '🍽️', 'A', 'B', 'C', 'D', 'E'];
        
        for (let i = 0; i < needLabels.length; i++) {
            const barBg = this.add.rectangle(/* position */, GameConfig.ui.barWidth, GameConfig.ui.barHeight, 0x333333);
            const barFill = this.add.rectangle(/* position */, GameConfig.ui.barWidth, GameConfig.ui.barHeight, getPhaserBarColor(needTypes[i]));
            const label = this.add.text(/* position */, needLabels[i], { fontSize: '16px' });
            const value = this.add.text(/* position */, '100', { fontSize: '12px' });
            
            this.uiContainer.add([barBg, barFill, label, value]);
            this.ui.needsBars.push({ barBg, barFill, label, value });
        }
    }
    
    updatePhaserUI() {
        // Update all UI elements with current game state
        this.updateNeedBars();
        this.updateInventory();
        this.updateTimeDisplay();
    }
}
```

### 7. Configuration System ✅ COMPLETED
**Approach:** Centralized config object for easy balancing.

```javascript
// config/GameConfig.js - All game parameters
const GameConfig = {
    // World settings
    world: {
        width: window.innerWidth * 10, // 10x viewport width
        height: window.innerHeight * 10, // 10x viewport height
        tileSize: 32,
        villagerCount: 8, // 7 AI villagers + 1 player camp
        resourcesPerVillager: 50,
        maxResourcesPerType: 500
    },
    
    // Time settings
    time: {
        realSecondsPerGameDay: 600, // 10 minutes
        dayStartHour: 8,
        nightStartHour: 18,
        sleepAcceleration: 10 // 10 seconds to reach 8:00
    },
    
    // Needs drain settings (in in-game hours to empty)
    needsDrain: {
        temperature: 8,   // 8 in-game hours to empty (only drains at night when not near fire)
        water: 24,        // 24 in-game hours to empty
        calories: 36,     // 36 in-game hours to empty
        vitamins: 48      // 48 in-game hours to empty
    },
    
    // Needs drain variance (applied per day, per character, per need)
    needsVariance: 0.2, // 20% (0.2) ± variance, configurable
    
    // Player settings
    player: {
        moveSpeed: 100, // pixels per second
        inventorySize: 6,
        needsDecayRate: {
            temperature: 5, // per minute
            water: 10,
            calories: 15,
            vitamins: 2
        }
    },
    
    // Villager settings
    villager: {
        moveSpeed: 100, // Same as player speed
        memoryCapacity: 10, // max remembered locations
        explorationRadius: 400,
        foragingEfficiency: 0.8
    },
    
    // Resource settings
    resources: {
        propagationRadius: 80,
        propagationChance: 0.15,
        maxDensity: 8 // max resources per area
    },
    
    // UI settings
    ui: {
        barHeight: 20,
        barWidth: 150,
        inventorySlotSize: 50
    }
};
```

## Key Implementation Details

### Error Handling Strategy ✅ IMPLEMENTED
```javascript
// phaser-main.js - Assert system
function assert(condition, message) {
    if (!condition) {
        console.error(`ASSERTION FAILED: ${message}`);
        console.trace();
        // In development, could throw error
        // throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

// Usage throughout codebase
assert(this.playerState.needs.temperature >= 0, "Temperature cannot be negative");
assert(this.playerState.needs.temperature <= 100, "Temperature cannot exceed 100");
```

### Performance Considerations ✅ IMPLEMENTED
- ✅ Use `requestAnimationFrame` for smooth 60fps
- ✅ Limit DOM queries by caching element references
- ✅ DeltaTime capping to prevent large jumps (200ms max per frame)
- ✅ Batch DOM updates where possible
- ✅ Efficient villager AI updates with goal persistence

### Memory Management ✅ IMPLEMENTED
- ✅ Clean up event listeners on game restart
- ✅ Clear villager memory when they die
- ✅ Remove collected resources from world
- ✅ Efficient memory system for villager resource locations

### Testing Strategy ✅ IMPLEMENTED
- ✅ Use browser console for debugging
- ✅ Leverage existing logging system
- ✅ Verify seed consistency
- ✅ Test edge cases (villager death, resource depletion)
- ✅ Debug mode for villager behavior observation

## Success Criteria

### Minimum Viable Product ✅ COMPLETED
- ✅ Player can move and collect resources
- ✅ Basic needs system works with daily variance
- ✅ Villagers exist and move around with complete AI
- ✅ Game ends when player dies with specific death messages
- ✅ Seed system works with randomization and persistence

### Stretch Goals 🔄 IN PROGRESS
- ✅ Villager memory system
- ❌ Resource propagation (NOT IMPLEMENTED - CRITICAL GAP)
- ✅ Complete UI with all features
- ✅ Basic balancing (needs decay rates, time acceleration)
- ✅ Error handling with assert system
- ✅ Complete object interactions

## Critical Missing Feature: Resource Propagation

**Status:** ❌ NOT IMPLEMENTED

**Impact:** This is a critical gap that makes long-term gameplay impossible. Once all resources are collected, the game becomes unplayable.

**Required Implementation:**
```javascript
// Resource propagation system (NOT IMPLEMENTED)
function updateResourcePropagation(gameTime) {
    // Check each collected resource for propagation
    for (const entity of this.entities) {
        if (entity.collected && entity.type !== 'tree') {
            // Check if enough time has passed (overnight)
            const timeSinceCollection = gameTime - entity.collectedAt;
            if (timeSinceCollection >= GameConfig.time.secondsPerDay) {
                // Attempt to spawn new resource nearby
                if (Math.random() < entity.propagationChance) {
                    const newPosition = this.findPropagationPosition(entity.position);
                    if (newPosition) {
                        this.entities.push({
                            position: newPosition,
                            type: entity.type,
                            emoji: entity.emoji,
                            collected: false,
                            propagationChance: entity.propagationChance
                        });
                    }
                }
            }
        }
    }
}
```

## Recent Improvements (Latest Session)

### ✅ Fixed Issues:
1. **Vitamin bars** - Now display numbers and decay visibly (reduced from 48 to 12 hours to empty)
2. **Time system** - Fixed acceleration to use proper formula (1 real second = 144 game seconds)
3. **Seed system** - Randomized default (1-999), editable input, confirmation dialogs
4. **UI improvements** - Added emojis to time display, fixed seed input styling
5. **Game start time** - Now starts at 08:00 instead of midnight
6. **Info box** - Restored bottom-left info box with game controls
7. **Debug logging** - Removed spam, kept essential logging
8. **Phaser migration** - Successfully migrated from vanilla JS to Phaser 3
9. **Resource collection** - Implemented click-to-collect with inventory management
10. **Well interaction** - Implemented drinking from wells to restore water
11. **Code cleanup** - Removed orphaned CSS classes and legacy config values
12. **Documentation** - Updated design doc and implementation plan to reflect Phaser 3 architecture
13. **Villager AI** - Complete villager system with memory, exploration, and daily routines
14. **Villager needs** - Villagers have same needs system as player with daily variance
15. **Villager death** - Villagers die when needs reach zero and become permanent corpses
16. **Villager storage** - Villagers use personal and communal storage boxes
17. **Villager fire management** - Villagers collect wood and add to camp fires
18. **Debug system** - Toggle debug mode to see villager states, tasks, and exploration radius
19. **Ground texture** - Subtle ground texture using Perlin noise for better navigation
20. **Large world** - Expanded world to 10x viewport size for better exploration
21. **Day/Night cycle** - Dynamic lighting changes based on time of day
22. **Cooking system** - Players and villagers can cook food near fires
23. **Storage system** - Complete storage interface with transfer functionality
24. **Sleeping system** - Sleep until 8:00 AM with time acceleration

### ✅ Game Complete: All Features Implemented
The game is now fully functional with all planned features implemented. Resource propagation ensures long-term sustainability while preventing overpopulation.

This plan prioritizes the core gameplay loop while maintaining flexibility for the 1-day timeline. The modular structure allows for easy iteration and debugging.