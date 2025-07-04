---

## Game Design Document: Alpine Sustainability

### I. Core Concept

**V1 (Current):** The game centers on **sustainability** in a low-fantasy world inspired by the Alps. Players must manage their needs (temperature, water, calories, vitamins) while interacting with a shared, finite world. The core dynamic explores the tension between personal survival and the well-being of other inhabitants, with the implicit goal of not driving the environment out of balance. The game world is not small; it takes at least 5 minutes of walking to reach an edge.

**V2 (Future):** The game evolves into a **mystery of survival** where players must learn through observation and experimentation. Every seed generates a unique world with different nutritional properties, poisonous plants, and survival strategies. The core gameplay becomes about **following your neighbors to learn from them** - observing what they eat, when they get sick, and why certain resources thrive or die out. Players must replay each seed multiple times to discover the secrets of survival and help their community thrive.

---

### II. Technical Specifications

* **Platform:** Widescreen computers and laptops.
* **Input:** Mouse and keyboard (WASD for movement, mouse for interaction).
* **Technology Stack:** HTML/CSS/JS with **Phaser 3** for game engine and rendering. All game objects are rendered as emoji text sprites using Phaser's text system. UI elements are handled through Phaser's native UI components.
* **Game Session:** Single-player, single-session. No save or load functionality in V1.
* **Random Seed:** Every game uses a random seed, displayed on-screen. V2 will allow loading games from a specific seed. An empty seed input will result in a random seed, which will then be displayed. Default seed is 23.

---

### III. Game World & Environment

* **Setting:** A low-fantasy world inspired by the Alps.
* **Technology Level:** Pre-agricultural, low-tech. No magic.
* **Visuals:**
    * **V1:** All in-game objects rendered as **emojis** using Phaser 3 text sprites (simple, maintainable approach).
    * **V2:** Pixel art with a slightly eerie, somber aesthetic. Color palette emphasizes darker, bluer, and less saturated tones, akin to *Gothic 1* with the greys and greens of the Alps.
* **Map Structure:**
    * **Village:** At the center with a communal well and a large communal storage box (size: 20).
    * **Camps:** Seven camps surround the village. Each camp contains a fireplace, a sleeping bag, and a personal storage box (size: 4).
    * **Wells:** Other wells are sparsely distributed across the map, approximately 2 minutes walking distance from each other and from the village.
    * **Initial Map Size:** 3-4 screens width/height (configurable), expanding to 20+ screens in any direction for V2.
* **Resource Generation:**
    * **V1:** Three food plants of each type per villager (including the player) are randomly spawned in a general, believable pattern (Perlin noise) outside the village. Trees are also present and can be harvested for wood.
    * **V2:** Biomes will be introduced for more detailed distribution.
    * **Resource Cap:** Global cap of 10 animals and 10 plants per villager for now.
    * **Spawn & Spread:** Animals and plants spawn near the village at low density, but in groups, slowly spreading out. The intent is a "decent stock but decreasing as I venture out" vibe.
    * **Propagation:** If there are 2 plants or animals within a certain radius, they have a chance of spawning a third one overnight, but not if there are too many others nearby. This allows for slow growth into stability if the player does not intervene. The exact radius for propagation will be determined during development.
* **Wells:** Limited capacity. Each well starts with 10 water portions and refills 4 portions per day.

---

### IV. Characters & Needs

