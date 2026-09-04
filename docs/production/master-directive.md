# PROJECT MASTER DIRECTIVE — SANTIAGO STREET

Open World Multiplayer Street Football · Master Game / Technical / Production Directive
Status: Active Development Specification · Initial mode: 3v3 · World: fictionalized Santiago
Approach: Vertical Slice → Systems → World → Multiplayer → Scale

> Engine note: the directive was written for Unreal Engine 5. Per **ADR-000** the engine is
> now a web 3D stack (Three.js client, Node/Colyseus server). Sections that name UE features
> (World Partition, Nanite, Lumen, Niagara, Control Rig, GAS, Enhanced Input) are to be read
> as their web equivalents described in ADR-000/ADR-004. Every other section applies verbatim.
> Visual target is refined in `docs/art/visual-target.md` (realistic mobile 3D).

## 1. Directive
Build the foundation of a commercial-quality game, not a concept demo. Make reasonable
technical/design decisions autonomously: choose the most robust solution, explain briefly,
document, implement, continue. Stop only for product-defining choices, credentials, paid
services, or significant legal/security risk.

## 2. Game vision
Start with nothing in a neighborhood → find a court → challenge better players → win → earn
money → build reputation → create a crew → control courts → explore the city → travel between
districts → build a team → enter bigger tournaments → be recognized → reach the international
street scene. "A football world in which the matches physically exist", not matches in a menu.

## 3. Design philosophy — GAMEPLAY FIRST
Priority: 1 responsiveness · 2 football mechanics · 3 camera · 4 ball physics · 5 animation ·
6 AI · 7 match flow · 8 progression · 9 world · 10 social · 11 multiplayer scale · 12 visual
fidelity. A beautiful world with mediocre football is a failure.

## 4–5. Inspiration without copying · IP policy
Broad inspiration (open worlds, street football, arcade sports, competitive multiplayer, RPG
progression, social worlds, territory) but ORIGINAL implementation. Never copy characters,
maps, logos, brands, uniforms, names, UI, sounds, animations, music, assets, systems or
identifiable designs. No real clubs, players, brands, leagues, tournaments, copyrighted music,
ripped assets, Street View or commercial map imagery. Fictional brands (VANTA, RUSH, KICKR,
NEXO, STREET9) are placeholders to be checked before commercial use.

## 6–10. World identity · map strategy · streaming · generation · geodata
Fictionalized Santiago: density, hills, plazas, residential/commercial/industrial areas, parks,
courts, metro-like transport, overhead infrastructure; Latin American/Chilean feel. Start with
ONE small district: 1 main court, 1 secondary court, training area, streets, public space, NPCs,
fictional shops, one fictional metro station, hidden locations, event locations. Design for
streaming in cells; never one monolithic level. Hybrid generation: procedural roads/buildings/
props; hand-authored courts, landmarks, hero streets. Geodata only from licence-compliant
sources (OSM etc.), verifying commercial use, attribution, redistribution, API, caching and
derivative rules. Google Maps/Street View are never game assets.

## 11–13. Visual target · engine strategy · performance
High-quality lighting, materials, characters, animation, environments, atmosphere, night
lighting, VFX, density, draw distance — via hierarchy PLAYER → BALL → COURT → IMMEDIATE
ENVIRONMENT → CITY. Evaluate every rendering technology against performance. Target 60 fps
baseline; measure regularly; no frame-time spikes.

## 14–15. Player character · character creator
Modular customization: body, head, hair, face, upper/lower clothing, footwear, accessories,
animations, celebrations. Creator: body presets, skin, face, hairstyle, features, clothing,
accessories. Modular and expandable, not infinite.

## 16–24. Football core
Run, sprint, stop, turn, accelerate/decelerate, receive, pass, shoot, dribble, shield, tackle,
intercept, recover. Responsive movement (acceleration, deceleration, sprint, stamina, turning,
blending). Independent ball (velocity, gravity, friction, bounce, collision, trajectories, walls)
that is predictable enough to master. Possession model: controlled, loose, pass, interception,
tackle, rebound, block, deflection — no ball glued to the foot. Passing: short, directional,
through, lob, wall, contextual. Shooting: normal, power, placed, chip, contextual; special shots
require skill. Dribbling: small responsive set first. Physicality without ragdoll. Stamina that
creates decisions without frustration.

