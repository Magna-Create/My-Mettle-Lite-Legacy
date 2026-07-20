# Gym App — Master Product, UX and Technical Specification

**Document status:** Authoritative working brief  
**Version:** 1.0  
**Prepared for:** Kian  
**Primary target:** Kian’s Galaxy S25 Ultra  
**Product form:** Offline-first Android application built with web technologies inside a native shell  
**Language:** British English  
**Purpose of this document:** Preserve product intention, user experience, system behaviour and technical direction in enough detail that future development can proceed without relying on conversational memory.

---

## 0. How to interpret this specification

This document is normative.

- **MUST** means the requirement is essential to the intended product.
- **SHOULD** means the requirement is strongly preferred unless implementation evidence justifies a change.
- **MAY** means the feature or method is optional.
- **CONFIRMED** means Kian has explicitly agreed to the decision.
- **PROVISIONAL** means the direction is selected, but its exact implementation still needs testing.
- **OPEN** means a decision is intentionally unresolved.

When technical convenience conflicts with the intended experience, the product intention and user journey take priority. Architecture exists to support the experience, not dictate it.

This application is not to be treated as a generic fitness tracker, a gym-bro workout app, a medical dashboard, a social fitness platform or a minimal logging utility. It is a personal training intelligence system built around Kian’s body, routine, preferences and evolving evidence.

---

# 1. Product thesis

## 1.1 Core proposition

The app is an **offline personal training intelligence platform** that closes the loop between:

1. deciding what to train;
2. performing and recording the session;
3. understanding progress and fatigue;
4. identifying possible weaknesses or inefficiencies;
5. testing improvements;
6. promoting successful changes into the permanent routine.

The system must help Kian visually understand progress without relying on a mirror, optimise the routine for his individual response, and make useful decisions outside and inside the gym.

The app should feel like a highly attentive assistant and coach that sees the user, remembers the detail, explains its reasoning and leaves final control with the user.

## 1.2 Core loop

```text
BRIEF
What matters today?
    ↓
TRAIN
Perform and record the session.
    ↓
PROGRESS
What appears to be changing?
    ↓
LAB
What should be tested, changed or adopted?
    ↓
BASE ROUTINE EVOLVES
The next cycle starts from a better structure.
```

This loop is the product. A release that implements only logging, only analytics or only a body diagram is not considered a usable completion of the app.

## 1.3 Emotional thesis

> **Soft atmosphere. Subtle power. Decisive impact.**

The app’s default presence is warm, calm, light and spacious. Beneath this calm surface is contained force. Key moments release that energy through controlled motion, particles, sound and haptics.

The intended feeling is:

- personal;
- experimental;
- physical;
- intelligent;
- quietly playful;
- alive;
- empowering;
- calm without being passive;
- motivational without becoming aggressive.

The app must not feel:

- futuristic in a sci-fi or neon-control-room sense;
- technical in the sense of opening a medical report;
- like a bodybuilding supplement brand;
- like yoga, mindfulness or generic wellness;
- cold, clinical or corporate;
- American sports-advertising loud;
- gamified for its own sake.

---

# 2. Target user and use context

## 2.1 Initial user

The first complete product is made for one person: Kian.

Relevant product context:

- male avatar and coach language appropriate to Kian;
- actual user-provided height, build and proportions rather than an idealised body;
- vegetarian nutrition profile;
- preference for lower-repetition performance work, especially around six clean repetitions for principal/core movements;
- preference for micro-progression: achieve clean target repetitions, then add a small load and return to the lower end of the range;
- dislike of high-repetition grinding as the default;
- strong interest in systems, data, optimisation, visual models and self-experimentation;
- Galaxy S25 Ultra as the primary test device;
- app likely used with earphones in, making subtle sound design valuable;
- app must work offline and remain useful without any cloud AI or account.

The architecture should not prevent later generalisation to multiple users, sexes, body types or routine structures, but generalisation is not allowed to flatten the first version into a generic product.

## 2.2 Typical environments

- before the gym, reviewing the daily Brief;
- in the gym, often one-handed and under time pressure;
- during rest periods;
- after a session, recording short subjective feedback;
- at home, exploring Progress and Lab;
- during routine redesign;
- while discussing exported data with a cloud AI such as ChatGPT.

## 2.3 Input constraints

During training:

- touch targets must be generous;
- interactions must work with one hand where possible;
- accidental gestures must be recoverable;
- important input must autosave immediately;
- the active exercise must remain obvious;
- the app must survive screen locking, switching apps and process suspension;
- text entry must be optional for routine use;
- detailed thought should be broken into small review prompts rather than demanded as a blank journal.

---

# 3. Product principles

1. **Calm before complexity.**
2. **Complexity is contained, not removed.**
3. **Every deeper layer earns greater information density.**
4. **The body is represented, not idealised.**
5. **Motion explains change.**
6. **Particles are a material language, not arbitrary decoration.**
7. **Organic summaries lead to precise evidence.**
8. **Atmosphere supports reflection; opaque surfaces support action.**
9. **The system advises; the user remains visibly in control.**
10. **The app must show uncertainty rather than imitate certainty.**
11. **AI interprets and communicates; deterministic systems calculate and constrain.**
12. **Permanent routine changes are always explicit and versioned.**
13. **A page should have one clear cognitive role.**
14. **Technical modularity must be visible as maintainability, not exposed as complexity.**
15. **No feature is allowed to damage the coherence of the full journey.**
16. **The app is complete only when the whole Brief → Train → Progress → Lab loop works.**

---

# 4. Product boundaries and non-goals

The first version MUST NOT attempt to be:

- a social network;
- a public workout marketplace;
- a calorie-counting app;
- a medical diagnostic tool;
- a rehabilitation or injury-treatment system;
- a wearable replacement;
- an automatic body-composition scanner;
- a cloud-first service;
- a spoken virtual coach;
- a generic chatbot with a workout UI;
- a fully autonomous routine editor;
- a competitive leaderboard;
- a dark-mode-first neon fitness app.

The application may record discomfort, fatigue and subjective notes, but must not diagnose injury, neurological fatigue, hormonal state or medical conditions.

“CNS fatigue” must be described in the interface as a **systemic/CNS-fatigue proxy** or comparable cautious language. It is an inference from performance patterns and subjective data, not a measurement of the nervous system.

---

# 5. Primary information architecture

## 5.1 Bottom navigation

The default bottom navigation contains five destinations:

1. **Brief**
2. **Train**
3. **Progress**
4. **Lab**
5. **Library**

**Settings** is accessed through a consistent top-level control rather than consuming a permanent bottom-navigation position.

## 5.2 Page roles

| Page | Primary user question |
|---|---|
| Brief | What should I know today? |
| Train | What am I doing now? |
| Progress | What appears to be happening? |
| Lab | What should I change, test or adopt? |
| Library | How are my exercises and routines constructed? |
| Settings | How should the system behave? |

Progress and Lab must remain distinct:

- **Progress observes and explains evidence.**
- **Lab turns evidence into decisions, experiments and routine changes.**

## 5.3 Navigation behaviour

- Each bottom-navigation destination should preserve its local state when the user switches tabs.
- Deep pages should use spatial back transitions, not abrupt resets.
- Contextual modal layers should resolve back to the state underneath.
- No flow should stack more than one unresolved modal over another.
- The user must never lose entered set data by navigating elsewhere.
- Train may display a persistent active-session indicator while another page is open.

---

# 6. Onboarding and first-run setup

The app starts from a clean dataset. Historical migration from the existing web app is optional and not required for first use.

## 6.1 First-run journey

1. Welcome and product explanation.
2. Local-first/privacy explanation.
3. User profile:
   - display name;
   - preferred units;
   - vegetarian dietary preference;
   - optional bodyweight and relevant nutrition inputs;
   - week/cycle start day;
   - optional training goal emphasis.
