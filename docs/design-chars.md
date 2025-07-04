# Character Emoji System

Villagers and the player character should display their current state through appropriate emoji sprites rather than using a single static sprite.

## State-Based Emoji Actions

| State | Emoji | Description |
|-------|--------|-------------|
| **Standing** | 🧍 | Standing person (default idle state) |
| **Running** | 🏃‍♂️ / 🏃‍♀️ | Running person (direction-based variants) |
| **Sleeping** | 🧘 | Sitting cross-legged (sleep state) |

**Note:** If left/right running variants aren't available, flip the sprite horizontally for directional movement.

## Character Customization

### Randomization on Game Start

1. **Skin Tone Selection**
   - Pick random skin tone modifier: `🏻🏼🏽🏾🏿`
   - Apply consistently to all characters

2. **Gender Variant Selection** 
   - Pick random gender variant: `♂️♀️` + gender-neutral option
   - Apply to both player character and all villager NPCs

### Implementation Requirements

- All characters use the same randomization seed for consistency
- Skin tone and gender variants applied uniformly across the game
- State changes trigger appropriate emoji updates
- Directional movement uses flipped sprites when needed
