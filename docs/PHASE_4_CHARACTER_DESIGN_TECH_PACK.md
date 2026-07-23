# My Mettle — Phase 4 Character and Embodied Visual System

_Status: accepted design and technical package. This document defines the intent, constraints and technical direction for Phase 4. It is deliberately not the step-by-step implementation plan; that will be written separately after this package is accepted._

## 1. Mission

Phase 4 will create a personalised, locally generated character system that allows My Mettle to represent the user’s body, identity and areas of attention without becoming anatomical software, a bodybuilding fantasy, a clinical body map, a generic game avatar or an AI portrait generator bolted onto the product.

The character is an **embodied interface**.

Its purpose is to connect abstract training information—focus, balance, engagement, readiness, progress and experimentation—to the user’s physical body in a way that feels intimate, intelligent and grounded.

The system should communicate primarily through:

- selective light;
- depth;
- regional clarity;
- painterly texture;
- controlled motion;
- posture;
- atmosphere.

It should not communicate by exposing muscles beneath the skin or deforming the body to represent unverified conclusions.

## 2. Core design proposition

> **The body remains honest and stable. Meaning is introduced through focus.**

The base character represents the user.

Lighting, contrast, depth, motion and contextual presentation explain what the application currently wants the user to notice.

This separates three kinds of truth.

### Morphological truth

What the user’s body approximately looks like:

- body proportions;
- softness;
- build;
- posture;
- hair;
- skin;
- identity details;
- stable accessories.

### Contextual truth

What part of the body the current information concerns:

- shoulders;
- upper back;
- chest;
- legs;
- a broad kinetic chain;
- one side of the body.

### Analytical truth

What MAIS currently believes, with uncertainty:

- one shoulder may contribute less;
- a region is progressing;
- a movement pattern may be a bottleneck;
- recovery may be relevant;
- an experiment is targeting a specific area.

Analytical truth must not silently modify morphological truth. A “weaker shoulder” is shown through attention, asymmetry of focus or supporting information—not by shrinking the shoulder.

## 3. Desired character experience

### Character direction

- Realistic, average or lightly active body.
- Natural softness retained.
- No compulsory athletic ideal.
- Boxer briefs only for reliable body visibility.
- Barefoot.
- Calm, slightly asymmetrical, lived-in posture.
- Neither slouched nor presenting the physique.
- Grounded, elegant and non-sexualised.
- Personal without requiring perfect biometric likeness.

### Rendering language

- Painterly-photographic hybrid.
- Form constructed through brush planes rather than photographic shading with a paint filter.
- Soft but controlled edges.
- Visible brush rhythm where useful.
- Strong broad form and restrained micro-detail.
- Subtle grain.
- Soft bloom.
- Deep but chromatically rich shadows.
- Premium editorial atmosphere.
- Clearer than an expressive oil study, but clearly illustrated rather than photoreal.

### Emotional tone

- Intimate.
- Powerful.
- Intelligent.
- Embodied.
- Calm under pressure.
- Never bro-y.
- Never medical.
- Never judgemental.
- Never aspirational by default.

## 4. Representation and personal identity

The system should prioritise **identity anchors** rather than attempting perfect full-body digital cloning.

Identity anchors may include:

- skin tone and undertone;
- body-shape characteristics;
- hairstyle;
- facial-hair style;
- body-hair level;
- thin necklace or chain;
- earrings;
- bracelet;
- ring;
- major tattoos;
- scars or birthmarks where deliberately included;
- boxer colour;
- habitual posture.

A thin silver chain is an ideal example. It is visually small but personally persistent. It can make the character feel inhabited rather than generic.

Accessories should be separate controllable layers wherever possible. A chain should not be baked permanently into every generated image if it can instead be represented by:

- an accessory texture;
- its own alpha;
- its own normal/specular response;
- a neck/chest anchor;
- a dedicated lighting pass.

That allows the chain to catch light, move slightly and remain consistent across poses.

## 5. Skin-tone requirements

The system must work across very light, South Asian, medium-brown and deep Black skin without treating lighter skin as the default technical case.

The renderer must not rely solely on skin luminance to reveal body form.

Legibility should come from:

- silhouette separation;
- surface orientation;
- warm/cool contrast;
- controlled background exposure;
- preserved shadow chroma;
- directional rim light;
- restrained specular response;
- local detail;
- selective focus.