## 25–30. Match format · rules · court experience · king of the court · ownership · reputation
3v3 first; 1v1/2v2/4v4/5v5 later. First to score OR time (5–10 min); later first-to-5, timed,
golden goal, king of the court, elimination, events. Courts exist physically: walk in, watch,
practice, challenge, matchmake, events, meet crew. King of the court: winners stay, rewards
grow with streaks. Court states: NEUTRAL, NPC_CONTROLLED, CREW_CONTROLLED, DISPUTED, EVENT,
LOCKED. Court reputation, level, history, wins/losses, controlling crew, activity.

## 31–37. Crews · ranks · territory · reputation · economy · progression · tiers
Crews: name, logo (curated), colors, motto, members, reputation, ranking, courts, stats.
Ranks FOUNDER/CAPTAIN/VETERAN/MEMBER/ROOKIE with configurable permissions. Territory = courts
controlled (simple first). Reputation ≠ XP. Fictional currency earned by play, spent on
cosmetics/training/celebrations/customization — never competitive power. Multiple progression
dimensions. Tiers: BARRIO → COMUNA → CIUDAD → REGIONAL → NACIONAL → INTERNACIONAL.

## 38–42. International content · tournaments · events · exploration · metro
Data model CITY → DISTRICTS → COURTS → EVENTS → TOURNAMENTS; never hardcode Santiago. Reusable
tournament architecture. Dynamic events (Open Court, King of the Court, Night Challenge,
Neighborhood Tournament, Crew Battle, Street Championship, Regional Challenge) with location,
time, duration, requirements, reward, difficulty. Exploration with purpose, no meaningless
collectibles. Fictional metro as fast travel (enter station → map → destination → transition →
arrival).

## 43–52. Day/night · weather · NPC AI · football AI · camera · animation · VFX · audio · music
Dynamic time (morning/day/afternoon/sunset/night); weather later. Scalable NPC simulation by
distance. Football AI: positioning, support, marking, pressure, counters — it makes mistakes.
Camera: third-person exploration; dynamic tactical third-person in matches; ball/player/
opponent visibility. Animation priority: running, turning, reception, dribbling, passing,
shooting, celebrations. Grounded VFX. Original sound and original/licensed music.

## 53–62. Social · voice · text · online architecture · networking · servers · database · security · reporting
Proximity/team/crew voice with mute/block/report; text channels with moderation and rate limits.
Authoritative multiplayer: client NEVER trusted for money, XP, inventory, results, ranking,
ownership, score. Replication, prediction, interpolation, reconciliation, disconnect recovery.
CLIENT → AUTH → MATCHMAKING → MATCH SERVER → PERSISTENCE. Zones/instances, not one giant server.
Persist player, crew, inventory, XP, money, reputation, stats, ownership, unlocks; separate
static config from player data. Layered anti-cheat; moderation-ready reporting model.

## 63–75. UI/UX · menus · map · discovery · identity · styles · skills · abilities · cosmetics · court personality · graffiti · landmarks
Minimal HUD. Menu: PLAY, MY PLAYER, MY CREW, MAP, INVENTORY, PROGRESSION, RANKINGS, SETTINGS.
Progressive discovery (UNKNOWN / PARTIALLY / DISCOVERED). Styles SPEEDSTER, DRIBBLER, PLAYMAKER,
FINISHER, DEFENDER, PHYSICAL as soft archetypes. Attributes SPEED, ACCELERATION, CONTROL,
DRIBBLE, PASS, SHOT, DEFENSE, PHYSICAL, STAMINA (normalized, data-tuned). No auto-win abilities.
All cosmetics fictional; no uploaded logos. Every court unique; original graffiti; fictional
landmarks.