* **Player Character:** You spawn next to your camp.
* **Villagers:**
    * Seven villagers, one per camp (excluding the player's camp). Each villager has a randomly generated first name from a 100-long list.
    * Villagers have the same hidden needs (temperature, water, calories, vitamins) as the player.
    * Villagers die when any of their hidden bars reach zero. Their **corpse** remains at the location of death and does not decompose.
    * Their name and **happiness/health emoji** will float above them.
    * **Memory System:** Villagers remember where they found resources and will return to known locations. They only explore new areas when they don't know of any food in their current area. Each villager starts with knowledge of some nearby food sources.
* **Needs (Player & Villagers):**
    * **Temperature:** Increases slowly during the day, decreases quickly at night unless near a burning fire, where it also increases back to full.
    * **Water:** Can only be drunk directly from wells. Cannot be carried.
    * **Calories:** Depleted by activity.
    * **Vitamins (A-E):** Five distinct vitamins. Each food type provides some calories and 1-2 specific vitamins. To meet all vitamin needs, a player will need to find at least 4 different food types per day.
* **Game End Condition:** The game ends when any of the player's visible bars (temperature, water, calories, vitamins) reaches zero. The game does NOT end if all other villagers die. If multiple bars reach zero simultaneously, the exact trigger does not matter; the player is considered dead.

---

### V. Gameplay Mechanics

* **Movement:**
    * **V1:** WASD for movement with basic collision detection. Villagers use directional movement with simple obstacle avoidance.
    * **V2:** Blockers and basic pathfinding for villagers.
* **Interaction:**
    * **Left-click:** Collect/use.
    * **Right-click:** Secondary action (e.g., eating when near a fire).
    * If a player attempts to use a sleeping bag, fireplace, or other resource that is occupied by a villager, the interaction will result in a "busy" message.
* **Inventory:** Minecraft-style hotbar, size 6, at the bottom of the screen. Simple click-to-move between inventory and storage boxes (no drag & drop).
* **Resources:**
    * **Food:** 10 categories of food, including specific examples like Blackberries and Rabbits.
    * Animals run away from players and other villagers at 80% movement speed.
    * Food can only be eaten when near a burning fire. You cannot eat if too far away from a burning fire.
    * **Wood:** Harvested from trees, works like any other plant resource. Used to fuel fires.
* **Fires:**
    * Require wood to burn (1 wood per day).
    * Can store a maximum of 2 wood.
    * Its state (burning, out of wood) should be visible on its sprite.
    * A fire that runs out of wood cannot be rekindled ever.
* **Sleeping:** At your sleeping bag, you can "sleep," which speeds up time until 08:00, passing within 10 seconds.
* **Storage Boxes:** All personal and communal storage boxes are available to both the player and all villagers. However, villagers prioritize their own box for both storing and retrieving items and will not "rob" the player unless necessary. If a villager's personal storage box and the communal box are both full, excess resources will remain in their inventory for consumption if needed.

---

### VI. Villager AI & Routines

* **Daily Routine:**
    * Driven by a **real-time clock** that also controls the time of day visually (blue-ish and darker at night, with transitions in the morning and evening).
    * **Time Scale:** 1 game day = 10 minutes real time (massively accelerated).
    1.  **Wake up:** 08:00
    2.  **Eat and drink** (if needed).
    3.  **Forage:** Go into the wilderness to forage for both food (to maximize carrying capacity, up to 4 food items) and wood (always bringing a maximum of 2 wood, leaving at least one inventory slot for wood).
    4.  **Return to camp:** 18:00 (or earlier if all slots are full). They will go home even if empty or half-empty at 18:00.
    5.  **Eat and drink** (if needed).
    6.  **Restock Fire:** Put 1 wood into their camp's fireplace.
    7.  **Sleep.**
* **Resource Management:**
    * Villagers are "smart": they prefer their own personal storage box, sleeping bag, and fireplace. If these are unavailable (e.g., already in use by another villager), they will attempt to use another nearby one. Each can only be used by one villager at a time.
    * After eating at night, villagers will place any leftover resources from their personal inventory into their personal storage box (size: 4).
    * Any other resources will be placed into the communal storage box (size: 20).
* **AI Update Frequency:** Every frame for V1 (can be optimized later).

---

### VII. User Interface (UI)

* **Top Right:** Current day, current time, "**Neighbours: x**" (counts only living villagers).
* **Top Left:** Bars for Temperature, Water, Calories, and 5 Vitamins (A to E) - instant updates, no animations.
* **Bottom:** Player inventory hotbar (Minecraft style, size 6).
* **Bottom Right:** Seed selection UI.
    * Defaults to a fixed seed (23).
    * Allows any integer input.
    * Leaving empty selects a random seed (displayed for the next game).
    * "New Game" button next to it.

---

### VIII. Game Dynamic & Vibe

* **V1 Expected Dynamic:** The player attempts to survive by any means, which can inadvertently lead to the demise of other villagers (through resource depletion from communal/personal boxes or over-harvesting of plants and animals).
* **V1 Vibe:** Slightly eerie, somber. More purgatory than a full-on fight for survival or a happy fantasy adventure.

* **V2 Expected Dynamic:** The player becomes a **detective of survival**, observing patterns in villager behavior, resource growth, and environmental changes. Each seed presents unique challenges that require multiple playthroughs to understand. The goal shifts from simple survival to **community sustainability through knowledge**.
* **V2 Vibe:** Mysterious, contemplative. A puzzle game disguised as a survival game, where the real challenge is understanding the world's hidden rules.

---

### IX. Implementation Philosophy

* **Dead-simple approach:** Prioritize readability and maintainability over optimization. Optimize only when needed.
* **Minimal project structure:** Separate code into logical modules but avoid over-engineering.
* **Basic error handling:** Use assert-like error logs for unexpected states.
* **Configurable parameters:** Make key values easily adjustable for balancing.

---

### X. Future Enhancements (V2)

#### Core V2 Concept: "Learning Through Observation"

**The Mystery of Survival:**
* **Procedural Nutrition:** Every seed generates different nutritional properties for all resources. What's healthy in one world might be poisonous in another.
* **Villager Behavior Patterns:** Villagers develop unique eating habits and survival strategies based on what works in their world. Players must observe these patterns to learn.
* **Environmental Clues:** Resource growth rates, animal behavior, and seasonal changes provide hints about what's safe to eat and when.
* **Multiple Playthroughs Required:** Each seed requires 3-5 playthroughs to fully understand the survival mechanics of that specific world.

**Enhanced Villager AI:**
* **Learning Villagers:** Villagers remember what made them sick and what kept them healthy, developing preferences over time.
* **Behavioral Clues:** Villagers show visible symptoms when eating poisonous food, helping players identify dangerous resources.
* **Social Learning:** Villagers can learn from each other's successes and failures, creating emergent survival strategies.
* **Personality Traits:** Each villager has unique risk tolerance and learning speed, affecting their survival strategies.

**Advanced Resource System:**
* **Dynamic Nutrition:** Food properties change based on season, location, and preparation method.
* **Poisonous Variants:** Some resources have poisonous variants that look identical to safe ones.
* **Growth Patterns:** Resources grow and die based on complex environmental factors that players must learn to predict.
* **Seasonal Changes:** Different resources become available or dangerous based on the time of year.

**Knowledge System:**
* **Observation Journal:** Players can record observations about villager behavior and resource properties.
* **Hypothesis Testing:** Players can test theories about what's safe to eat by observing villager reactions.
* **Community Knowledge:** Successful strategies can be shared with villagers through specific actions.
* **Discovery Rewards:** Finding the optimal survival strategy for a seed unlocks special insights.

**Conversation System
* **LLM-driven chat:** You can talk to NPCs to learn about what they are doing and why. They might not always have all information or understand exactly why they are doing things but they will not lie to you either.

**Technical Enhancements:**
* Ability to load a game from a specific random seed.
* Pixel art visuals and refined color palettes.
* Music and SFX.
* Collision detection for movement.
* Basic pathfinding for villagers.
* Biomes with unique environmental rules.
* Expanded map size (20+ screens in any direction).
* Advanced UI for observation and note-taking.
* Replay system to review past attempts at the same seed.

**V2 Success Metrics:**
* Players willingly replay the same seed multiple times to discover its secrets.
* Emergent storytelling through villager behavior and community survival.
* Each seed feels like a unique puzzle to solve rather than a generic survival challenge.
* Players develop genuine attachment to their villagers and community.

---

### XI. V1 vs V2 Comparison

| Aspect | V1 (Current) | V2 (Future) |
|--------|--------------|-------------|
| **Core Goal** | Survive and manage resources | Learn the world's secrets through observation |
| **Replayability** | Different seeds = different layouts | Same seed = multiple playthroughs to understand |
| **Villager Role** | Resource competition and community management | Teachers and subjects of observation |
| **Resource System** | Fixed nutritional properties | Procedurally generated properties per seed |
| **Player Agency** | Direct survival actions | Detective work and hypothesis testing |
| **Success Condition** | Survive as long as possible | Discover optimal survival strategy for the community |
| **Learning Curve** | Learn game mechanics once | Learn unique world rules for each seed |
| **Emotional Investment** | Resource management tension | Community building and discovery satisfaction |

---