### Rendering constraints

- Lighting calculations operate in linear colour.
- Shadows must not collapse to neutral black.
- Warm light must illuminate existing skin colour rather than painting pale orange over it.
- Specular highlights must be adjustable independently of diffuse brightness.
- Background exposure must respond to the character.
- Bloom must not bleach deeper skin.
- Skin-specific parameters should derive from the processed character asset, not crude ethnic categories.

Possible per-character calibration values:

```text
shadowFloor
backgroundSeparation
diffuseStrength
specularStrength
specularWidth
warmthBias
bloomThreshold
focusExposure
highlightHeadroom
```

HDR may enhance the rendering of deeper skin by allowing small highlights to rise without lifting the whole skin tone, but HDR is not a substitute for correct colour and lighting.

## 6. Character-creation capture flow

Phase 4 should initially use a guided photographic capture rather than attempting full 360° reconstruction.

A friend guides the camera while the user stands in several prescribed views.

### Required captures

- Front.
- Back.
- Left side.
- Right side.
- Front three-quarter.
- Back three-quarter.
- Head and shoulders.
- Hair detail.
- Optional accessory detail.
- Optional tattoo or identifying-mark detail.

The user should wear the same dark fitted boxer briefs intended for the final representation.

### Capture guidance

The interface controls or strongly guides:

- camera lens selection;
- subject distance;
- framing;
- exposure;
- focus;
- white balance;
- flash behaviour;
- body position;
- posture;
- background suitability.

Flash is acceptable as a consistency mechanism, but not assumed to produce neutral lighting. It will still create centre-weighted light, reflections and shadows.

The app should therefore prioritise **repeatability**, then correct the common lighting pattern afterwards.

A neutral grey or moderately light plain wall is preferable to pure white, but capture should tolerate ordinary homes rather than demanding studio conditions.

### Privacy requirement

These are highly sensitive body photographs.

The default policy should be:

- local processing;
- app-private encrypted storage;
- no automatic network transmission;
- explicit retention choice;
- immediate deletion option;
- source images separable from derived character assets;
- clear explanation of which assets are retained;
- ability to rebuild and then delete the source photographs.

The final character pack should not require the original photographs for normal use.

## 7. Pre-generation image processing

Captured views should be normalised before AI generation.

### Processing stages

1. **Quality selection**
   - Blur detection.
   - Framing validation.
   - Exposure checks.
   - Body visibility checks.
   - Duplicate rejection.

2. **Matting and segmentation**
   - Separate user from background.
   - Preserve hair edges.
   - Preserve jewellery where possible.
   - Generate stable alpha.

3. **Cross-view colour alignment**
   - Match white balance.
   - Match skin exposure.
   - Match background-neutral assumptions.
   - Reduce flash-distance variation.

4. **Illumination balancing**
   - Reduce broad brightness fall-off.
   - Lift overly dark limb shadows.
   - Compress sharp flash highlights.
   - Preserve skin colour and markings.

5. **Geometry preprocessing**
   - Pose landmarks.
   - Body segmentation.
   - Dense body correspondence.
   - Initial depth.
   - Initial normals.
   - Silhouette.

6. **Identity extraction**
   - Face reference.
   - Hair reference.
   - Body-shape constraints.
   - Skin palette.
   - Accessories.
   - Markings.

The original and balanced versions may both be retained temporarily during character generation. The balanced image gives controllable form; the original protects identity details that balancing may suppress.

## 8. One-time generative character creation

Generation happens as part of character setup, not during ordinary app use.

The goal is to produce a substantial reusable pose library once.

### Inputs

- Multiple captured views.
- Identity reference.
- Body-shape reference.
- Pose conditioning.
- Silhouette or segmentation conditioning.
- Depth/normal guidance where available.
- My Mettle style conditioning.
- Accessory specification.
- Negative constraints against athletic idealisation.

### Style control

The generation system should use a fixed style package rather than prompt wording alone.

That may eventually include:

- a My Mettle style LoRA or equivalent;
- fixed generation presets;
- pose/control conditioning;
- identity conditioning;
- seed families;
- denoising limits;
- rejection rules;
- automatic consistency scoring.

The generation model must be biased away from:

