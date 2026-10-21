# SLLM Missive — 0.1.0-alpha.9 Update

## Alpha 9 release integration

- Includes the current app implementation and assets; earlier release details below are retained.
- Pending war statements and delayed AI verdicts are cancelled when switching or reloading saves, preventing cross-save records and opinion requests.
- Rebuilt the runnable app and distribution code together to include missing or outdated modules.


## Changes since Alpha 7

### Office and policy additions
- Office styles: the Office changes with your empire's ethics. Automatic by default, or pick one under "Decorate office".
- Policy faction review: once factions exist, they vote when you declare a policy (does it fit their ethics; votes by support). Democracies need a majority; imperial, oligarchic and corporate governments may force it through at −10% approval from opposing factions for a year; dictatorships skip the review.
- English screens finished: error and help messages, notifications, the tray menu and window titles are in English, and so is the newspaper's default stance text.

### Cabinet meeting (replaces the faction council)
- When the council agenda slot is empty you meet the ministers actually sitting on your council (Minister of Defense, Head of Research, Minister of State, civic councilors, and gestalt nodes) instead of faction delegates. Hive minds and machine empires can hold one too.
- Each minister proposes an agenda for their post; adopting it applies two effects from that field for a year. Ministers backing the same agenda make a "joint proposal", and adopting it applies one effect from each post.
- Agendas: the ethic agendas plus 19 of the game's council agendas (Infinite Opportunities, Evolving Society, Conquer Nature, Build Relations, Chart the Unknown, Military Buildup and more). The mod checks the game's own conditions (traditions, DLC, empire type), so only agendas your empire could really pick appear.
- Ministers speak from the trust, memories and traits built in one-to-one calls. Paragons speak from their in-game backstory and catchphrase (read from your game folder).
- It opens when at least two councilors besides the ruler are seated. The Office then shows "The cabinet meeting is ready" and a tablet on the desk. The room is first-person: agendas on the central screen, ministers on both sides (holograms if they are away commanding a fleet, a science ship or a sector). You adopt an agenda on an approval card in the room.
- Faction voices moved to the policy "faction review"; the cabinet does not change faction approval.

### Embassy reports (Office "Embassy")
- For each empire you are in contact with, the embassy reports its faction trends and moves toward us ("Get latest" reads the game directly).
- Rivalries, claims, casus belli, fleet power, opinion, attitude and behavior add up to a forecast: Calm / Watch / Tension / War risk. With low intel, some signs show only as "unconfirmed".
- "Request ambassador's cable": the ambassador writes an outlook with recommendations (uses AI).

### Talking to Fallen Empires
- Fallen Empires treat us as lesser beings, in a tone that depends on their kind (xenophile: little creatures to protect; materialist: students to teach; spiritualist: an ignorant crowd to keep from the holy worlds; xenophobe: vermin beyond the border).
- A dormant Fallen Empire answers only when it chooses, and the talk is one-sided: each exchange raises its chance to hang up by 20%, and after a refusal or hang-up it will not answer again that year. Awakened empires are always full of wrath.

### Secretary
- Secretary added.

### Citizen petitions (Office "Citizen petitions")
- Now and then (2.25% a month) residents of one of your planets send a petition that fits that planet (amenities, housing, security, festival, jobs, family). Accepting costs resources and gives a 2-year benefit; refusing gives a small 1-year grievance (−2% happiness). Rarely a building task (build it within 2 years for +5% for 2 years). Hive minds and machine empires get none.

### Declarations of independence
- A newly independent nation circulates a declaration of independence, and you get a copy if you are in contact. New nations remember where they broke away from.

### Screen tidy-up
- The bottom-right overlay now holds only the Office, Newspaper, Interstellar Radio and Settings. The diplomatic terminal, governors, subjects and fleets open from the Office.
- Newspaper: paper page from the overlay icon, display page from the Office.
- A notice for exclusive fullscreen mode with a "Switch to borderless fullscreen" button (Settings → Game link).