4. Sensory preferences:
   - sound level;
   - haptic level;
   - motion level;
   - reduced-motion option.
5. Brief module preferences.
6. Create or import the first exercise library.
7. Construct the first ψ, φ, π and & routine structure.
8. Explain the calibration period.
9. Optional installation of the local AI model or activation of system AI if available.
10. Enter the initial Brief.

## 6.2 Calibration period

The app must not pretend to possess personalised evidence immediately.

During calibration:

- trends are marked as “collecting evidence”;
- muscle progress displays may be present but low-confidence;
- dynamic scheduling applies only explicit constraints and conservative rules;
- strong personalised claims are withheld;
- Lab may collect candidate patterns but not pressure the user to act;
- a default minimum of three comparable exposures is required before describing an exercise trend;
- multi-exercise muscle conclusions should seek agreement across more than one exercise where possible.

Calibration is a designed state, not a missing feature.

---

# 7. Brief page specification

## 7.1 Purpose

Brief is the landing page and daily orientation layer. It should feel like a warm greeting from a companion that has quietly gathered the relevant information before the user arrived.

It should be sparse, atmospheric and immediately useful.

## 7.2 Brief does

- recommend which routine day is most appropriate next;
- explain week/cycle balance;
- surface useful recovery or performance observations;
- provide configurable pre-workout protein/carbohydrate timing guidance;
- surface one or two relevant notes from previous exercise reviews;
- deliver a brief positive progress observation;
- indicate whether a proposed routine adjustment deserves attention;
- provide the primary **Begin Session** action;
- allow the user to open a deeper full briefing.

## 7.3 Brief does not

- choose A, B or C;
- overload the page with charts;
- show raw analytics by default;
- present uncertain claims as fact;
- use a generic motivational quote;
- imply that the user has failed because a routine day is late;
- play spoken coaching.

## 7.4 Day recommendation

The day recommendation engine considers:

- completed ψ, φ and π days in the current cycle;
- current routine order and flexible scheduling rules;
- skipped or partially completed work;
- recovery/interference evidence;
- active Lab experiments;
- user locks and constraints;
- whether & is eligible;
- recency and balance.

The recommendation MUST explain itself on demand.

## 7.5 Brief structure

### Editorial opening

- warm greeting;
- large editorial headline;
- one concise central statement;
- optional atmospheric body/particle presence;
- minimal status indication.

Example:

> **You have useful momentum today.**  
> π is the cleanest next step. Your upper back is moving well; keep an eye on triceps fatigue later in the session.

### Scrollable card grid

Cards may include:

- today’s recommended day;
- nutrition timing;
- muscles progressing;
- recovery attention;
- previous note worth remembering;
- week balance;
- experiment status;
- proposed adjustment;
- optional estimated session duration;
- data/calibration status.

Cards are not horizontally swipeable by default. The page uses a straightforward vertical scroll and a sparse grid.

## 7.6 Main and full briefing

The main Brief is intentionally concise.

A **Full briefing** control reveals:

- reasoning behind the day recommendation;
- week/cycle balance;
- unfinished or redistributed work;
- fatigue/interference observations;
- confidence levels;
- nutrition details;
- active experiment implications;
- possible routine adjustment;
- supporting evidence links into Progress or Lab.

## 7.7 Brief settings

Each module is individually toggleable:

- estimated session duration;
- nutrition timing;
- muscle highlights;
- recovery notices;
- previous notes;
- proposed routine changes;
- week balance;
- experiment status;
- data quality;
- deep reasoning shortcut.

Estimated session duration must not be mandatory. The user may disable it if it becomes psychologically off-putting.

## 7.8 Begin Session transition

When **Begin Session** is pressed:

1. The recommended routine loads visibly into the background.
2. The background slightly recedes and is softened by Gaussian blur plus subtle grain.
3. A large central mode-selection modal appears.
4. A, B and C are offered with concise descriptions.
5. The app does not frame one mode as morally better.
6. Selecting a mode causes the modal to resolve and the prepared session to come sharply forward.
7. The chosen mode is recorded for the session.
8. The dynamic scheduler’s temporary changes are shown before the first exercise where relevant.

---

# 8. A/B/C mode system

## 8.1 Meaning

- **A:** Full intended session.
- **B:** Reduced session for limited time or capacity.
- **C:** Minimum viable session for a low-motivation/low-capacity day.

The user chooses the mode based on how they feel. The app does not recommend the mode.

## 8.2 Mode prescriptions

Each exercise/routine slot may specify per mode:

- included/excluded;
- set count;
- repetition target or range;
- rest period;
- load/progression behaviour;
- priority;
- whether the exercise can be deferred to &;
- review prompt intensity.

## 8.3 Mode neutrality

Copy must avoid shame.

Acceptable:

> C keeps the day moving with the smallest useful dose.

Unacceptable:

> Only choose C if you cannot complete the proper workout.

## 8.4 Omitted work

Work omitted in B or C may become:

- intentionally discarded;
- redistributed to a later core day;
- held as a candidate for &;
- excluded due to recovery constraints.

The decision and reason are stored.

---

# 9. Train page specification

## 9.1 Purpose

Train is the active-session workspace. It must be physically tactile, calm under ordinary use and capable of controlled bursts of energy at meaningful moments.

## 9.2 Session header

The session header shows:

- routine day;
- selected mode;
- active experiment indicator;
- optional elapsed session time;
- completion progress;
- pause/end controls;
- temporary scheduling changes;
- access to the session plan explanation.

## 9.3 Exercise card stack

Exercises are presented as a spatial card stack or layered list.

- The active card is brought forward.
- Inactive cards visibly recede.
- Completed cards settle into a completed state.
- Vertical movement navigates the session normally.
- Horizontal gestures perform contextual actions.
- The stack must remain understandable, not become a novelty carousel.

### Gesture rules

- **Tap:** focus/open the exercise.
- **Swipe right:** mark complete after a deliberate threshold.
- **Swipe left:** reveal secondary actions such as skip, defer, substitute or move.
- **Vertical scroll:** navigate through exercises.
- **Explicit expand control:** open the full exercise interface.
- Every gesture action has a visible alternative button.
- Completion provides a short undo window.
- Gesture thresholds must prevent accidental completion while entering data.

## 9.4 Three exercise states

### Ultra-compact

Contains only:

- exercise name;
- Principal/Core/Accessory marker;
- completion state;
- concise status or checkbox;
- optional small warning/experiment marker.

Purpose: scan the whole session quickly.

### Compact

Contains all information normally needed during a familiar exercise:

- target sets/reps for selected mode;
- rest target;
- expected progression jump;
- last comparable performance;
- preferred PB display: weight or volume;
- set-entry table;
- active exercise duration;
- rest timer;
- essential setup cue or warning;
- progression/rest guidance.

### Expanded

Contains the complete exercise record:

- equipment;
- exercise variation;
- setup instructions;
- video link;
- user action/setup notes;
- full muscle-load table;
- progression model;
- historical performance;
- recent reviews;
- personal progress journal;
- routine-slot overrides;
- editing controls where appropriate;
- analytics link;
- Lab link.

Expanded may use a full-screen sheet rather than making the in-session card extremely tall.

## 9.5 Set entry

Each set record supports:

- weight;
- unit;
- repetitions;
- optional RIR/RPE only if later enabled;
- completion timestamp;
- rest interval before/after;
- optional note;
- warm-up/work-set distinction if configured.

Input must:

- autosave immediately;
- be easy to correct;
- retain values when the app is backgrounded;
- support copying the previous set;
- suggest the planned load without forcing it;
- show comparable previous performance without clutter.

## 9.6 Progression preference

Default user preference:

- principal/core exercises often target approximately six clean repetitions;
- achieving clean sixes, possibly seven depending on the exercise, can trigger a micro-load increase;
- after increasing load, the target returns to the lower end;
- accessories may use higher repetition ranges where appropriate;
- high-repetition grinding is not the default progression strategy.