- bodybuilder physiques;
- narrow-waisted heroic bodies;
- permanent abdominal definition;
- fashion-model posing;
- sexualised framing;
- artificial studio glamour;
- photographic skin pasted beneath painterly texture.

### Generated pose groups

#### Neutral analytical views

- Front.
- Back.
- Left side.
- Right side.
- Front three-quarter.
- Back three-quarter.

#### Resting presence

- Relaxed standing.
- Slight weight shift.
- Seated.
- Head lowered or reflective.
- Neutral attentive stance.

#### Prepared states

- Slight forward readiness.
- Shoulder reset.
- Planted stance.
- Pre-session energy.

#### Exercise and movement context

- Pressing.
- Pulling.
- Squatting.
- Hinged.
- Unilateral work.
- Shoulder-focused.
- Back-focused.
- Leg-focused.
- Cropped region compositions.

#### Kinetic editorial frames

- Directional motion.
- Transition pose.
- Milestone pose.
- High-energy session opening.
- Post-session settling.

The first production target should be smaller than the final ambition:

- 12–20 core poses for the initial integrated system;
- 30–50 poses for a broader alpha pack;
- larger optional packs only after storage and consistency are understood.

Generating hundreds of poses before proving the rendering contract would waste time.

## 9. Pre- and post-stylisation geometry

Geometry should be estimated both before and after stylisation.

### Pre-stylisation maps

These preserve the structure of the original body and pose:

- segmentation;
- DensePose-like correspondence;
- depth;
- normals;
- landmarks;
- left/right body-region identity.

### Post-stylisation maps

These align with the final painted pixels:

- final alpha;
- final silhouette;
- image-space depth;
- image-space normals;
- region boundaries;
- accessory boundaries.

### Reconciliation

Pre-generation maps are the structural authority.

Post-generation maps provide pixel alignment.

The reconciliation system should:

- detect silhouette disagreements;
- preserve correct left/right identity;
- warp structural maps towards final imagery;
- fall back region-by-region;
- allow manual correction;
- reject generations with severe body or accessory drift.

Human correction is an accepted part of the early Phase 4 workflow. Fully automatic perfection is not required for the first personal alpha.

## 10. Runtime character asset contract

Each pose becomes a compact 2.5D asset bundle.

Possible structure:

```text
pose.json
colour.ktx2
alpha.ktx2
depth.ktx2
normals.ktx2
regions.ktx2
detail.ktx2
roughness.ktx2
accessories/
    chain_colour.ktx2
    chain_alpha.ktx2
    chain_material.ktx2
deformation/
    weights.ktx2
```

### Required channels

#### Colour

The painted character under restrained, broad lighting.

#### Alpha

Clean character isolation.

#### Depth

Approximate image-space distance.

Used for:

- parallax;
- atmospheric separation;
- depth-aware focus;
- modest geometry displacement.

#### Normals

Surface direction.

Used for:

- light wrapping;
- shoulder curvature;
- chest and torso plane response;
- restrained specular behaviour.

#### Region IDs

Pixel-accurate anatomical context zones:

- left shoulder;
- right shoulder;
- upper back;
- lower back;
- chest;
- arms;
- abdomen;
- glutes;
- quadriceps;
- hamstrings;
- calves;
- broader combined regions.

These are not visible diagrams. They are control maps.

#### Detail

A painterly detail layer that can resolve selectively within the focal region.

#### Roughness

Controls whether a surface appears more matte or reflective.

Useful later for sweat and post-workout states.

#### Deformation weights

Masks controlling breathing and other shallow mesh deformation.

## 11. Runtime renderer

The preferred direction is a native Android **Filament/Vulkan 2.5D character stage**.

It should not begin inside the production Capacitor interface.

### Rendering model

The visible character is rendered on:

- one subdivided plane;
- several shallow layered planes;
- or a limited depth-displaced surface.

It is not a conventional 3D avatar.

The renderer combines:

- colour;
- depth;
- normals;
- regions;
- roughness;
- detail;
- accessories;
- custom lighting;
- bloom;
- depth effects;
- controlled deformation.

### Why Filament

The system requires more than a basic image filter:

- Vulkan rendering;
- linear HDR working space;
- texture management;
- custom materials;
- bloom;
- colour grading;
- depth;
- possible HDR surface output;
- future geometry support;
- native Android lifecycle control.

Filament supplies those foundations without forcing the visual result to resemble a game.