## 76–93. Technical architecture · data-driven · input · controller-first · save · debug · telemetry · accessibility · localization · errors · logging · testing · profiling · performance
Modular gameplay components; data assets over hardcoded values; remappable input, controller-
first; offline local save, online server persistence; dev-only debug tools; privacy-respecting
telemetry; accessibility from the start; Spanish first, no hardcoded strings; no silent failures;
structured logs (Gameplay, Networking, AI, World, Backend, Auth, Economy, Persistence,
Performance); automated tests for score, goals, rewards, XP, reputation, inventory, ownership,
completion, disconnects, validation; profile regularly; LOD/HLOD/instancing/streaming/pooling;
NPC full/simplified/abstracted by distance; replicate only what matters.

## 94–104. Phases
0 Discovery · 1 Core movement · 2 Ball · 3 First match · 4 Vertical slice · 5 World systems ·
6 Crew · 7 Multiplayer · 8 Social · 9 Progression · 10 Polish. (See `roadmap.md`.)

## 105–107. First vertical slice · loops
Spawn → move → see NPCs → find court → enter → see players → start 3v3 → control → pass →
shoot → score → defend → finish → win/lose → XP → money → reputation → return. If this loop is
not fun, do not expand the world. Long-term loop up to "become legend".

## 108–121. Emotional design · rivalries · social stories · live world · missions · narrative · storytelling · quality strategy · UX · loading · transitions
Curiosity → competition → victory → progression → pride → rivalry → belonging → mastery.
Systemic stories over scripted missions; lightweight objectives first; light narrative layer.
Hero/secondary/background asset tiers. WORLD → INTERACTION → ACTION, minimal menus and loading.

## 122–145. Development rules
Always leave the project functional. Clear naming, modular classes, no magic numbers, no
premature frameworks. Clean asset pipeline and content database. Documentation in /docs; ADRs
for major decisions. Meaningful conventional commits; simple branching. Validate builds by
compiling, launching, testing, inspecting logs. No secrets in source control. Evaluate third-
party services (cost, scale, latency, reliability, licence, data, lock-in); abstract voice,
auth, matchmaking, persistence. Server-validated economy and match results; layered anti-cheat;
data privacy; accessibility; platform abstraction; controller support; crossplay-compatible
architecture; content-expandable architecture. Do NOT build yet: entire Santiago, other cities,
hundreds of courts, complex vehicles, MMO infra, advanced weather, story campaign, hundreds of
cosmetics, monetization, housing, giant quest system.

## 146–150. Milestones · quality bar
1 "One court that is fun" · 2 "One neighborhood that feels alive" · 3 "One crew that matters" ·
4 "A world people want to return to". Before expanding: is movement excellent? football? ball?
camera? animations? AI? scoring? losing → retry? exploration? progression? If not, POLISH.

## 151–156. Operating procedure · autonomy · no fake implementations · prototypes · placeholders · order
INSPECT → PLAN → IMPLEMENT → TEST → DEBUG → DOCUMENT → REPORT → continue. Distinguish
IMPLEMENTED / PROTOTYPE / MOCKED / PLANNED / BLOCKED. Isolate prototypes; track placeholders.
Order: audit, movement, camera, animation, ball, possession, passing, shooting, dribbling,
defense, goal, match state, 3v3 AI, court, vertical slice, progression, economy, world, crew,
ownership, multiplayer, voice, scale, polish.

## 157–160. Final experience · non-negotiables · first command · final directive
The player should think: "I am in a neighborhood… I found a court… I won… my crew wants this
court… we took the metro… there is a tournament tonight… we're moving up."
Non-negotiables: football fun; responsive controls; good ball; alive world; meaningful
progression; purposeful crews; courts matter; secure multiplayer; monitored performance;
original content; licence-compliant data; don't build everything at once; never hide debt;
never pretend a mock is production; always buildable.
Think like game director + lead engineer + technical artist + network architect + QA lead.
MAKE THE FOOTBALL FEEL INCREDIBLE.
