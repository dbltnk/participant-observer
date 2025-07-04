# TO BE IMPLEMENTED: Villager State Machine Design

## Basic Info
- **NPC Type:** Villager
- **Knowledge:** Perfect awareness of all world resources and chest contents
- **Inventory:** Always reserve 2 slots for wood, 4 slots for food
- **Sleep Schedule:** 22:00-07:00 (±1h daily variation on both ends)
- **PRIME DIRECTIVE:** Never take the last resource of any type within 400 unit range (overrides all other needs)
- **Storage:** Own chest (4 slots) → Community chest (20 slots) when own is full
- **Fire Ownership:** Each villager has their own fireplace (0-10 logs capacity)

## Implementation Details
- **Evaluation:** Check state transitions every frame
- **Actions:** All resource gathering/usage is instant (no duration)
- **Coordination:** No resource claiming/reservation needed
- **Movement:** No pathfinding system, but states can have "going to X" sub-states if helpful
- **Multiple Emergencies:** Always deal with the current emergency first, only then can the next one be solved

## State Machine

### Priority Order & State Details

#### 1. Sleep (Highest Priority)
- **Enter:** Time in sleep window (21:00-23:00 to 06:00-08:00, daily variation)
- **Behavior:** Stay at own sleeping bag
- **Emergency Interrupts:** Water <20%, Calories <20%, Temperature <20% can wake villager
- **Exit:** Time outside sleep window OR emergency resolved and return to sleep if still sleep time

#### 2. Emergency Drink (Hard Interrupt)
- **Enter:** Water <20%
- **Behavior:** Go to nearest water source → drink until >50%
- **Exit:** Water stat >50%

#### 3. Emergency Eat (Hard Interrupt)
- **Enter:** Calories <20%
- **Behavior:**
  - Go to own fireplace (or nearest if own unavailable)
  - Get food: inventory → own chest → community chest → other villagers' chests → forage
  - Eat while near fireplace until satisfied
- **Exit:** Calories satisfied

#### 4. Emergency Warm Up (Hard Interrupt)
- **Enter:** Temperature <20%
- **Behavior:** Go to nearest burning fire (prefer own) → stay until 100% warm
- **Exit:** Temperature = 100%

#### 5. Emergency Fire Refill (Hard Interrupt)
- **Enter:** Own fireplace <3 logs
- **Behavior:** Gather wood → refill own fire to at least 5 logs
- **Fallback:** If own fireplace unreachable/destroyed, use nearest available fire
- **Exit:** Target fireplace ≥5 logs

#### 6. Regular Drink (Normal Need)
- **Enter:** Water <50%
- **Behavior:** Go to nearest water source → drink until >50%
- **Exit:** Water stat >50%

#### 7. Regular Warm Up (Normal Need)
- **Enter:** Temperature <70%
- **Behavior:** Go to nearest burning fire (prefer own) → stay until 100% warm
- **Exit:** Temperature = 100%

#### 8. Regular Eat (Normal Need)
- **Enter:** Calories <60%
- **Behavior:**
  - Go to own fireplace (or nearest if own unavailable)
  - Get food: inventory → own chest → community chest → forage (no stealing from other villagers)
  - Eat while near fireplace until satisfied
- **Exit:** Calories satisfied

#### 9. Regular Fire Refill (Normal Need)
- **Enter:** Own fireplace <10 logs AND no higher priority needs
- **Behavior:** Gather wood → refill own fire to 10 logs
- **Fallback:** If own fireplace unavailable, maintain nearest fire instead
- **Exit:** Target fireplace = 10 logs

#### 10. Storage Management (Village Task)
- **Enter:** In village + carrying unneeded items + no higher priorities
- **Behavior:** Put items in own chest → community chest if own chest full
- **Exit:** All items stored OR higher priority need triggers

#### 11. Idle (Default State)
- **Enter:** No other needs/tasks
- **Behavior:** Stay near own fire (or nearest if own unavailable)
- **Exit:** Any higher priority state triggers