The progression engine must be configurable per exercise rather than applying one formula to every movement.

## 9.7 Fatigue-protection rule retained from v8

For comparable same-load sets:

- if repetitions drop by more than three, recommend a longer rest;
- if the large drop persists after appropriate rest, suggest reducing load by approximately 5–10%;
- the app must present this as guidance, not an automatic forced change;
- exercise-specific overrides are allowed.

## 9.8 Dual timing system

### Exercise duration

- starts when the exercise is brought into active focus or manually started;
- stops when the exercise is completed;
- includes setup, work sets and rests;
- can pause for interruption;
- helps estimate true session duration and setup cost.

### Rest timing

- records individual rest periods;
- can start automatically after a set or manually;
- may use haptic/sound cues;
- stores actual rest length for analysis;
- must not trap the user in a rigid countdown.

The two timers remain analytically distinct.

## 9.9 Exercise completion

On completion:

- the card gives a controlled physical landing;
- a concise sensory response occurs according to settings;
- the exercise moves into the completed stack;
- the next exercise becomes apparent;
- an optional short review is offered;
- the user can undo accidental completion.

Principal exercises may receive a slightly richer transition than accessories.

## 9.10 Exercise review

Review is broken into three or four small cards rather than a blank text area.

Possible prompts:

1. **How strong did this feel?**
2. **How well did you feel the intended muscles working?**
3. **Did anything feel uncomfortable or unusually fatiguing?**
4. **Anything worth remembering next time?**

Input types:

- slider;
- chips;
- muscle selection;
- yes/no;
- short optional text;
- quick setup note.

The question set can vary by exercise. Most reviews should take seconds. Unusual answers may open one additional relevant question.

Freeform progress notes remain available but are not the default burden.

## 9.11 Session completion

The completion experience should:

- summarise useful work rather than celebrate mere checkbox completion;
- show completed/omitted/redistributed exercises;
- show one meaningful performance observation;
- show any review requiring attention;
- state whether catch-up candidates were created;
- route the user to Lab only when there is a real action;
- use one of the richer contained-force transitions;
- preserve a calm landing after the impact.

No confetti.

---

# 10. Routine model

## 10.1 Day groups

The routine contains four named day groups:

- **ψ**
- **φ**
- **π**
- **&**

ψ, φ and π are core days.

& is an additional whole-body/catch-up/optional day.

## 10.2 & eligibility rule

& must not be recommended until ψ, φ and π have each been completed in the current cycle in A, B or C form.

Important distinctions:

- A whole missed core day remains a core day; & does not replace it.
- Exercises omitted from a completed B/C session can become catch-up candidates.
- Skipped exercises may become catch-up candidates.
- Cross-day redistribution among core days may occur where allowed.
- Once all three core days are complete, & may receive suitable remaining work.
- Recovery and weekly-volume constraints can still prevent catch-up work from being recommended.

## 10.3 Routine slot

A routine slot references an exercise and may contain:

- default day;
- default position;
- importance;
- mode prescriptions;
- progression overrides;
- movement permissions;
- lock state;
- equipment/context requirement;
- catch-up eligibility;
- experiment assignment;
- notes.

An exercise exists independently from a routine slot. The same exercise may appear in more than one routine context without duplicating its canonical definition.

## 10.4 Importance categories

### Principal

- highest strategic importance;
- may reorder within its assigned day;
- cannot move across days under ordinary dynamic scheduling;
- receives stronger protection from prior fatigue;
- should be prioritised when mode reduces session volume.

### Core

- meaningful contribution to the routine;
- may move within the day;
- may move across days only if dynamic cross-day movement is enabled and constraints permit.

### Accessory

- supportive/lower-priority work;
- most flexible for omission, movement or catch-up;
- may move across days when enabled.

## 10.5 Routine versioning

Routine changes never silently rewrite history.

Example:

```text
Routine v4
→ Three-session experiment
→ User accepts result
→ Routine v5 created
```

Completed sessions retain snapshots of the routine, exercise definitions and prescriptions that existed at the time.

---

# 11. Dynamic scheduling and routine optimisation

## 11.1 Scope

Dynamic scheduling is not merely a temporary exercise shuffle. It operates at three levels:

1. **Session adaptation**
2. **Controlled experiments**
3. **Permanent routine optimisation**

## 11.2 Session adaptation

Temporary adjustments may respond to:

- equipment availability;
- current time/capacity;
- selected A/B/C mode;
- current recovery evidence;
- exercise interference;
- missed or deferred work;
- an active experiment;
- user-requested substitution;
- setup efficiency.

Temporary changes affect the current session unless explicitly promoted later.

## 11.3 Controlled experiments

Lab may propose a defined change such as:

> Move cable triceps extensions before lateral raises for the next three π sessions.

Each experiment stores:

- hypothesis;
- source evidence;
- original routine state;
- test routine state;
- target sessions or duration;
- success measures;
- possible downside;
- confidence;
- user edits;
- observations;
- result;
- final decision.

## 11.4 Permanent optimisation

After an experiment or repeated temporary pattern:

- the app may propose promotion into the base routine;
- the user must explicitly approve;
- the proposed new base arrangement is previewed;
- the previous routine remains available;
- approval creates a new routine version;
- the scheduler decision record is retained;
- the user can later restore or branch from an earlier version.

## 11.5 Scheduler inputs

- current base routine version;
- selected mode;
- current training cycle;
- completed/omitted work;
- exercise importance;
- movement permissions;
- user locks;
- active experiments;
- muscle-load vectors;
- exercise order history;
- performance trends;
- systemic-fatigue proxy;
- recovery evidence;
- actual exercise/setup/rest durations;
- equipment constraints;
- desired session-time constraint if enabled;
- weekly/cycle targets;
- user-defined goals.

## 11.6 Hard constraints

The deterministic engine MUST enforce:

- Principal exercises do not move across days.
- Locked exercises/positions do not move beyond their lock.
- & eligibility gate is respected.
- Equipment/context requirements are satisfied.
- Exercises with explicit dependencies retain safe order.
- User exclusions are respected.
- Recovery and concentration limits prevent unreasonable same-muscle clustering.
- Active experiment boundaries are preserved.
- Permanent routine changes require user approval.
- The scheduler cannot silently delete work.
- Every change records a reason.

## 11.7 Optimisation scores

Candidate arrangements may be scored against:

- expected principal-exercise performance;
- muscle recovery;
- weekly/cycle volume coverage;
- sequence interference;
- systemic fatigue;
- setup efficiency;
- adherence likelihood;
- expected session duration;
- exercise priority;
- catch-up value;
- information value for an active experiment;
- user preferences.

The scoring system must be inspectable and versioned.

## 11.8 Movement reasons

Every moved exercise is labelled internally and, where relevant, visibly:

- catch-up;
- recovery adaptation;
- time reduction;
- equipment constraint;
- active experiment;
- established optimisation;
- user manual move;
- substitution.

## 11.9 Decision record

Each automated decision stores:

- what changed;
- source routine version;
- reason;
- evidence;
- constraints;
- score comparison;
- confidence;
- user response;
- eventual observed outcome.

This record supports debugging and stops the engine repeatedly proposing changes the user has rejected.

---

# 12. Library: exercise management

## 12.1 Exercise library functions

The user can:

- create;
- clone;
- edit;
- archive;
- restore;
- delete where safe;
- search;
- filter;
- assign to routine slots;
- inspect exercise history;
- import structured exercise definitions;
- generate a draft using local AI.

## 12.2 Canonical exercise fields

### Identity

- name;
- aliases;
- version;
- active/archived;
- exercise category;
- movement pattern;
- unilateral/bilateral;
- equipment;
- equipment alternatives;
- unit.

### Prescription