### Native integration boundary

Once mature, the renderer becomes a native component behind a narrow Capacitor interface.

TypeScript should issue semantic states:

```ts
characterStage.setState({
  pose: 'back-neutral',
  focus: {
    leftShoulder: 0.62,
    rightShoulder: 0.88,
    upperBack: 0.70,
  },
  energy: 'postWorkout',
  attentionPriority: 'medium',
});
```

TypeScript should not manage shaders, textures or frame timing.

## 12. Motion system

The character should feel alive without appearing continuously animated for attention.

### Core motion

- Slow breathing.
- Small postural settlement.
- Slight depth parallax.
- Focus light travelling and settling.
- Soft pulse.
- Brush detail resolving.
- Tiny accessory response.
- Region transition.
- Character entrance and recession.

### Breathing

Breathing may use mesh deformation across:

- abdomen;
- lower ribs;
- chest;
- shoulders.

The movement should be slightly phase-offset:

```text
abdomen expands
lower ribs follow
chest follows
shoulders move fractionally
brief hold
slow release
```

The effect should remain within a few image pixels at common display size.

### Post-workout state

Possible treatments:

- larger breathing amplitude;
- slower return to rest;
- reduced surface roughness;
- stronger shoulder and forehead highlights;
- slightly warmer light;
- small posture drop;
- less stable focus light;
- greater atmospheric bloom.

These are expressive visual states, not physiological measurements.

### Motion blur

The character stage should target a maximum of **24 fps**.

On a 120 Hz display, each generated frame can persist for five display refreshes, producing stable frame pacing.

The rest of the HTML interface remains at the normal device refresh rate.

Motion blur should be:

- limited to the character stage;
- restrained;
- velocity-aware where possible;
- absent from text and controls;
- more visible during authored kinetic transitions than during breathing;
- disabled in reduced-motion mode.

A simple temporal accumulation or directional smear may be more suitable than expensive cinematic full-scene motion blur.

## 13. Lighting and focus language

The body is not coloured with flat anatomical masks.

Selected regions are brought into focus through combinations of:

- local exposure;
- directional light;
- surface-normal response;
- clarity/detail resolution;
- contrast;
- colour temperature;
- bloom;
- background recession;
- shadow control.

### Focus states

#### Ambient

Body is present but quiet.

#### Contextual

A broad area is gently illuminated.

#### Focused

One region gains clearer form and controlled light.

#### Comparative

Two related areas are lit with different stability or intensity.

#### Consequential

A brief stronger highlight marks an important conclusion or completed action.

#### Uncertain

Light is softer, broader or less settled.

The UI text remains responsible for explicit interpretation. The character provides location, tone and embodied context.

## 14. HDR strategy

HDR output is not required for Phase 4 completion, but the renderer and materials should not block it.

### Initial Phase 4

- Internal linear HDR rendering.
- Tone-mapped SDR output.
- HDR-capable material values.
- No reliance on display HDR for basic legibility.

### Later experimental HDR mode

Possible restrained uses:

- selected body-region highlight;
- reflected chain glint;
- session-start light impact;
- important MAIS intervention;
- transition between ambient and focused state.

The majority of the interface should remain inside an ordinary luminance range.

HDR should be controlled by a central attention system, not directly by an AI-generated instruction.

MAIS may request:

```text
priority: high
target: leftShoulderInsight
tone: caution
```

The UI decides whether that maps to:

- contrast;
- motion;
- haptic feedback;
- sound;
- HDR;
- or no special treatment.

HDR must be disabled during heavy AI inference until thermal, GPU and display behaviour have been measured.

## 15. Resource and performance policy

Phase 4 should optimise intelligently during development but not attempt final whole-app optimisation prematurely.

The final aggressive balancing pass belongs immediately before the first full alpha, once all model, rendering and UI workloads coexist.

### Phase 4 performance targets

- Maximum character render rate: 24 fps.
- Pause rendering when fully hidden.
- Static image fallback when appropriate.
- Dynamic rendering scale.
- Lower-resolution geometry maps than colour maps.
- Compressed GPU-native textures.
- Core and extended asset packs.
- Explicit memory release when character surfaces close.
- No generation model resident during ordinary character rendering.
- No heavy rendering while app is backgrounded.
- Reduced-motion support from the start.

### Proposed rendering modes

