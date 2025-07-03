# Alpine Sustainability - Implementation Plan

## Project Structure

```
sustain/
├── index.html          # Main game page ✅ COMPLETED
├── phaser-main.js      # Phaser 3 main entry point ✅ COMPLETED
├── config/
│   └── GameConfig.js   # All configurable game parameters ✅ COMPLETED
├── logs/               # Browser logging system ✅ PRESERVED
└── ...
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

### Phase 4: Villager AI 🔄 NOT STARTED
1. 🔄 Create villager class
2. 🔄 Implement state machine
3. 🔄 Add memory system
4. 🔄 Create foraging behavior
5. 🔄 Implement basic pathfinding

### Phase 5: Game Mechanics 🔄 NOT STARTED
1. 🔄 Implement cooking system
2. 🔄 Add fire management
3. 🔄 Create storage system
4. 🔄 Add sleeping mechanics
5. 🔄 Implement resource propagation

### Phase 6: Polish & UI ✅ COMPLETED
1. ✅ Complete UI implementation with all elements
2. ✅ Add robust seed system with randomization
3. ✅ Implement game over conditions
4. ✅ Add comprehensive error handling
5. ✅ Test and balance core systems

## Current Status: PHASE 3 COMPLETE - READY FOR PHASE 4 (VILLAGER AI)

**What you can test right now:**
1. **Game loads** - Open index.html, game initializes with random seed
2. **Player movement** - Use WASD to move the player character (👤) with smooth movement
3. **World rendering** - See village (🏘️), camps (🏕️), wells (💧), resources (🫐🍄🌿🐰🦌🌲)
4. **UI elements** - Need bars with numbers, time display with emojis, inventory slots, seed management
5. **Time system** - Game time advances properly (10 minutes real time = 1 game day)
6. **Needs decay** - Player needs decrease over time with daily variance
7. **Game over** - If any need reaches 0, game ends with specific death message
8. **Seed system** - Random seed on first load, editable seed input, confirmation dialogs
9. **Logging** - Browser console and server logs capture everything
10. **Performance** - Smooth 60fps with deltaTime capping to prevent large jumps
11. **Resource collection** - Click on resources to collect them into inventory
12. **Inventory management** - Click slots to select, right-click to remove items
13. **Well interaction** - Click wells to drink and restore water

**Known limitations for current test:**
- No villager AI yet (villagers don't exist)
- No cooking, fires, or storage system yet
- No sleeping mechanics yet
- Resource propagation not implemented yet

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

### 4. Villager AI System 🔄 NOT IMPLEMENTED
**Approach:** State machine with memory-based decision making.

```javascript
// Villager.js - AI system (PLANNED)
class Villager {
    constructor(name, campPosition) {
        this.name = name;
        this.campPosition = campPosition;
        this.state = 'SLEEPING';
        this.memory = {
            knownFoodLocations: [], // Array of {x, y, resourceType}
            knownWoodLocations: [],
            lastKnownPosition: null
        };
        this.needs = {temperature: 100, water: 100, calories: 100, vitamins: [100, 100, 100, 100, 100]};
        this.inventory = new Array(6).fill(null);
    }
    
    update(deltaTime) {
        this.updateNeeds(deltaTime);
        this.updateState();
        this.executeCurrentState(deltaTime);
    }
    
    updateState() {
        const time = gameState.currentTime;
        const hour = (time % 86400) / 3600; // Convert to hours
        
        if (hour >= 8 && hour < 18 && this.state === 'SLEEPING') {
            this.state = 'FORAGING';
        } else if (hour >= 18 && this.state === 'FORAGING') {
            this.state = 'RETURNING';
        } else if (this.state === 'RETURNING' && this.isAtCamp()) {
            this.state = 'EATING';
        } else if (this.state === 'EATING' && this.needs.calories > 80) {
            this.state = 'SLEEPING';
        }
    }
    
    executeCurrentState(deltaTime) {
        switch (this.state) {
            case 'FORAGING':
                this.forage();
                break;
            case 'RETURNING':
                this.moveTowards(this.campPosition);
                break;
            case 'EATING':
                this.eatAndDrink();
                break;
            case 'SLEEPING':
                this.sleep();
                break;
        }
    }
    
    forage() {
        // Check memory first
        const knownLocation = this.findNearestKnownFood();
        if (knownLocation) {
            this.moveTowards(knownLocation);
            if (this.isNear(knownLocation)) {
                this.collectResource(knownLocation);
            }
        } else {
            // Explore new area
            this.explore();
        }
    }
}
```

### 5. Resource System 🔄 PARTIALLY IMPLEMENTED
**Approach:** Entity-based system with type-specific behavior.

```javascript
// Resources.js - Resource management (PLANNED)
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
        width: 1200,
        height: 800,
        tileSize: 32,
        villagerCount: 7,
        resourcesPerVillager: 3,
        maxResourcesPerType: 10
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
        vitamins: 12      // 12 in-game hours to empty (reduced for better visibility)
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
        explorationRadius: 200,
        foragingEfficiency: 0.8
    },
    
    // Resource settings
    resources: {
        propagationRadius: 100,
        propagationChance: 0.1,
        maxDensity: 5 // max resources per area
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

### Memory Management ✅ IMPLEMENTED
- ✅ Clean up event listeners on game restart
- 🔄 Clear villager memory when they die (when villagers are implemented)
- 🔄 Remove collected resources from world (when collection is implemented)

### Testing Strategy ✅ IMPLEMENTED
- ✅ Use browser console for debugging
- ✅ Leverage existing logging system
- ✅ Verify seed consistency
- 🔄 Test edge cases (villager death, resource depletion) - when implemented

## Success Criteria

### Minimum Viable Product ✅ COMPLETED
- ✅ Player can move and collect resources (movement implemented, collection pending)
- ✅ Basic needs system works with daily variance
- 🔄 Villagers exist and move around (not implemented yet)
- ✅ Game ends when player dies with specific death messages
- ✅ Seed system works with randomization and persistence

### Stretch Goals 🔄 IN PROGRESS
- 🔄 Villager memory system
- 🔄 Resource propagation
- ✅ Complete UI with all features
- ✅ Basic balancing (needs decay rates, time acceleration)
- ✅ Error handling with assert system

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

### 🔄 Next Priority: Phase 4 - Villager AI
The core infrastructure is now complete and stable with Phaser 3. The next major phase should focus on implementing the villager AI system to add life to the world and create the core gameplay dynamic of shared resources and competition.

This plan prioritizes the core gameplay loop while maintaining flexibility for the 1-day timeline. The modular structure allows for easy iteration and debugging.