- default sets/reps;
- A/B/C sets/reps;
- rest period;
- expected progression jump;
- load increment options;
- progression method;
- deload/reduction rule;
- warm-up structure if enabled.

### Importance and routine context

- default importance;
- allowed routine roles;
- movement permissions;
- catch-up suitability;
- estimated setup burden.

### Performance display

- last-session PB;
- PB basis toggle: weight or volume;
- comparison method:
  - best clean set;
  - load at target reps;
  - estimated strength;
  - volume;
  - custom;
- comparable-history window.

### Guidance

- setup steps;
- concise active cue;
- video link;
- safety/caution note;
- user action notes;
- user progress notes.

### Muscle model

- target muscles;
- load balance per muscle;
- role per muscle:
  - prime;
  - synergist;
  - stabiliser;
- confidence;
- user-personalised adjustment;
- source/version.

### Review configuration

- preferred questions;
- discomfort locations;
- technique/setup prompts;
- optional journal prompts.

## 12.3 Exercise versioning

Editing an exercise creates a new version when the change affects interpretation of history, including:

- muscle-load allocation;
- progression method;
- variation;
- equipment;
- movement pattern;
- prescription logic.

Minor wording edits may update without a semantic version where safe.

Historical sessions retain the version used at the time.

## 12.4 AI-assisted exercise creation

Flow:

1. User chooses **AI-assisted**.
2. User pastes prose or structured text.
3. The app supplies a validated empty schema and extraction instructions.
4. The local model creates a draft only.
5. The draft is schema-validated.
6. Uncertain fields are clearly marked.
7. The user reviews muscle allocation, progression and safety-sensitive fields.
8. Only user approval saves the exercise.

Structured JSON import must also be supported and should be preferred for reliable exchange with cloud AI.

---

# 13. Library: routine editor

## 13.1 Routine editor capabilities

- view ψ, φ, π and & together;
- drag/reorder within a day;
- move eligible exercises across days;
- set Principal/Core/Accessory;
- lock position/day;
- configure A/B/C;
- preview expected cycle balance;
- see muscle-load distribution;
- see estimated duration if enabled;
- compare routine versions;
- branch from an earlier version;
- view active experiments;
- resolve conflicts before save.

## 13.2 Manual versus dynamic changes

Manual edits:

- immediately create a new draft routine version;
- show affected metrics;
- require confirmation before replacing the base version.

Dynamic proposed edits:

- appear in Lab;
- may be edited;
- may run as experiments;
- become permanent only through explicit promotion.

---

# 14. Progress page specification

## 14.1 Purpose

Progress answers:

- Am I progressing?
- Which muscle regions appear to be progressing?
- Where might a weakness or sequence effect exist?
- How confident is the app?
- What evidence supports the conclusion?

It does not directly action changes. Actions move to Lab.

## 14.2 Top-level experience

- editorial page opening;
- selected time window;
- personalised illustrated body as the main anchor;
- organic summaries rather than a chart wall;
- clear indications of evidence strength;
- a route to deeper precise analytics.

## 14.3 Time windows

Support at minimum:

- two weeks;
- one month;
- three months;
- six months;
- one year;
- year to date;
- all time;
- custom range.

## 14.4 Exercise progress

No universal metric is assumed.

Each exercise selects or defines a comparison method:

- best clean set;
- load at target repetitions;
- estimated strength;
- repeated-set quality;
- volume where meaningful;
- progression through a target range;
- custom composite.

The interface must show the method used.

## 14.5 Muscle progress inference

Exercise changes are distributed through personalised muscle-load vectors.

The muscle model considers:

- contribution of each relevant exercise;
- consistency across sessions;
- agreement across multiple exercises;
- routine/exercise version changes;
- sample size;
- setup/discomfort notes;
- sequence position;
- data quality;
- selected time window.

The result is **evidence of training progress**, not a direct measure of hypertrophy.

## 14.6 Confidence

Possible levels:

- collecting evidence;
- low;
- moderate;
- strong.

Confidence must be visible in plain language and available in detail.

A muscle may show positive progress with low confidence. These are separate values.

## 14.7 Weakness isolation

The system cross-references exercises sharing muscles.

Example logic:

- if two exercises recruit the same muscle and both stall, a shared weakness becomes more plausible;
- if one stalls only after a specific preceding movement, sequence fatigue is more plausible;
- if isolation performance remains stable but compound performance falls, technique/order/systemic factors may be more plausible;
- user notes can alter confidence.

This is presented as a hypothesis, not diagnosis.

## 14.8 Sequence and interference analysis

The app may compare:

- exercise position;
- preceding muscle load;
- rest inflation;
- previous exercises’ intensity;
- performance drop;
- mode;
- session duration;
- subjective strength;
- active experiment.

Minimum sample thresholds are required before strong claims.

## 14.9 Systemic/CNS-fatigue proxy

Potential signals:

- broad session-wide performance decline;
- principal lift degradation across unrelated muscle groups;
- unusually long rests;
- declining repeated-set quality;
- multiple fatigue review flags;
- weaker performance despite adequate local recovery;
- cumulative cycle load.

The UI must call this a proxy/inference and explain the evidence.

## 14.10 Analytical depth model

```text
Organic impression
→ Interpretable relationship
→ Precise evidence
```

Top-level visuals may use:

- body regions;
- radial compositions;
- organic fields;
- dot density;
- connected systems;
- layered contours.

Deep views may use:

- dot-based lines;
- granular bars;
- scatter plots;
- exact axes;
- session tables;
- formula/method disclosure.

---

# 15. Personalised 2.5D body system

## 15.1 Direction

The first version uses personalised 2D vector artwork with 2.5D presentation.

It does not require a true 3D mesh.

## 15.2 Representation

The body must reflect:

- user-provided height;
- actual proportions;
- current build;
- visible softness/tummy where present;
- masculine presentation for Kian;
- no idealised bodybuilder proportions;
- no generic medical mannequin.

The style combines:

- simplified illustrated body planes;
- soft dimensional shading;
- muted colour;
- pencil/chalk/vector muscle linework;
- particle/dot capability.

## 15.3 Views

At minimum:

- front;
- side;
- rear.

Transitions should imply rotation through:

- horizontal compression/expansion;
- moving light;
- parallax;
- intermediate silhouette;
- particle transformation;
- maintained focus on the selected muscle.

## 15.4 Asset architecture

The visual asset is separate from muscle data.

Example:

```text
muscle_id: deltoid_lateral
asset_version: body_kian_v3
front_path_id: body.front.deltoid_lateral
side_path_id: body.side.deltoid_lateral
rear_path_id: body.rear.deltoid_lateral
```

Stable muscle IDs allow the body art to be replaced without rewriting analytics.

## 15.5 Visual layers

1. Base silhouette.
2. Skin/body plane fill.
3. Soft volume shading.
4. Muscle-region masks.
5. Pencil/chalk anatomy overlay.
6. Progress/recovery/confidence overlays.
7. Particle field.
8. Responsive highlight/lighting.
9. Optional labels.

## 15.6 Alive state

Possible subtle behaviours:

- gentle breathing;
- slow light shift;
- small particle drift;
- responsive muscle highlight;
- particle movement between related regions;
- slight device-motion parallax;
- linework becoming more coherent with stronger evidence.

The animation must remain restrained and not resemble a game idle animation.

## 15.7 Monthly avatar updates

The user may provide updated reference imagery externally.

Workflow:

1. Create or revise the body illustration.
2. Preserve stable muscle IDs.
3. import a new body asset version;
4. preview alignment;
5. activate from a chosen date;
6. retain earlier body versions for historical comparison.

The app does not infer visual growth automatically from strength data.

---

# 16. Lab page specification

## 16.1 Purpose

Lab is the action centre.

It translates evidence into:

- proposals;
- experiments;
- routine edits;
- decisions;
- adopted improvements.

It is not a duplicate analytics page.

## 16.2 Sections

