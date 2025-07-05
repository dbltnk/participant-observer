# Participant Observer - Implementation Plan

## Game Overview
**Participant Observer** is a resource management game where players and AI villagers must survive in an alpine environment by managing their needs (hunger, thirst, warmth, rest, health) while collecting and managing resources.

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
- ✅ Well interaction: drink from wells to restore water (50 points per drink)
- ✅ Task prioritization: water first, then food, then wood collection

### Phase 5: Game Mechanics ✅ COMPLETED - FULLY FUNCTIONAL
1. ✅ Implement food eating system (players and villagers can only eat food near burning fires)
2. ✅ Add fire management (players and villagers can add wood to fires)
3. ✅ Create storage system (players and villagers can use storage boxes)
4. ✅ Add sleeping mechanics (players can sleep to skip night)
5. ✅ Implement resource propagation (SIMPLIFIED SYSTEM - CHILD/ADULT GROWTH)
6. ✅ Add player interactions with all objects

**Fully Functional Game Mechanics:**
- ✅ **Food Eating System**: Players and villagers can only eat food near burning fires
- ✅ **Fire Management**: Add wood to fires, fires burn and provide warmth
- ✅ **Storage System**: Personal and communal storage boxes with transfer interface
- ✅ **Sleeping System**: Sleep until 8:00 AM with time acceleration
- ✅ **Food Nutrition**: Different foods provide different calories and vitamins
- ✅ **Food Nutrition**: All food provides full nutrition when eaten near a burning fire
- ✅ **Debug System**: Toggle debug mode to see interaction circles and object info
- ✅ **Object Interactions**: All objects (wells, fires, sleeping bags, storage) are interactive
- ✅ **Inventory Management**: Click slots to eat food or transfer items
- ✅ **Villager AI Integration**: Villagers use all the same mechanics as players
- ✅ **Day/Night Lighting**: Dynamic lighting changes based on time of day
- ✅ **Ground Texture**: Subtle ground texture using Perlin noise for better navigation
- ✅ **Resource Propagation**: Simplified child/adult growth system with configurable caps

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
13. **Well interaction** - Click wells to drink and restore water (50 points per drink)
14. **Villager AI** - 7 AI villagers with complete daily routines and needs management
15. **Villager memory** - Villagers remember resource locations and return to known areas
16. **Villager exploration** - Villagers explore new areas when no known resources nearby
17. **Villager death** - Villagers die when needs reach zero and become permanent corpses
18. **Villager storage** - Villagers use personal and communal storage boxes
19. **Villager fire management** - Villagers collect wood and add to camp fires
20. **Debug system** - Toggle debug mode to see villager states, tasks, exploration radius, and object info
21. **Ground texture** - Subtle ground texture using Perlin noise for better navigation
22. **Fire interaction** - Add wood to fires, eat food near burning fires
23. **Sleeping system** - Sleep at sleeping bags to skip night and restore needs
24. **Storage system** - Transfer items between inventory and storage boxes
25. **Food mechanics** - Eat food for full nutrition when near a burning fire
26. **Debug visualization** - See interaction distance circles and object status when debug is enabled
27. **Day/Night cycle** - Dynamic lighting changes based on time of day
28. **Large world** - 10x viewport size world for exploration
29. **Tree generation** - 50 trees scattered across the world for wood supply
30. **Resource propagation** - Resources spawn children that grow to adults over 2 days

## Core Architecture

### 1. Game State Management ✅ IMPLEMENTED
**Approach:** Scene-local state management with Phaser 3 integration.

**✅ IMPLEMENTED:**
- Complete state management with needs, inventory, time, and game over conditions
- Player and villager state tracking
- Entity management system
- Debug mode toggle

### 2. Game Loop Architecture ✅ IMPLEMENTED
**Approach:** Phaser 3 scene-based game loop with built-in deltaTime handling.

**✅ IMPLEMENTED:**
- 10-minute game days (600 seconds real time = 1 game day)
- Day/night cycle with dynamic lighting
- Needs decay system with daily variance
- Time acceleration for sleeping
- Reliable day tracking for propagation