#### Full

- 24 fps.
- Full selected render scale.
- Bloom.
- Normals.
- Depth parallax.
- Detail layer.
- Accessories.
- Internal HDR.
- Optional display HDR.

#### Standard

- 24 fps.
- Approximately 70–80% render scale.
- SDR display.
- Reduced bloom.
- Simplified depth.
- Lower-cost detail.

#### Light

- 12 fps or static between transitions.
- Approximately 50–60% render scale.
- No display HDR.
- No motion blur.
- Minimal bloom.
- Simplified material.

#### Suspended

- Static cached frame.
- No active GPU animation.
- Used while off-screen, backgrounded or during deep-model pressure.

### Heavy AI inference policy

When a large model lease begins:

- disable display HDR;
- reduce render resolution;
- reduce or suspend bloom;
- cap the character to 12 fps or static;
- pause parallax;
- unload unused pose textures;
- preserve only essential UI motion;
- restore quality gradually after inference completes.

The existing MAIS governor already derives resource states from visibility, Battery Saver, active workout interaction and available memory. Phase 4 should eventually consume a shared device-resource coordinator rather than inventing a completely separate policy.

## 16. Demo-first development strategy

Phase 4 should begin as a separate native Android demo.

This is the preferred route.

### Proposed repository structure

```text
experiments/
    character-stage-android/
        app/
        test-assets/
        benchmarks/
        README.md

docs/
    PHASE_4_CHARACTER_DESIGN_TECH_PACK.md
    phase4/
        ASSET_CONTRACT.md
        CAPTURE_PIPELINE.md
        RENDERER_ARCHITECTURE.md
        TEST_PLAN.md
```

Initially, the demo should have no dependency on:

- the production UI;
- MAIS;
- real user capture;
- AI generation;
- final character assets.

It begins with synthetic test assets.

### Why separate it

- Filament and Vulkan can be debugged without the WebView.
- HDR experiments cannot destabilise the main app.
- Frame timing can be measured cleanly.
- Asset-map correctness can be inspected.
- Placeholder characters can prove the runtime before AI exists.
- AI generation failures cannot be confused with renderer failures.
- The demo can become a repeatable benchmark.
- Native crashes remain isolated.
- The final Capacitor bridge becomes a controlled integration step.

### Migration path

```text
Standalone demo
        ↓
Stable renderer API
        ↓
Extract character-stage-core library
        ↓
Build Capacitor bridge
        ↓
Integrate one production screen
        ↓
Expand across Brief / Progress / Lab
```

The demo should remain in the repository after integration as a regression and graphics test harness.

## 17. Acceptance criteria

Phase 4 is complete only when:

- The body does not default to an athletic ideal.
- The front and back views clearly represent the same person.
- Skin remains credible across tested tones.
- Accessories remain consistent.
- Selected regions can be focused without visible anatomical masks.
- Lighting follows body form.
- Character motion remains restrained.
- The renderer sustains its intended 24 fps on the target device.
- Heavy AI inference correctly reduces renderer load.
- Character assets survive app restart.
- Generation can resume or recover after interruption.
- Failed generations can be repaired without restarting everything.
- Source photographs can be deleted independently.
- Static and reduced-motion fallbacks exist.
- The app remains functional without a character.
- The character never becomes a source of authoritative medical claims.
- Native renderer failure cannot corrupt training data.
- The complete asset pack is exportable or rebuildable.

## 18. Explicit non-goals

Phase 4 will not initially attempt:

- fully accurate 3D body reconstruction;
- medical anatomy visualisation;
- diagnosis from visible body appearance;
- real-time pose generation during workouts;
- continuous neural relighting;
- perfect facial likeness;
- live wardrobe simulation;
- realistic cloth physics;
- real-time full-body motion capture;
- cross-platform parity;
- support for weak or old Android hardware;
- a public cloud character-generation service.

Those may be explored later, but they must not prevent the first useful system from shipping.

## Relationship to the development plan

This package is the design and technical authority for Phase 4. It defines what the system is, how it should feel, what it must preserve and the technical architecture we currently intend to pursue.

A separate Phase 4 implementation plan will translate this package into a concise sequence of real development steps, prototypes, decisions, tests and integration gates. That plan may change as experiments reveal better methods; this package should change only when the accepted design or technical direction itself changes.