## Fixes (Alpha 8)
- The newspaper masthead and brand icon could disappear; one-to-one call replies were cut off mid-sentence.
- A retirement notice appeared although the ruler had not retired.
- Galactic News opened in the Office had text that blended into the background.
- Fallen Empires were not recognized in a Korean-language game.
- Space monsters and special entities could be contacted (now only regular empires, enclaves, marauders and similar).
- Galactic Community resolution notices repeated.
- Citizen petitions showed raw text like { "title": ….
- Leader levels were not read from the game (mod error).

## Installation and validation
Close the game and app before installing. Paths, DLL and the optional local mod are the same as Alpha 7. **The mod changed, so update the Workshop subscription too** (connection protocol stays 5). Electron 31.7.7 is bundled; no separate Node.js installation or first-run download is needed. Existing user data is kept.
Build check: tsc build passed; self-tests PASS 2551 / FAIL 0 (sandbox). Checked in a real game on 2026-10-19: contact classification (Fallen Empire recognition, monsters and special entities blocked), the new council agenda conditions, adopting a cabinet agenda, petitions and the approval card. A real Windows install is validated separately.

## What changed in 0.1.0-alpha.7 (previous release)

### Office (new window)
- The overlay's "Office" button opens a holographic desktop on the ruler's desk. Its icons open Contacts, Personal letters, the Memorial, Policies and the existing windows (Planetary governors, Fleet Command, Subject channel, Press interview, Speech, Galactic News). Windows opened from the Office dock inside the hologram, translucent; "‹ Desktop" or Esc returns. The right side shows recent news from your chronicle, and the hologram turns red during a galactic crisis.
- Contacts: every month the app reads all your leaders (ruler, governors, admirals, generals, scientists, commanders, officials) with skill level, council seat, fleet and traits.
- One-to-one calls: "Open channel" with anyone. Each person gets a voice and personality on first contact (rooted in their in-game traits); when a call ends, a 1–2 line summary becomes their memory, and next time they bring up what you talked about. Trust rises and falls with conversations, hearings and skill gains.
- Personal letters: triggers such as level-ups, new traits, big battles or long silence are gathered for 6 months, then a few people write to you first (Off / Few / Normal). The letter is written by AI when you open the envelope. Granting a request (leave, recommending a colleague, 100 energy for their home world) gives +6 trust and the trait "Leader's Confidence" (+10% experience); refusing costs −3 trust. You can reply once.
- Farewells & Memorial: leaders who fall or pass away get a gravestone (tenure, battles, acclaim, letters, memories) and an AI epitaph in the Hall of Honor; dismissed or missing leaders go to "Departed". Close companions leave farewell letters (up to 3 a month), and colleagues remember the loss.

### Policy quests (Office "Policies")
- Up to one internal policy and one external policy (targeting another empire). Write the title and declaration freely (roleplay) and pick a length of 1, 2 or 3 years.
- Two goals: pick a buff and a difficulty (Easy +5% · Normal +10% · Hard +20%) and an upkeep condition of the same step is drawn at random (one reroll per condition). Internal = monthly resource income, stockpiles, capital stability, planet count, naval capacity, peace; external = the target's opinion (friendly or hostile), federation, Galactic Community, pacts, subject loyalty. AI only suggests three buffs that fit the declaration.
- Growth conditions have a 6-month ramp-up; after that, a missed goal gets a 2-month grace, then its buff ends with a 1-year penalty (internal: −5 stability on all planets; external: the target's opinion of us −50). If both goals fail or you repeal early, the policy collapses and that kind is blocked for a year. When it runs its course, take a legacy (tier-1 buff for a year) or extend.
- Declaring an external policy prompts a reply letter from the target; active policies feed the newspaper/radio chronicle, faction councils and one-to-one calls.

### Press interview "Government announcement" edicts
- Next to the reporter's three topics there is now a "Government announcement" slot (once per interview). Announce a policy yourself, reporters press you on it, and when you close it the editorial desk rates it and classifies it as an edict bundle (Xenophobic Purity, Open Borders to Aliens, Military Buildup, Peace Pledge, Order and Control, Expanded Civil Rights, Science First, Defense of the Faith, Economic Drive, Public Welfare) with a strength (Mild/Moderate/Strong).
- Before the interview ends, a confirmation card shows the gains, the cost and the opinion change of opposed empires, with a length of 1–3 years; it only enters the game once you confirm. Strength only scales the effects; a poor press reception lowers only the domestic gains by one step. A new edict replaces the one in force.
- Empires with the opposite ethic think less of you (−15/−30/−50) and one or two of them send a letter of protest. Newspapers and radio cover it next month (no extra AI call).
- An office policy you have not announced yet can be announced in this slot; a good reception waives its next penalty.

### Fleet Command & Subject channel
- Fleet hearings now have scenes: the press conference is a briefing room (podium, press gallery, flashes, breaking-news banner) and the in-person hearing an interrogation room (spotlight, inspector, battle files, verdict stamp).
- The subject channel is now a diplomatic office: letters are flagged, stamped documents and petitions/demands use an approval box.
- Petitions and demands now carry a real cost: resource aid (energy/minerals 150–400, food 100–300, alloys 50–150; you cannot approve without the stock) or research aid (our research speed −5%, theirs +5% for a year). Accepting an overlord's demand pays the same way; refusing it drops the overlord's opinion of us by 60 (recovers 5 a month).

### Scenes & languages
- New background art: the Office, the banquet hall (three welcome moods), the Galactic Council chamber, speech venues, the governor's office, and the fleet briefing and interrogation rooms.
- Language-pack add-ons: other interface languages (e.g. Chinese) can be added as an add-on ("language" in addon.json, string table and patterns, no code). Settings → Add-ons → "Create language pack skeleton" generates the list of strings to translate. Automatic language picks the pack matching the game language. Guide: ui/LANGUAGE_PACK_EN.md in the app folder.
- Remaining Korean text on English screens (radio/newspaper names, empty-state hints, environment check lines, log headers, etc.) has been translated.

### Fixes (Alpha 7)
- Planetary governor screens showed 0 population (4.x pop groups; the mod now reads pop_amount, and even an old mod shows an estimate instead of 0).
- Wars ending in a white peace (status quo) were described as one side's defeat in newspapers, radio and letters. Status-quo peace is now reported separately.
- The radio's "next broadcast" countdown mixed languages on English screens.

### Installation and validation (at Alpha 7)
Close the game and app before installing. Existing paths, DLL, optional local mod, and user data handling are retained. **The mod changed, so update the Workshop subscription too** (connection protocol stays 5). Electron 31.7.7 is bundled; no separate Node.js installation or first-run download is needed.
Build check: tsc build passed; self-tests PASS 2014 / FAIL 1 (one check needs the example image folder, absent in the build sandbox; it passes on a real PC). New game integrations (leader roster and trait reading, death/dismissal events, personal-letter requests and trait, policy measurement/buffs/penalties, edict effects and opposed-ethic opinion, subject resource/research aid, status-quo peace notice) and a real Windows install still need validation.

## What changed in 0.1.0-alpha.6 (previous release)
- Leader specimen requests (collection stage 3): between the 3rd and 9th message of a banquet, the guest leader may ask once for one specimen you own. [Give] raises the reward by one rarity step; [Refuse] costs −30 trust only if the guest is Materialist (regular or fanatic), otherwise nothing. The banquet favor cap of 5 is unchanged.
- Press interview: new edict "Press Interview" (no cost, 3-month preparation, 180-day cooldown). Pick one of three topics a reporter drew from your chronicle at a time; each topic the editors rate positively adds +3%, and the total (up to +9%) becomes a 1-year happiness buff. There is no penalty.
- Subject communications: a crown-icon window for letters with your subjects (or your overlord). Letters arrive when loyalty changes sharply or after the interval you set; answering a subject's petition with [Grant] or [Refuse] changes its loyalty by +1 or −1 per month for a year.
- Fleet Command: every admiral and general remembers their last 3 battles and faces a hearing, by press conference or in person. 3 good battles = acclaimed (+5% damage for 1 year, experience); 1 or fewer = reprimanded (−5% damage and a pay cut, 1 year).
- Interstellar radio
  - Follow-up coverage: continuing stories are reported as a follow-up to earlier news. Still one AI call per broadcast.
  - The radio chronicle now also carries recent newspaper chronicle entries.
  - Listen aloud: the 🔈 button in the radio window reads each line with Windows voices (free) or an AI voice (with a personal OpenAI connection, radio filter).
  - Galactic crisis coverage: when an endgame crisis appears, radio switches to an emergency broadcast and the newspaper prints one special edition that month.
- Chronicle book: "📖 Export as book" in the chronicle tab binds this save's chronicles and galactic news by year into a PDF or HTML file.
- Connection protocol 5: if the SLLM mod running in the game is older or newer than the app, you get one notice per connection. **Update the app and the mod together.**
- Faction council: with fewer than two factions, the council button now explains why it cannot open.
- Automatic interface language: when the interface language is 'Auto', SLLM follows Stellaris's game language (Korean game → Korean, any other language → English), falling back to the Windows language if the game settings cannot be read. The AI reply language follows too unless you set it separately.

### Fixes (Alpha 6)
- Concurrent gift, specimen and chat requests at a banquet could overwrite the favor record and exceed the cap of 5.
- After reloading an earlier autosave, accepting a proposal received before the reload (energy transfer, etc.) was still applied in game.
- After switching saves, radio could broadcast the previous save's news as the new save's.
- With the game paused, radio kept generating a fictional daily broadcast every 2 minutes, piling up AI calls (and voice calls).
- Closing the Fleet Command window while a hearing reply was arriving could apply acclaim/reprimand twice.
- Pressing finish again after a timeout could resend a speech buff or a galactic council forced decision.
- The new-year newspaper could be issued twice for the same date; press-interview material listed the same fact twice.
- Notices such as an API-key save failure were not shown in the Settings window.
- Reading a save while the game was still writing it raised errors and was retried on every access; escaped line breaks in species biographies were corrupted.

## Mod enabled but not detected
We reproduced a loading failure when a local upload copy and the Workshop subscription share the name SLLM Missive and Workshop ID 3819625112. Disabling one in the playset may be insufficient.
- Authors: close the game and launcher, then back up the local upload registration .mod file outside Documents/Stellaris/mod, or change its extension to .disabled. Keep ugc_3819625112.mod, which registers the subscription.
- Preserve the upload source folder and descriptor.mod. Restore the local registration when uploading and disable it again before testing the subscribed copy.
- Subscribers: deselect local mod installation and enable the Workshop copy. Do not enable two SLLM versions together.
The installer does not automatically change your upload registration.