- **Needs attention**
- **Opportunities**
- **Experiments running**
- **Results awaiting decision**
- **Applied changes**
- **Deferred**
- **Rejected and archived**
- **Decision history**

## 16.3 Proposal contents

Every proposal includes:

- issue/opportunity;
- concise interpretation;
- evidence;
- alternative explanation;
- confidence;
- proposed action;
- exact routine effect;
- expected benefit;
- possible downside;
- test duration;
- success criteria;
- reversibility.

## 16.4 User actions

- Apply now.
- Edit before applying.
- Run as an experiment.
- Extend experiment.
- Defer.
- Reject.
- Mark interpretation as wrong.
- Restore previous routine.
- Promote successful experiment into base routine.

## 16.5 Experiment migration

When a result is accepted:

1. Show original and tested states.
2. Explain observed outcome.
3. Let the user edit the final arrangement.
4. Confirm promotion.
5. Create a new base routine version.
6. Retain the previous version and experiment record.
7. Use a richer particle/spatial transition to represent temporary structure becoming permanent.

## 16.6 Tone

Lab speaks conversationally and collaboratively.

Example:

> Moving this exercise appears to have helped. Would you like to make the new order permanent?

It must not sound commanding or overconfident.

---

# 17. Briefing and nutrition engine

## 17.1 Separation of calculation and language

The briefing engine has two layers:

### Deterministic brief composer

Selects:

- day recommendation;
- evidence;
- nutrition rule;
- previous notes;
- confidence;
- active experiment;
- relevant action.

### Language layer

Turns verified facts into natural written copy.

The language layer may use the local LLM, but a deterministic template fallback must always exist.

## 17.2 Nutrition

Nutrition guidance may include:

- protein intake;
- carbohydrate intake;
- timing before exercise;
- meal-size context;
- vegetarian-compatible examples where configured.

Requirements:

- numbers/ranges originate from a versioned nutrition knowledge pack, not model improvisation;
- user profile and timing determine which rule applies;
- uncertainty and assumptions are visible;
- the app must not make medical claims;
- modules are optional in Brief settings;
- advice may be revised by replacing the knowledge pack rather than rewriting page code.

---

# 18. On-device AI specification

## 18.1 Product role

The local model is an interpretation and communication layer.

It is not the authoritative analytical engine.

## 18.2 Preferred runtime strategy

Use runtime capability detection.

### Route A: Android system model

When the device exposes a suitable ML Kit GenAI Prompt API/AICore capability:

- use the shared on-device model through a native Kotlin bridge;
- call the official status/availability check before exposing AI UI;
- respect foreground-only and quota limitations;
- avoid dependence on long outputs.

### Route B: app-owned local model

When system capability is unavailable or unsuitable:

- use an app-specific local model through a native Android inference runtime;
- deliver the model separately/on demand where practical;
- manage model version, storage and deletion;
- release memory after use.

### Route C: no local model

The application remains fully functional using:

- deterministic analytics;
- templates;
- structured import;
- AI Context Export.

No core feature may fail solely because AI is unavailable.

## 18.3 Native requirement

The application must not assume a browser can access system-level Android AI.

The primary app uses a native shell and Kotlin bridge.

## 18.4 Suitable AI tasks

- rewrite verified facts into a natural Brief;
- classify review notes;
- extract fatigue/discomfort/setup themes;
- turn pasted exercise prose into a structured draft;
- explain scheduler decisions;
- summarise experiment outcomes;
- answer scoped questions about selected local data;
- identify candidate themes for deterministic verification;
- produce concise written coach copy.

## 18.5 Unsuitable AI tasks

The model must not:

- calculate authoritative progress;
- decide data comparability;
- enforce scheduler constraints;
- directly edit the routine;
- silently save exercise definitions;
- invent muscle-load values as fact;
- diagnose pain or injury;
- generate nutrition quantities without rule-pack input;
- act as the database;
- make permanent changes without approval.

## 18.6 Context builder

The model never receives the entire database by default.

A deterministic context builder selects:

- task;
- relevant date range;
- relevant exercises;
- relevant metrics;
- relevant notes;
- rule-pack excerpts;
- confidence;
- required output schema.

## 18.7 Structured output

Where AI affects app data:

- require a JSON/schema-defined response;
- validate types and allowed values;
- flag unsupported/uncertain fields;
- display a review screen;
- save only after approval.

## 18.8 Local RAG/knowledge

Versioned knowledge packs may include:

- muscle interaction graph;
- movement rules;
- nutrition guidance;
- copy/voice guidance;
- exercise import schema;
- safety wording.

Retrieval must be scoped and cite the internal source/version in debug views.

## 18.9 AI settings

- enable/disable AI;
- runtime in use;
- model status;
- model version;
- download/delete/reinstall;
- performance/battery mode;
- allow note interpretation;
- allow exercise drafting;
- allow briefing wording;
- retain/discard prompt logs;
- clear context cache;
- show source facts behind generated text.

## 18.10 Privacy

- inference is local by default;
- no prompt is sent to a cloud service without explicit export/action;
- raw notes remain local;
- AI logs are optional;
- the user can inspect the facts used to generate a statement.

---

# 19. AI Context Export

## 19.1 Purpose

Produce a deliberate export that can be given to a cloud AI for deeper analysis.

## 19.2 Export formats

### Human-readable

Markdown or HTML containing:

- goals;
- routine;
- exercise definitions;
- selected date range;
- performance summary;
- muscle trends;
- review themes;
- anomalies;
- experiments;
- scheduler decisions;
- explicit analysis questions.

### Machine-readable

JSON containing:

- schema version;
- units;
- selected entities;
- session/set records;
- metrics;
- confidence;
- routine versions;
- exercise versions;
- notes if included.

## 19.3 User controls

- date range;
- exercises;
- full/raw or summary;
- include/exclude free text;
- include/exclude body data;
- anonymisation;
- include active routine;
- include decision history;
- export purpose/question.

---

# 20. Visual design system

## 20.1 Visual thesis

> A light, paper-like personal body companion: calm at the surface, spatial and alive in motion, increasingly analytical as the user descends through its layers.

## 20.2 Foundation: kinetic paper

- warm off-white/lightly tinted surfaces;
- subtle paper grain and film noise;
- ink-like lines;
- soft shadows;
- physical layering;
- gentle tonal variation;
- natural muted colours;
- selective vivid accents;
- no dark default interface.

The lightness must not become sterile minimalist wellness design. Physicality must come from ink, texture, depth, movement and the represented body.

## 20.3 Structural influence

One UI informs:

- hierarchy;
- grouping;
- page organisation;
- spacing;
- readable headings;
- touch targets;
- settings structure;
- parent–child clarity.

It does not define:

- palette;
- iconography;
- black rounded-card styling;
- default visual identity.

## 20.4 Hierarchical modes

### Editorial mode

Used for:

- Brief opening;
- page-opening statements;
- top of Progress;
- major Lab conclusions;
- milestones.

### System mode

Used for:

- set entry;
- controls;
- labels;
- settings;
- exercise details;
- dense evidence.

One strong editorial opening should transition quickly into practical clarity.

## 20.5 Palette direction

### Base

- warm chalk;
- paper cream;
- pale stone;
- faint cool grey;
- soft ink;
- desaturated earth/plant tones.

### Atmospheric

- washed blue;
- misted violet;
- warm grass green;
- sunset peach;
- muted rose;
- soft amber.

### Attention

- vivid warm yellow;
- warm orange;
- saturated blue;
- violet;
- occasional clear green.

Metaphor: vivid flowers emerging from rolling muted hills.

## 20.6 Semantic colour

Semantic colours may represent:

- positive progress;
- recovery attention;
- warning;
- experiment;
- active training;
- confidence;
- mode.

Traffic-light colours are used only where direct status is genuinely useful. They must not dominate the identity.

## 20.7 Surface types

### Paper surface

Opaque, textured, readable.

