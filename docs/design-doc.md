# Participant Observer - Design Document

## The Big Vision: Full Game

**Setting:** Sci-fi survival mystery on an alien planet after civilization's collapse. Emergency escape pods scattered survivors across a hostile landscape. The player is stranded and must master both movement techniques and resource management to explore distant landmarks that reveal the planet's secrets and other survivors' fates.

**Core Gameplay:** Players are attracted by far-away points of interest (like in Tears of the Kingdom) that reveal new background story. Progress requires mastering advanced nutrition, medicine crafting, terrain navigation, and water source mapping - knowledge shared by NPCs who have adapted to this hostile world.

**Social Learning:** This is fundamentally about learning from others instead of going it alone. Players first explore independently and fail, then learn to watch their neighbors and imitate successful strategies, then learn from neighbors when they actively teach, and ultimately surpass their neighbors' knowledge by innovating on their own. Later, this could expand to learning from other human players in a shared world.

**Sustainability Requirement:** Interacting with the environment has a sustainability requirement - you can easily bring the ecosystem out of balance if you do not make sure to fit in. Over-harvesting, disrupting animal populations, or ignoring resource regeneration patterns can collapse the local environment, making survival impossible for everyone.

**The Mystery:** Every seed generates a unique world with different nutritional properties, poisonous plants, terrain challenges, and survival strategies. Players must replay each seed multiple times to discover the secrets of survival and help their community thrive.

**End Goal:** Discover other human players' remnants (Death Stranding-style) and potentially find living survivors, all while uncovering the tragic story of their civilization's exodus and the planet's mysterious properties that both threaten and sustain human life.

---

## What We've Built: Representative Prototype

### ✅ Core V2 Features Implemented

**Procedural Nutrition per Seed**
- Every seed generates different nutritional properties for all resources
- What's healthy in one world might be poisonous in another
- Players must learn through observation and experimentation

**Social Learning Foundation**
- **Gates as Terrain Learning**: Deadly gates teach players about dangerous navigation through villager behavior
- **Resource Collection Patterns**: Villagers show "Golden Rule" foraging (only collect when 3+ resources in area)
- **Animal Speed Learning**: Animals have variable speeds - players learn which are catchable by watching villagers
- **Water Source Discovery**: Players learn well locations and regeneration patterns from villager behavior

**Advanced Villager AI**
- **Hierarchical State Machine**: 4 goals (survive, maintain, contribute, rest) with complex decision making
- **Emergency vs Regular Behavior**: Different thresholds trigger different survival strategies
- **Resource Memory**: Villagers remember successful locations and return to known areas
- **Collection Batching**: Smart resource gathering with batch sizes and target invalidation

**World Generation & Navigation**
- **A* Pathfinding**: Full navigation system with grid-based pathfinding and collision detection
- **Biome System**: 7 biomes with temperature-based resource spawning
- **Wall & Gate System**: Procedural walls with deadly gates for terrain learning
- **Line of Sight**: Fog of war system that hides distant areas

**Professional UI/UX**
- **Intro Scene**: Sci-fi survival mystery with planet names and survivor logs
- **Outro Scene**: Detailed death screen with vital signs and cause of death
- **Smoke Indicator**: Directional pointer to distant points of interest
- **Debug Visualization**: Pathfinding and system state visualization

### ❌ V2 Features We Left Out

**Villager Learning & Teaching**
- No villager memory of what made them sick
- No visible symptoms from poisonous food
- No villagers learning from each other's successes/failures
- No personality traits affecting survival strategies
- No active teaching from villagers to players

**Advanced Resource System**
- No seasonal changes affecting resource availability
- No dynamic nutrition based on preparation method
- No poisonous variants that look identical to safe ones
- No complex growth patterns based on environmental factors

**Knowledge System**
- No observation journal for players
- No hypothesis testing mechanics
- No community knowledge sharing
- No discovery rewards for optimal strategies

**Conversation System**
- No LLM-driven chat with NPCs
- No way to ask villagers about their strategies

---

## Technical Foundation

**Platform:** Widescreen computers/laptops with mouse/keyboard input
**Engine:** HTML/CSS/JS with Phaser 3, emoji-based rendering
**Architecture:** Config-driven with comprehensive logging and assert system
**Performance:** Spatial partitioning, update intervals, caching optimizations

**Key Systems:**
- Seeded random generation for consistent worlds
- Hierarchical AI with goal-action state machines
- A* pathfinding with collision detection
- Procedural resource generation with nutrition per seed
- Comprehensive config system (851 lines in GameConfig.js)

---

## Current Status: V1.5

We've built a **survival game with advanced AI and world generation** that includes many V2 learning mechanics. The foundation for "learning through observation" is there - players can learn from villager behavior about gates, resources, and navigation. However, we're missing the deeper mystery elements and villager teaching systems that would make it a true "detective game disguised as survival."

The prototype successfully demonstrates the core social learning concept while maintaining the technical foundation needed for the full vision.