### 3. World Generation System ✅ IMPLEMENTED
**Approach:** Perlin noise-based generation with configurable parameters, integrated into Phaser scene.

**✅ IMPLEMENTED:**
- Complete world generation with village center, camps, resources, wells
- Ground texture using Perlin noise for better navigation
- Large world (10x viewport size) for exploration
- Random seed system with editable input
- Collision detection for resource placement

### 4. Villager AI System ✅ IMPLEMENTED
**Approach:** State machine with memory-based decision making.

**✅ IMPLEMENTED:**
- Complete AI with exploration, resource collection, camp management
- Memory system for known resource locations
- Exploration radius with new area discovery
- State machine for different tasks (explore, collect, return, rest)
- Death handling with permanent corpses
- Storage and fire management integration

### 5. Resource System ✅ FULLY IMPLEMENTED
**Approach:** Entity-based system with child/adult growth and configurable caps.

**✅ IMPLEMENTED:**
- Child/Adult System: Resources spawn as children (smaller) and grow to adults (normal size)
- Configurable Caps: 10 for regular resources, 50 for trees
- Daily Propagation: Once per day at midnight with reliable day tracking
- Visual Feedback: Children are 16px, adults are 22px
- Tree Generation: 50 trees scattered across the world initially
- Position finding with collision avoidance

### 6. UI System ✅ COMPLETED
**Approach:** Phaser-native UI with comprehensive functionality.

**✅ IMPLEMENTED:**
- Complete UI with need bars, time display, inventory, seed management
- Real-time updates for all player and villager states
- Debug panel with villager information and object details
- Interaction distance visualization
- Seed input with confirmation dialogs

### 7. Interaction System ✅ COMPLETED
**Approach:** Click-based interactions with distance checking.

**✅ IMPLEMENTED:**
- Complete interaction system with distance checking
- Object-specific actions (wells, fires, sleeping bags, storage)
- UI feedback for all interactions
- Inventory management with slot clicking
- Food eating near burning fires only

### 8. Configuration System ✅ COMPLETED
**Approach:** Centralized config object for easy balancing.

**✅ IMPLEMENTED:**
- All game parameters in single config file
- Easy balancing of needs decay rates, time acceleration, resource caps
- Configurable villager behavior and world generation
- Debug settings and UI parameters

## Key Implementation Details

### Error Handling Strategy ✅ IMPLEMENTED
**✅ IMPLEMENTED:**
- Assert system throughout codebase for debugging
- Graceful error handling with informative messages
- Development-friendly error reporting
- Input validation and bounds checking

### Performance Considerations ✅ IMPLEMENTED
**✅ IMPLEMENTED:**
- Smooth 60fps with requestAnimationFrame
- DeltaTime capping to prevent large jumps (200ms max per frame)
- Efficient villager AI updates with goal persistence
- Optimized rendering with Phaser 3

### Memory Management ✅ IMPLEMENTED
**✅ IMPLEMENTED:**
- Clean up event listeners on game restart
- Clear villager memory when they die
- Remove collected resources from world
- Efficient memory system for villager resource locations

### Testing Strategy ✅ IMPLEMENTED
**✅ IMPLEMENTED:**
- Browser console debugging
- Leverage existing logging system
- Verify seed consistency
- Test edge cases (villager death, resource depletion)
- Debug mode for villager behavior observation

## Success Criteria

### Minimum Viable Product ✅ COMPLETED
- ✅ Player can move and collect resources
- ✅ Basic needs system works with daily variance
- ✅ Villagers exist and move around with complete AI
- ✅ Game ends when player dies with specific death messages
- ✅ Seed system works with randomization and persistence

### Stretch Goals ✅ COMPLETED
- ✅ Villager memory system
- ✅ Resource propagation 
- ✅ Complete UI with all features
- ✅ Basic balancing (needs decay rates, time acceleration)
- ✅ Error handling with assert system
- ✅ Complete object interactions

### ✅ Game Complete: All Features Implemented
The game is now fully functional with all planned features implemented. Resource propagation ensures long-term sustainability while preventing overpopulation.

This plan prioritizes the core gameplay loop while maintaining flexibility for the 1-day timeline. The modular structure allows for easy iteration and debugging.