Use for:

- exercise cards;
- settings;
- forms;
- text-heavy analytics;
- detailed explanations.

### Atmospheric glass

Blurred, tinted, spatial.

Use for:

- Brief modules;
- high-level summaries;
- body overlays;
- environmental information.

### Focus layer

Large central modal with strong blur and controlled translucency.

Use for:

- A/B/C selection;
- experiment acceptance;
- routine migration;
- structured reviews;
- consequential decisions.

Text-bearing glass must be opaque enough or heavily tinted enough to preserve excellent readability.

## 20.8 Grain and blur

- Gaussian blur is a primary spatial tool.
- Film/paper noise should prevent digital sterility.
- Grain must remain subtle and not reduce legibility.
- Blur indicates retained context beneath a focused decision.
- Blur is not applied indiscriminately to every card.

---

# 21. Motion and energy system

## 21.1 Energy model

The app has four energy states.

### Resting

- gentle breathing;
- slow particle drift;
- soft light changes;
- suspended energy;
- minimal sensory output.

### Charging

- particles draw inward;
- cards align/compress;
- background recedes;
- subtle sound builds;
- haptic tension may increase.

Used before meaningful action.

### Impact

- form snaps into clarity;
- particles accelerate or strike into place;
- linework tightens;
- card lands;
- low precise sound and haptic occur together.

Reserved for meaningful consequence.

### Release/integration

- energy settles;
- completed work recedes;
- next state appears;
- particles reform;
- interface returns to calm.

## 21.2 Motion character

- cinematic and spatial for sparse/expressive areas;
- springy and tactile where function is primary;
- restrained for repeated controls;
- richer for rare conceptual transitions.

## 21.3 Particle grammar

Particles may express:

- assembly/understanding;
- dispersal/transition;
- evidence density;
- relationship between regions;
- routine migration;
- accumulated progress;
- uncertainty;
- movement.

Particle behaviour must correspond to meaning.

### Everyday use

- slight settling when a card opens;
- subtle dot-field movement;
- granular state transitions.

### Expressive use

- body-view transition;
- session start;
- meaningful progression;
- session completion;
- experiment visualisation;
- promotion into base routine.

## 21.4 Reduced motion

Reduced-motion mode must:

- preserve state clarity;
- remove large parallax/dissolve effects;
- use fades/scale changes;
- keep essential feedback through haptics or static states where enabled.

---

# 22. Sound and haptics

## 22.1 No spoken coach

Coach communication is written only.

The app does not synthesise or play motivational speech.

## 22.2 Sonic character

Use:

- granular rushes;
- dry paper/ink flicks;
- restrained low impacts;
- short air movement;
- tight percussive ticks;
- brief tonal blooms;
- subtle stereo movement.

Avoid:

- arcade bleeps;
- fitness-watch chirps;
- exaggerated booms;
- constant confirmations;
- loud American sports-advertising effects.

Sounds should feel like matter moving or settling.

## 22.3 Audio behaviour

- never seize audio focus unnecessarily;
- do not pause music;
- mix subtly over existing audio;
- provide independent volume setting;
- use sound only where it adds meaning;
- pre-load short assets to avoid latency.

## 22.4 Haptic vocabulary

| Event | Behaviour |
|---|---|
| Card focus | Soft directional tick |
| Rest start | Short contained pulse |
| Set saved | Crisp single confirmation |
| Exercise complete | Firmer two-stage landing |
| Progression achieved | Build then one clean impact |
| Warning/questionable data | Uneven restrained pulse |
| Experiment promoted | Movement pulse then settled confirmation |

## 22.5 Controls

- Sound: off / subtle / expressive.
- Haptics: off / functional / full.
- Motion: reduced / standard / cinematic.

---

# 23. Written voice and content system

## 23.1 Voice spectrum

### Coach

Passionate, intense, observant and British.

- rooting for the user;
- direct;
- emotionally present;
- not chirpy;
- not American;
- not generic;
- intensity used sparingly.

Examples:

> You’re ready for π today. Start controlled, then give the principal work everything it deserves.

> This is the set. Six clean reps. Hold your shape and own every one.

> That moved properly. This is your new baseline.

> That wasn’t your strongest. Fine. Take the full rest, reset your position and make the next one honest.

> You haven’t got the full session in you today. You have got enough to move forward. Choose C and make it count.

### Analyst

Clear, restrained and evidence-led.

> Three exercises show a similar improvement pattern, giving this result moderate confidence.

### Collaborator/Lab

Friendly and conversational.

> Moving this exercise appears to have helped. Would you like to make the new order permanent?

## 23.2 Copy rules

- Never praise meaningless taps.
- Never imply certainty beyond evidence.
- Never shame B or C.
- Prefer precise encouragement over slogans.
- Use British spelling and rhythm.
- Avoid “crush it”, “beast mode”, “no excuses” and similar language.
- Avoid pseudo-medical language.
- Explain why an action matters.
- Allow the user to inspect the evidence behind generated copy.

---

# 24. Component system and modular UI

## 24.1 Principle

The app must be assembled from standardised, versioned components.

Pages specify:

- component type;
- content;
- data;
- state;
- permitted variation.

Pages do not redefine the visual and behavioural logic of each component.

## 24.2 Design tokens

Store centrally:

- semantic colour roles;
- typography scales;
- spacing;
- radii;
- blur strengths;
- elevation;
- grain/noise settings;
- animation timings;
- easing/spring values;
- icon sizes;
- touch targets;
- stroke styles;
- haptic IDs;
- sound IDs.

Components reference semantic tokens rather than arbitrary values.

## 24.3 Primitive components

- Button
- IconButton
- Toggle
- Slider
- TextField
- NumberField
- Select
- Chip
- Divider
- ProgressIndicator
- Card
- Sheet
- Modal
- Tooltip
- Toast
- NavigationItem
- Tab
- SegmentedControl
- SwipeAction
- TimerDisplay

## 24.4 Pattern components

- ModeSelectionModal
- ExerciseCard
- SetEntryRow
- RestTimer
- ExerciseTimer
- BriefingCard
- InsightCard
- MuscleSummary
- ExperimentProposal
- ExperimentResult
- RoutineDayColumn
- RoutineSlotCard
- ReviewQuestionCard
- SettingsGroup
- ConfidenceBadge
- EvidenceDrawer
- BodyViewer
- ParticleTransition
- CompletionUndoToast

## 24.5 Feature compositions

Features assemble pattern components. They must not fork them casually.

## 24.6 Typed component registry

Data-driven rendering is permitted only for known validated components.

Example:

```json
{
  "component": "briefing-insight-card",
  "version": 1,
  "title": "Recovery",
  "body": "Your triceps may benefit from additional recovery.",
  "priority": "medium",
  "action": {
    "label": "Examine in Lab",
    "route": "/lab/proposals/184"
  }
}
```

Boundary:

- layout/behaviour lives in typed code;
- content and approved variants live in configuration;
- feature logic remains explicit;
- arbitrary remote code/components are not loaded.

## 24.7 Component workshop

The project should include a development-only component gallery:

- every component;
- all states;
- edge cases;
- long text;
- loading/error/empty states;
- motion variants;
- visual regression snapshots.

A broken component should be fixable once and propagate across the app.

---

# 25. Technical architecture

## 25.1 Primary stack

Provisional implementation default:

- React;
- TypeScript;
- Vite;
- Capacitor native Android shell;
- Kotlin native bridge;
- native SQLite storage;
- IndexedDB/browser fallback for development or secondary web build;
- service worker for cached web assets where appropriate;
- SVG/CSS for body and small particle effects;
- Canvas/WebGL particle renderer where density requires it;
- Web Audio API/native audio bridge;
- native haptics bridge.

Exact libraries must be validated at project start, but architecture must preserve these boundaries.

## 25.2 Layering

### Domain

Pure entities and rules:

- Exercise
- Routine
- Session
- Set
- Muscle
- Experiment
- Progress metric

### Application

Use cases:

- begin session;
- record set;
- complete exercise;
- generate briefing;
- calculate progress;
- propose experiment;
- promote routine version;
- export context.

### Engines

- progression;
- muscle analysis;
- sequence/interference;
- fatigue proxy;
- dynamic scheduler;
- briefing;
- nutrition;
- confidence.

### Infrastructure

- SQLite;
- IndexedDB fallback;
- file export;
- AI bridge;
- haptics;
- audio;
- model delivery;
- backup.

### Presentation

- screens;
- components;
- design tokens;
- animation;
- body viewer.

## 25.3 Suggested source structure

```text
src/
  app/
    navigation/
    providers/
    state/

  domain/
    exercises/
    routines/
    sessions/
    muscles/
    experiments/
    briefings/

  application/
    commands/
    queries/
    workflows/

  engines/
    progression/
    muscle-analysis/
    interference/
    fatigue/
    scheduling/
    briefing/
    nutrition/
    confidence/

  features/
    brief/
    train/
    progress/
    lab/
    library/
    settings/
    onboarding/

  components/
    primitives/
    patterns/
    body/
    motion/

  design/
    tokens/
    themes/
    sound/
    haptics/

  knowledge/
    muscles/
    movements/
    nutrition/
    voice/

  adapters/
    storage/
    ai/
    export/
    native/
    browser/

android/
  ai/
  haptics/
  audio/
  storage/
```

## 25.4 Repository abstraction

Presentation and engines must not talk directly to SQLite.

Use repository interfaces so storage can later change without rewriting the app.

## 25.5 State ownership

- persistent domain data lives in repositories;
- transient UI state lives in feature state;
- active-session state is persisted continuously;
- derived analytics are reproducible and versioned;
- generated Brief copy is cached with its source facts/version.

---

# 26. Data model

All major records include:

- unique ID;
- created/updated timestamp;
- schema version;
- soft-delete/archive state where relevant;
- source/version metadata.

## 26.1 Core entities

### UserProfile

- name;
- units;
- dietary preference;
- cycle settings;
- goals;
- relevant nutrition inputs;
- sensory preferences.

### BodyAvatarVersion

- asset version;
- effective date;
- front/side/rear asset references;
- muscle-path mapping;
- notes.

### Muscle

- stable ID;
- display name;
- region;
- parent group;
- interaction graph references.

### Exercise

- canonical ID;
- current version;
- archive state.

### ExerciseVersion

- identity fields;
- equipment;
- progression method;
- prescriptions;
- guidance;
- comparison method.

### ExerciseMuscleLoad

- exercise version;
- muscle ID;
- load proportion;
- role;
- confidence;
- personal override.

### Routine

- canonical routine ID;
- current base version.

### RoutineVersion

- version;
- source;
- parent;
- effective date;
- change reason.

### RoutineDay

- ψ/φ/π/&;
- role;
- eligibility rules.

### RoutineSlot

- exercise reference/version;
- position;
- importance;
- locks;
- movement permissions;
- overrides.

### ModePrescription

- A/B/C;
- sets;
- reps;
- rest;
- inclusion;
- progression override.

### TrainingCycle

- start/end;
- completion state for core days;
- catch-up candidates;
- cycle status.

### Session

- day;
- mode;
- routine version snapshot;
- start/end;
- scheduler plan;
- completion state;
- summary.

### SessionExercise

- exercise version snapshot;
- planned/actual position;
- movement reason;
- start/end;
- completion/skip/defer state.

### SetRecord

- load;
- unit;
- reps;
- timestamps;
- rest;
- note;
- warm-up/work classification.

### ExerciseReview

- structured responses;
- text;
- muscle sensation;
- discomfort;
- perceived strength;
- setup issue.

### PerformanceMetric

- method;
- value;
- source records;
- algorithm version;
- confidence.

### MuscleMetric

- muscle;
- time range;
- progress signal;
- confidence;
- contributing exercises;
- algorithm version.

### InterferenceSignal

- source exercise/order;
- affected exercise;
- evidence;
- confidence.

### BriefingRecord

- date;
- source facts;
- module configuration;
- generated copy;
- language-engine version.

### LabProposal

- type;
- evidence;
- confidence;
- proposed change;
- status.

### Experiment

- hypothesis;
- baseline;
- intervention;
- duration;
- criteria;
- result;
- decision.

### SchedulerDecision

- input snapshot;
- constraints;
- candidate scores;
- selected plan;
- reason;
- user response.

### KnowledgePackVersion

- pack type;
- version;
- checksum;
- effective date.

### AIInteractionLog

Optional:

- task type;
- context references;
- model/runtime;
- schema result;
- user approval;
- raw prompt/output retention setting.

### Settings

- global;
- briefing;
- training;
- scheduler;
- analytics;
- AI;
- visual;
- sound;
- haptics;
- motion;
- privacy/export.

---

# 27. Persistence, offline behaviour and recovery

## 27.1 Offline-first

All core functions work without internet:

- Brief using local data/templates;
- Train;
- Progress;
- Lab;
- routine/exercise editing;
- local AI where installed;
- export creation.

## 27.2 Autosave

- every set change;
- timer state;
- review answer;
- routine edit draft;
- session state;
- Lab decision.

## 27.3 Crash/process recovery

On reopen:

- detect active session;
- restore active exercise;
- restore timers using timestamps;
- restore unsaved modal/review state where practical;
- explain any ambiguity;
- never duplicate a set silently.

## 27.4 Backup

Support:

- manual full backup;
- automatic local rolling backups;
- import/restore;
- schema migration preview;
- checksum validation;
- export to user-chosen storage;
- optional encrypted backup later.

## 27.5 Legacy data

The old web app may be treated as:

- interaction reference;
- source of useful setup notes;
- optional archive.

A complex migration is not required because the user is willing to start progression and exercises from scratch.

---

# 28. Privacy and safety

- Local data remains local by default.
- No account is required for core use.
- No cloud telemetry by default.
- AI Context Export is explicit.
- Notes and body assets are private.
- Personal photographs need not be stored in the app.
- The app does not diagnose.
- Pain/discomfort language must recommend appropriate caution without pretending to provide clinical advice.
- Permanent changes require user approval.
- Data deletion and full export are available.
- AI-generated content shows source facts on demand.

---

# 29. Performance requirements

Target device: Galaxy S25 Ultra.

## 29.1 Experience targets

- cold launch should feel immediate;
- active-session interactions should respond within roughly one frame;
- autosave must not block input;
- standard animation should sustain at least 60 fps;
- higher refresh may be used where available;
- particle density adapts to device load;
- body view loads without visible layout shift;
- no long AI task blocks the main UI;
- model loading has visible progress/cancel states;
- local AI memory is released when no longer required.

## 29.2 Battery

- analytics run incrementally where possible;
- expensive recomputation is deferred;
- AI use is user-initiated or clearly justified;
- particle systems pause when off-screen;
- background processing is minimal.

---

# 30. Testing strategy

## 30.1 Unit tests

- progression rules;
- mode prescriptions;
- & gate;
- routine versioning;
- scheduler constraints;
- confidence calculation;
- muscle-load aggregation;
- export schemas;
- migrations.

## 30.2 Integration tests

- Brief → Begin Session → mode selection;
- record set → timer → review → complete;
- active session recovery;
- B/C omission → catch-up candidate;
- Lab experiment → results → routine promotion;
- body asset replacement preserving muscle IDs;
- AI draft → schema validation → approval;
- backup/restore.

## 30.3 End-to-end tests

Run on the target Android device/emulator:

- one-handed session;
- screen lock and restore;
- offline use;
- music playing while sounds occur;
- haptics;
- long routine;
- low data/calibration state;
- model unavailable;
- model quota/busy/failure;
- interrupted export.

## 30.4 Visual regression

- all components;
- all density states;
- text scaling;
- long copy;
- empty/loading/error;
- modal blur;
- particle reduced-motion state;
- front/side/rear body.

## 30.5 UX acceptance tests

- user can begin a session without reading instructions;
- A/B/C choice feels neutral;
- user can tell why an exercise moved;
- user can inspect evidence behind an insight;
- Progress and Lab are not confused;
- permanent routine promotion is unmistakably deliberate;
- dense evidence is available but not forced;
- session entry remains calm under repeated use;
- sound/haptics add force without becoming annoying.

---

# 31. Development workstreams and release gate

These are coordinated workstreams, not partial product phases.

## 31.1 Workstreams

1. Experience architecture and prototypes.
2. Design system and component workshop.
3. Persistent data/domain foundation.
4. Exercise/routine library.
5. Train experience.
6. Briefing engine and page.
7. Progress analytics.
8. Lab and experiment workflow.
9. Dynamic scheduling.
10. Body illustration/particle system.
11. Sound/haptics/motion.
12. Local AI and export.
13. QA, performance and recovery.

## 31.2 Development order principle

Build vertical journeys rather than isolated technical layers.

Example vertical slice:

- create exercise;
- add to routine;
- begin session;
- record set;
- complete review;
- calculate one metric;
- display one insight;
- create one Lab experiment;
- promote to routine.

Then expand coverage while preserving the full loop.

## 31.3 Release gate

The app is not considered ready for real routine use until:

- all five bottom-nav areas are coherent;
- persistent offline data is reliable;
- exercise/routine editing is complete;
- A/B/C works;
- ψ/φ/π/& logic works;
- dynamic scheduling and Lab connect;
- routine promotion/versioning works;
- Progress has body and deep evidence;
- Brief is configurable;
- local AI has a fallback/no-AI path;
- sound/haptics/motion settings work;
- backup/restore works;
- active session recovery works;
- target-device testing passes.

Internal builds may be used for testing but are not described as the usable product.

---

# 32. Detailed acceptance criteria

## Brief

- [ ] Recommends a day, not a mode.
- [ ] Allows modules to be disabled.
- [ ] Shows concise and full layers.
- [ ] Begin Session loads routine behind mode modal.
- [ ] Copy is warm, observant and non-generic.
- [ ] No spoken voice.

## Train

- [ ] Ultra-compact, compact and expanded states.
- [ ] Card-stack hierarchy remains clear.
- [ ] Horizontal gestures have button alternatives.
- [ ] Set changes autosave.
- [ ] Exercise and rest timers are distinct.
- [ ] Review takes seconds in ordinary use.
- [ ] Active session survives interruption.
- [ ] Completion can be undone.
- [ ] Existing rep-drop protection rule is retained.

## Routine

- [ ] ψ/φ/π/& structure.
- [ ] & gate enforced.
- [ ] Principal does not move across days.
- [ ] Core/accessory movement respects settings.
- [ ] Every dynamic movement has a reason.
- [ ] Permanent change creates a version.

## Progress

- [ ] User-selected time windows.
- [ ] Exercise metric method is visible.
- [ ] Personalised body is not idealised.
- [ ] Front/side/rear views.
- [ ] Organic top layer and precise deep layer.
- [ ] Confidence is separate from direction.
- [ ] CNS/systemic fatigue is labelled as proxy.
- [ ] Progress claims are evidence-based.

## Lab

- [ ] Action centre, not duplicate analytics.
- [ ] Proposals include evidence and alternatives.
- [ ] Experiments have criteria and duration.
- [ ] User can edit/reject/defer.
- [ ] Successful experiment can migrate to base routine.
- [ ] Previous routine remains restorable.

## Library

- [ ] Create/edit/archive/clone exercise.
- [ ] Mode-specific prescriptions.
- [ ] Muscle-load vectors.
- [ ] Video/setup/progress notes.
- [ ] AI-assisted draft is reviewed before save.
- [ ] Routine editor previews effects.

## Visual/sensory

- [ ] Light kinetic-paper identity.
- [ ] No dark sci-fi default.
- [ ] Atmospheric glass reserved for suitable areas.
- [ ] Opaque surfaces for action/text.
- [ ] Particle language has meaning.
- [ ] Rest/charge/impact/release states.
- [ ] Sound does not interrupt music.
- [ ] Haptic vocabulary is consistent.
- [ ] Reduced-motion mode works.

## Technical

- [ ] Native Android shell.
- [ ] SQLite repository abstraction.
- [ ] Offline-first.
- [ ] AI capability detection.
- [ ] Deterministic no-AI fallback.
- [ ] Versioned knowledge packs.
- [ ] Full backup/restore.
- [ ] Schema migrations.
- [ ] Component gallery/visual tests.

---

# 33. Confirmed decisions

- Light, airy, paper-like interface.
- No dark default gym aesthetic.
- Sparse surface with progressively deeper information.
- Brief, Train, Progress, Lab and Library as primary areas.
- Lab is an action centre.
- Dynamic scheduling supports permanent routine optimisation.
- Successful experiments can be promoted into the base routine.
- Four days: ψ, φ, π and &.
- & cannot be recommended before the three core days are completed.
- User chooses A/B/C.
- Exercise cards have three information states.
- Dual exercise/rest timing.
- Structured short reviews.
- Personalised non-ideal body.
- 2D vector body with 2.5D treatment.
- Dot/particle motif throughout.
- Cinematic/spatial motion plus tactile functional motion.
- Written coach only.
- Coach voice is passionate, observant and British.
- Local-first data.
- On-device AI is optional to core function and must use a native bridge.
- Component system is standardised and versioned.
- Whole-loop completion is required before the app is considered usable.

---

# 34. Open decisions

These must be resolved during design/development, not guessed silently.

1. Product name.
2. Exact typefaces.
3. Exact palette and semantic colour mapping.
4. Final icon family.
5. Exact body illustration technique and asset workflow.
6. Exact particle renderer.
7. Exact sound assets.
8. Exact haptic waveforms supported by target device.
9. Exact React state/navigation libraries.
10. Exact SQLite Capacitor bridge.
11. System-AI availability on the target device at implementation time.
12. Fallback local model and quantisation.
13. Exact exercise comparison formulas.
14. Initial rewritten routine and exercise library.
15. Default review questions per exercise class.
16. Nutrition knowledge pack values and sources.
17. Default cycle start and catch-up rules for edge cases.
18. Whether estimated duration is enabled on first run.
19. Final gesture thresholds.
20. App-distribution method.

---

# 35. Change-control protocol

This document should remain the source of truth.

When a product decision changes:

1. Record the change.
2. State why.
3. Identify affected sections/entities/components.
4. Update the version.
5. Update the machine-readable JSON.
6. Add a migration requirement if stored data changes.
7. Do not leave contradictory behaviour in old sections.

Suggested versioning:

- patch: clarification/copy;
- minor: added feature or compatible behaviour;
- major: architecture, data model or core journey change.

---

# 36. One-paragraph reference summary

Build an offline-first Android personal training intelligence app for Kian using a native shell around a modular React/TypeScript interface. The product must connect Brief, Train, Progress, Lab and Library into one coherent loop. It uses ψ/φ/π core days plus an eligible & day, manual A/B/C mode selection, deeply modular exercises, persistent versioned data, deterministic progress/fatigue/scheduling engines, controlled experiments and explicit migration of successful changes into the base routine. Its visual language is light kinetic paper: warm surfaces, ink, grain, atmospheric blur, personalised 2.5D body illustration and meaningful particles. The surface is sparse and calm; deeper layers become analytical. Motion, sound and haptics create contained force at meaningful moments. The written coach is passionate, observant and British; the analyst is restrained; Lab is collaborative. Local AI may interpret notes, draft exercises and phrase briefings, but cannot replace deterministic calculation, constraints or user approval.
