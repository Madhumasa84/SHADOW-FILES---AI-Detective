import type { CaseFile, CasePreviewMeta } from '../types';

export const CASE_ARCHIVE_PREVIEWS: CasePreviewMeta[] = [
  {
    id: 'midnight-disappearance',
    caseNumber: 'CASE 01',
    title: 'The Midnight Disappearance',
    subtitle: 'The Obsidian Tower · 42nd Floor Penthouse',
    playable: true,
    statusLabel: 'Active File',
    summary:
      'Tech founder Julian Vance vanishes from a locked penthouse during a midnight storm. Security footage is looped, an urgent draft was deleted, and the Helios-9 photonic prototype is gone.',
  },
  {
    id: 'velvet-ledger',
    caseNumber: 'CASE 02',
    title: 'The Velvet Ledger',
    subtitle: 'Meridian Private Bank · Vault Annex',
    playable: false,
    statusLabel: 'Sealed Archive',
    summary:
      'An antiquarian appraiser is found unconscious beside a forged bearer bond inside a time-locked bank vault with four keyholders.',
  },
  {
    id: 'last-ferry-north',
    caseNumber: 'CASE 03',
    title: 'Last Ferry to North Pier',
    subtitle: 'Harbor Line 7 · Fogbound Crossing',
    playable: false,
    statusLabel: 'Sealed Archive',
    summary:
      'A whistleblower boards the 00:40 harbor ferry with a locked briefcase and never steps ashore at the terminal.',
  },
];

export const MIDNIGHT_DISAPPEARANCE_CASE: CaseFile = {
  id: 'midnight-disappearance',
  caseNumber: 'CASE 01',
  title: 'The Midnight Disappearance',
  subtitle: 'The Obsidian Tower · 42nd Floor Penthouse',
  victimName: 'Julian Vance',
  incidentDate: 'Friday, November 20 · 23:15 – 00:10',
  titleBackdropUrl: '/src/assets/images/title_noir_city_1795184445554.jpg',
  briefing:
    'At 00:18 during a severe coastal storm, Aethelgard Optics CEO Julian Vance was reported missing from his locked 42nd-floor study. His biometric wall vault stands open and empty—the $40M Helios-9 photonic core is gone. Four company insiders were in the tower tonight. Inspect the scenes, expose lies in interrogation, link the physical proof on your evidence board, and name the culprit.',

  locations: [
    {
      id: 'penthouse-study',
      name: 'Penthouse Study',
      floorLabel: '42nd Floor · Locked Private Wing',
      shortDescription:
        'Julian Vance’s private study. Rain lashes the terrace doors while the biometric wall safe stands open.',
      atmosphereNote:
        'Smells of peated scotch, wet wool, and ozone from the storm outside. No sign of forced entry on the hall door.',
      imageUrl: '/src/assets/images/scene_penthouse_study_1795184357237.jpg',
      hotspots: [
        {
          id: 'hs_vault_log',
          clueId: 'ev_vault_log',
          label: 'Biometric Wall Vault',
          x: 19,
          y: 41,
          inspectSummary: 'The recessed steel vault stands ajar. The Helios-9 cradle inside is empty.',
          detailedExamination:
            'Built-in thermal audit strip records a clean unlock at 23:47 using Julian Vance’s registered right thumbprint—yet the capacitive sensor logged a surface temperature of 29.4°C, well below live human skin (33–36°C).',
        },
        {
          id: 'hs_scotch_glass',
          clueId: 'ev_scotch_glass',
          label: 'Crystal Scotch Tumbler',
          x: 45,
          y: 60,
          inspectSummary: 'A heavy crystal tumbler sits half-finished on the mahogany desk.',
          detailedExamination:
            'Field reagent swab detects dissolved Zolpidem sedative on the inner rim. A distinct smudge of cobalt-blue drafting ink marks the outer base—the kind hardware architects use on physical schematics.',
        },
        {
          id: 'hs_silicone_dust',
          clueId: 'ev_silicone_dust',
          label: 'Brass Paperweight',
          x: 50,
          y: 64,
          inspectSummary: 'Julian’s polished brass paperweight rests off-center near the blotter.',
          detailedExamination:
            'Under raking desk-lamp light, translucent flakes of platinum-cure dental silicone cling to the paperweight’s smooth crown—material used to cast high-precision fingerprint lifts.',
        },
        {
          id: 'hs_deleted_draft',
          clueId: 'ev_deleted_draft',
          label: 'Desk Blotter & Draft Cache',
          x: 59,
          y: 59,
          inspectSummary: 'Beneath the leather blotter lies a partially burned thermal printout from Julian’s encrypted terminal.',
          detailedExamination:
            'Recovered draft timestamped 23:15 addressed to Board Chair: "Confirmed the $4.2M offshore transfer routing to Zurich. Confronting them here at 23:45 before the Helios-9 handoff. Do not trust—"',
        },
        {
          id: 'hs_balcony_latch',
          clueId: 'ev_balcony_latch',
          label: 'Terrace Door Deadbolt',
          x: 80,
          y: 52,
          inspectSummary: 'Floor-to-ceiling storm glass overlooking the rain-soaked city.',
          detailedExamination:
            'The sliding terrace door is deadbolted from the inside, yet a four-foot rain puddle soaked the carpet directly underneath. Caught in the interior latch teeth is a snagged strand of charcoal cashmere thread.',
        },
        {
          id: 'hs_smartwatch',
          clueId: 'ev_smartwatch',
          label: 'Shattered Smartwatch',
          x: 86,
          y: 74,
          inspectSummary: 'Julian’s sapphire-glass smartwatch lies cracked near the terrace threshold.',
          detailedExamination:
            'The titanium strap clasp is intact—pulled over a limp wrist rather than snapped. Biometric telemetry froze at 23:54 after a sudden adrenaline spike at 23:49 followed by abrupt impact.',
        },
      ],
    },
    {
      id: 'security-room',
      name: 'Security Control Room',
      floorLabel: 'Basement Level B1 · Monitoring Hub',
      shortDescription:
        'Subterranean surveillance hub housing CCTV arrays, elevator keycard ledgers, and the maintenance key locker.',
      atmosphereNote:
        'Night guard Victor Hale was found slumped in his chair at 00:25, groggy and unable to recall the past hour.',
      imageUrl: '/src/assets/images/scene_security_room_1795184343689.jpg',
      hotspots: [
        {
          id: 'hs_service_fob_hook',
          clueId: 'ev_service_fob_hook',
          label: 'Wall Key Cabinet',
          x: 13,
          y: 47,
          inspectSummary: 'The brushed-steel maintenance cabinet hangs slightly open.',
          detailedExamination:
            'Hook #3—labeled "Service Lift Master Fob"—is empty. The brass cabinet latch carries a faint, sharp trace of bergamot cologne mixed with optical-lab isopropyl antiseptic.',
        },
        {
          id: 'hs_keycard_log',
          clueId: 'ev_keycard_log',
          label: 'Elevator Access Terminal',
          x: 34,
          y: 64,
          inspectSummary: 'The tower’s automated badge printer tracks every floor swipe and freight load.',
          detailedExamination:
            '22:45 Marcus Chen (#108) 42F→1F. 23:32 Elena Rostova (#102) 40F→42F. 23:36 Dr. Aris Thorne (#105) 38F→B1 Security. 23:55 Service Lift (Master Fob #3) 42F→B2 Garage, load sensor: 168 lbs. 00:08 Priya Nair (#114) 40F→42F.',
        },
        {
          id: 'hs_cctv_gap',
          clueId: 'ev_cctv_gap',
          label: 'CCTV Surveillance Bank',
          x: 50,
          y: 48,
          inspectSummary: 'Nine monochrome monitors cycle quietly through corridors and stairwells.',
          detailedExamination:
            'Feeds 42-A (Penthouse Hall) and 42-B (Service Lift) were placed on a 30-minute loop from 23:40 to 00:10. The override command used Executive Admin Key ADM-04 entered physically at Terminal B1-2 at 23:38.',
        },
        {
          id: 'hs_coffee_cup',
          clueId: 'ev_coffee_cup',
          label: 'Guard’s Espresso Cup',
          x: 59,
          y: 65,
          inspectSummary: 'Victor Hale’s half-drunk porcelain espresso cup sits beside the console keyboard.',
          detailedExamination:
            'Toxicology strip confirms a heavy dissolved dose of Zolpidem matching the sedative in Julian’s scotch. Victor remembers a tower executive stopping by at 23:20 to ask about server cooling.',
        },
        {
          id: 'hs_usb_dongle',
          clueId: 'ev_usb_dongle',
          label: 'Server Rack #3 Backup',
          x: 88,
          y: 56,
          inspectSummary: 'A black industrial server rack hums against the damp concrete wall.',
          detailedExamination:
            'Wedged behind Rack #3 is an unplugged thermal-camera backup drive. Its last un-looped frame at 00:02 in B2 Garage shows a tall figure in a tailored overcoat wheeling a silver equipment trunk and clutching a glowing cryo-case.',
        },
      ],
    },
    {
      id: 'underground-garage',
      name: 'Underground Garage',
      floorLabel: 'Basement Level B2 · Freight Bay',
      shortDescription:
        'Stormwater seeps across the concrete floor between the freight elevator and executive parking bays.',
      atmosphereNote:
        'Sodium-vapor lamps buzz overhead. Julian’s own coupe remains parked untouched in Bay 21.',
      imageUrl: '/src/assets/images/scene_underground_garage_1795184354085.jpg',
      hotspots: [
        {
          id: 'hs_parking_receipt',
          clueId: 'ev_parking_receipt',
          label: 'Freight Bay Gate Scanner',
          x: 24,
          y: 52,
          inspectSummary: 'The automated plate-reader box beside the steel freight lift doors.',
          detailedExamination:
            'Only two resident vehicles left between 22:45 and 01:00: Marcus Chen’s silver coupe exited East Gate at 22:52; Dr. Aris Thorne’s black sedan exited the South Freight Ramp at 00:06.',
        },
        {
          id: 'hs_sedative_vial',
          clueId: 'ev_sedative_vial',
          label: 'Shadow by Pillar 22',
          x: 33,
          y: 70,
          inspectSummary: 'A crumpled foil blister pack lies partially tucked behind concrete Pillar 22.',
          detailedExamination:
            'Empty 10mg Zolpidem prescription strip bearing Elena Rostova’s pharmacy label—two tablets popped cleanly out. The foil is completely dry despite the wet garage floor, suggesting it was dropped deliberately.',
        },
        {
          id: 'hs_zurich_wire',
          clueId: 'ev_zurich_wire',
          label: 'Metal Trash Drum',
          x: 41,
          y: 62,
          inspectSummary: 'A dented galvanized trash drum sits next to Pillar 22.',
          detailedExamination:
            'Crumpled private-bank courier receipt dated three days ago: $4,200,000 wired from Aethelgard R&D Reserve to "Helvetia Bio-Optics AG, Zurich", countersigned with Chief Scientist Dr. Aris Thorne’s dual-key cipher.',
        },
        {
          id: 'hs_trunk_wheel',
          clueId: 'ev_trunk_wheel',
          label: 'Wet Caster Wheel Tracks',
          x: 61,
          y: 72,
          inspectSummary: 'Dual narrow tracks cut straight through a rain puddle on the concrete slab.',
          detailedExamination:
            'Heavy-load polyurethane caster tracks—identical to Aethelgard’s rolling optical-equipment trunks—run directly from the Service Freight Elevator into empty Parking Bay 23, leased exclusively to Dr. Aris Thorne.',
        },
        {
          id: 'hs_cashmere_tag',
          clueId: 'ev_cashmere_tag',
          label: 'Bay 23 Rain Gutter',
          x: 84,
          y: 76,
          inspectSummary: 'Something dark caught along the yellow painted border of Bay 23.',
          detailedExamination:
            'A dark horn sleeve button torn loose with a loop of charcoal cashmere yarn still threaded through its eyelets—an exact microscopic weave match to the thread snagged on the 42F terrace door latch.',
        },
      ],
    },
  ],

  clues: [
    {
      id: 'ev_vault_log',
      code: 'EV-01',
      title: 'Biometric Vault Thermal Audit',
      category: 'digital',
      locationId: 'penthouse-study',
      timestamp: '23:47',
      shortSummary: 'Vault opened with Julian’s thumbprint, but sensor recorded an unnatural 29.4°C skin temperature.',
      fullText:
        'Audit Strip #42-V: Unlocked 23:47:11 via Registered Print [J. VANCE]. Capacitive thermal reading: 29.4°C (WARNING: Sub-dermal threshold anomaly). Helios-9 containment cradle sensor reports removal at 23:47:49.',
      forensicNote:
        'Live human fingertips register 33–36°C. A 29.4°C reading strongly indicates a warmed artificial fingerprint cast rather than Julian opening his own vault.',
      relatedSuspectIds: ['aris-thorne', 'marcus-chen'],
      defaultBoardPos: { x: 80, y: 60 },
    },
    {
      id: 'ev_scotch_glass',
      code: 'EV-02',
      title: 'Sedated Scotch Tumbler',
      category: 'forensic',
      locationId: 'penthouse-study',
      timestamp: '22:30',
      shortSummary: 'Contains dissolved Zolpidem sedative plus a smudge of cobalt drafting ink on the glass base.',
      fullText:
        'Crystal tumbler from study desk. Inner rim positive for Zolpidem tartrate. Outer base carries cobalt-blue technical drafting ink commonly used by Marcus Chen.',
      forensicNote:
        'Misleading surface impression: the ink smudge shows who handed Julian the glass earlier, not necessarily who dropped the sedative into it later.',
      isRedHerring: true,
      relatedSuspectIds: ['marcus-chen', 'elena-rostova'],
      defaultBoardPos: { x: 320, y: 60 },
    },
    {
      id: 'ev_silicone_dust',
      code: 'EV-03',
      title: 'Platinum-Cure Silicone Flakes',
      category: 'forensic',
      locationId: 'penthouse-study',
      timestamp: 'Prior to 23:45',
      shortSummary: 'Dental-grade silicone residue found on Julian’s smooth brass paperweight.',
      fullText:
        'Micro-flakes of translucent platinum-cure silicone recovered from the crown of Julian’s desk paperweight. Used in optical prototyping labs and for lifting clean latent ridge impressions.',
      forensicNote:
        'Someone lifted Julian’s thumbprint directly off the paperweight he handled every day—and platinum-cure silicone is stocked in the 38th-floor optics lab.',
      relatedSuspectIds: ['aris-thorne', 'marcus-chen'],
      defaultBoardPos: { x: 340, y: 220 },
    },
    {
      id: 'ev_deleted_draft',
      code: 'EV-04',
      title: 'Deleted Board Warning Draft',
      category: 'document',
      locationId: 'penthouse-study',
      timestamp: '23:15',
      shortSummary: 'Julian discovered a $4.2M Zurich transfer and scheduled a 23:45 confrontation.',
      fullText:
        'Recovered thermal printout [23:15]: "To Board Chair — Confirmed the $4.2M offshore transfer routing to Zurich. Confronting them here at 23:45 before the Helios-9 handoff. Do not trust—"',
      forensicNote:
        'Establishes both the exact confrontation time (23:45) and the financial betrayal Julian had just uncovered.',
      relatedSuspectIds: ['aris-thorne', 'priya-nair'],
      defaultBoardPos: { x: 560, y: 60 },
    },
    {
      id: 'ev_balcony_latch',
      code: 'EV-05',
      title: 'Terrace Latch & Cashmere Thread',
      category: 'physical',
      locationId: 'penthouse-study',
      timestamp: '23:58',
      shortSummary: 'Deadbolted from inside despite rain pooling indoors; charcoal cashmere thread snagged on bolt.',
      fullText:
        'Interior latch locked, yet carpet shows heavy rain ingress from an open door minutes earlier. One coarse strand of charcoal cashmere yarn is caught on the metal lever.',
      forensicNote:
        'Staged to suggest a terrace incident—yet someone closed and locked the door from inside after a struggle, snagging a luxury charcoal overcoat.',
      relatedSuspectIds: ['aris-thorne', 'elena-rostova'],
      defaultBoardPos: { x: 780, y: 60 },
    },
    {
      id: 'ev_smartwatch',
      code: 'EV-06',
      title: 'Cracked Smartwatch Telemetry',
      category: 'digital',
      locationId: 'penthouse-study',
      timestamp: '23:54',
      shortSummary: 'Heart rate spiked at 23:49 then signal cut at 23:54; strap clasp unbroken.',
      fullText:
        'Julian Vance’s smartwatch. Heart rate dropped steadily from 23:05 (sedation), spiked sharply at 23:49 (sudden struggle), and flatlined off-wrist at 23:54 when dropped onto marble.',
      forensicNote:
        'Proves Julian was still inside the study and alive during a brief struggle at 23:49—two minutes after the vault was opened.',
      relatedSuspectIds: ['aris-thorne', 'priya-nair'],
      defaultBoardPos: { x: 780, y: 230 },
    },
    {
      id: 'ev_service_fob_hook',
      code: 'EV-07',
      title: 'Missing Master Fob #3',
      category: 'physical',
      locationId: 'security-room',
      timestamp: '23:36 – 23:40',
      shortSummary: 'Service Elevator Master Fob #3 is gone; cabinet smells of bergamot and lab antiseptic.',
      fullText:
        'B1 Key Cabinet Hook #3 (Service Lift Master Fob — bypasses resident card logging) is missing. Handle carries traces of bergamot cologne and optical-grade isopropyl.',
      forensicNote:
        'Whoever took Fob #3 used the Service Elevator anonymously without leaving a named badge swipe.',
      relatedSuspectIds: ['aris-thorne'],
      defaultBoardPos: { x: 320, y: 230 },
    },
    {
      id: 'ev_keycard_log',
      code: 'EV-08',
      title: 'Tower Elevator Access Ledger',
      category: 'digital',
      locationId: 'security-room',
      timestamp: '22:45 – 00:08',
      shortSummary: 'Logs Aris Thorne entering B1 Security at 23:36 and a 168-lb Service Lift run at 23:55.',
      fullText:
        '22:45 Chen (#108) 42F→1F · 23:32 Rostova (#102) 40F→42F · 23:36 Thorne (#105) 38F→B1 Security · 23:55 Service Lift (Fob #3) 42F→B2 Garage [Load: 168 lbs] · 00:08 Nair (#114) 40F→42F.',
      forensicNote:
        'Directly shatters Dr. Thorne’s claim that he never left 38F, and exposes Elena’s hidden 23:32 visit to 42F. Julian Vance weighs approximately 165 lbs.',
      relatedSuspectIds: ['aris-thorne', 'elena-rostova', 'marcus-chen', 'priya-nair'],
      defaultBoardPos: { x: 80, y: 400 },
    },
    {
      id: 'ev_cctv_gap',
      code: 'EV-09',
      title: 'CCTV Loop Override Log',
      category: 'digital',
      locationId: 'security-room',
      timestamp: '23:38',
      shortSummary: 'Penthouse cameras looped 23:40–00:10 using Executive Key ADM-04 from Terminal B1-2.',
      fullText:
        'System Audit: At 23:38:04, local operator at Terminal B1-2 engaged 30-minute video loop on Feeds 42-A & 42-B using Admin Key ADM-04 (issued only to Security Chief & Co-Founders).',
      forensicNote:
        'Executed exactly two minutes after Dr. Aris Thorne badged into the B1 Security Room at 23:36.',
      relatedSuspectIds: ['aris-thorne', 'priya-nair'],
      defaultBoardPos: { x: 320, y: 400 },
    },
    {
      id: 'ev_coffee_cup',
      code: 'EV-10',
      title: 'Spiked Security Espresso Cup',
      category: 'forensic',
      locationId: 'security-room',
      timestamp: '23:20',
      shortSummary: 'Guard Victor’s espresso was laced with Zolpidem twenty minutes before the CCTV loop.',
      fullText:
        'Porcelain cup from Terminal B1-2 positive for Zolpidem. Guard Victor Hale collapsed asleep at 23:25 shortly after an executive visited B1 claiming to inspect server cooling.',
      forensicNote:
        'Same sedative found in Julian’s scotch glass—both victims were incapacitated by the same insider.',
      relatedSuspectIds: ['aris-thorne', 'elena-rostova'],
      defaultBoardPos: { x: 560, y: 400 },
    },
    {
      id: 'ev_usb_dongle',
      code: 'EV-11',
      title: 'Un-Looped Thermal Backup Frame',
      category: 'digital',
      locationId: 'security-room',
      timestamp: '00:02',
      shortSummary: 'Shows a figure in a long coat wheeling a rolling trunk and glowing cryo-case in B2 Garage.',
      fullText:
        'Recovered from unplugged backup USB behind Rack #3. Thermal still [00:02:18, B2 Freight Bay]: silhouette in tailored overcoat rolling a large equipment trunk toward Bay 23 while carrying the Helios-9 cryo-case.',
      forensicNote:
        'The trunk emits an internal 36.5°C human heat signature—proving Julian was smuggled out alive and sedated inside the trunk.',
      relatedSuspectIds: ['aris-thorne'],
      defaultBoardPos: { x: 560, y: 230 },
    },
    {
      id: 'ev_parking_receipt',
      code: 'EV-12',
      title: 'Garage Gate Plate-Scanner Log',
      category: 'digital',
      locationId: 'underground-garage',
      timestamp: '22:52 & 00:06',
      shortSummary: 'Marcus Chen drove out at 22:52; Dr. Aris Thorne’s sedan exited South Freight Ramp at 00:06.',
      fullText:
        'Automated Gate Ledger: [22:52] Silver Coupe (M. Chen) exited East Gate. [00:06] Black Sedan (Dr. A. Thorne, Bay 23) exited South Freight Ramp during storm peak.',
      forensicNote:
        'Clears Marcus Chen from the 23:36–00:06 window while catching Dr. Thorne fleeing four minutes after the 00:02 thermal trunk footage.',
      relatedSuspectIds: ['aris-thorne', 'marcus-chen'],
      defaultBoardPos: { x: 780, y: 400 },
    },
    {
      id: 'ev_sedative_vial',
      code: 'EV-13',
      title: 'Elena’s Empty Zolpidem Blister',
      category: 'physical',
      locationId: 'underground-garage',
      timestamp: 'Planted ~00:04',
      shortSummary: 'Prescription insomnia tablets in Elena Rostova’s name—suspiciously dry on a wet floor.',
      fullText:
        'Two-tablet blister pack of 10mg Zolpidem prescribed to Elena Rostova. Found tucked behind Pillar 22 completely dry despite pooling rainwater nearby.',
      forensicNote:
        'Planted red herring: Elena kept a spare strip in the 42F guest bath medicine cabinet, accessible to anyone who attended the 22:15 dinner.',
      isRedHerring: true,
      relatedSuspectIds: ['elena-rostova', 'aris-thorne'],
      defaultBoardPos: { x: 320, y: 530 },
    },
    {
      id: 'ev_zurich_wire',
      code: 'EV-14',
      title: 'Zurich $4.2M Wire Slip',
      category: 'document',
      locationId: 'underground-garage',
      timestamp: '3 Days Prior',
      shortSummary: 'Authorized $4.2M R&D transfer to a Zurich shell company using Dr. Thorne’s cipher.',
      fullText:
        'Private Bank Confirmation: $4,200,000 debited from Aethelgard R&D Reserve to Helvetia Bio-Optics AG (Zurich). Dual-key authorization token: CH-SCI-THORNE-01.',
      forensicNote:
        'Hard financial motive: Dr. Aris Thorne was embezzling R&D reserves and Julian caught him hours before tonight’s meeting.',
      relatedSuspectIds: ['aris-thorne', 'priya-nair'],
      defaultBoardPos: { x: 560, y: 530 },
    },
    {
      id: 'ev_trunk_wheel',
      code: 'EV-15',
      title: 'Bay 23 Caster Wheel Tracks',
      category: 'physical',
      locationId: 'underground-garage',
      timestamp: '00:02',
      shortSummary: 'Wet rolling equipment trunk tracks lead straight from the Service Lift to Thorne’s Bay 23.',
      fullText:
        'Narrow heavy-load polyurethane wheel marks track from the B2 Service Freight Lift across 45 feet of wet concrete directly into Parking Bay 23 (leased to Dr. Aris Thorne).',
      forensicNote:
        'Physically connects the 168-lb Service Elevator descent directly to Dr. Thorne’s vehicle bay.',
      relatedSuspectIds: ['aris-thorne'],
      defaultBoardPos: { x: 80, y: 530 },
    },
    {
      id: 'ev_cashmere_tag',
      code: 'EV-16',
      title: 'Torn Horn Button & Cashmere Yarn',
      category: 'physical',
      locationId: 'underground-garage',
      timestamp: '00:04',
      shortSummary: 'Dark horn coat button with charcoal cashmere fibers found in Bay 23 rain gutter.',
      fullText:
        'Bespoke cuff button with torn charcoal cashmere loop recovered beside Bay 23. Fiber weave and dye lot match the snagged thread on the 42F penthouse terrace latch.',
      forensicNote:
        'Unbroken physical chain from the struggle in the 42nd-floor study straight to Dr. Thorne’s parking bay.',
      relatedSuspectIds: ['aris-thorne'],
      defaultBoardPos: { x: 780, y: 530 },
    },
  ],

  suspects: [
    {
      id: 'aris-thorne',
      name: 'Dr. Aris Thorne',
      role: 'Chief Scientist & Co-Founder',
      age: 46,
      portraitUrl: '/src/assets/images/portrait_aris_thorne_1795184360784.jpg',
      initialEmotion: 'composed',
      personality:
        'Cool, urbane, precision-minded European physicist. Speaks in measured sentences, treats questioning like a tedious administrative error, and only cracks under hard converging forensic proof.',
      background:
        'Co-founded Aethelgard Optics with Julian Vance seven years ago. Designed the core lenses of Helios-9, wears a tailored charcoal cashmere overcoat, and works out of the private 38th-floor optics lab.',
      claimedAlibi:
        'Claims he left Julian’s 42F dinner at 22:45 and remained alone inside his 38th-floor optics lab calibrating laser interferometers until police called him at 01:00. Insists he never visited B1 Security or the B2 Garage.',
      apparentMotive:
        'Embezzled $4.2M from Aethelgard R&D Reserve to a Zurich shell account and needed to silence Julian’s 23:45 board confrontation while escaping with the Helios-9 prototype.',
      accessibleKnowledge: [
        'Attended dinner in Julian’s 42F penthouse from 21:30 to 22:45 with Elena, Marcus, and Priya.',
        'Knows Julian was agitated about an upcoming board audit and kept Helios-9 in his 42F biometric vault.',
        'Knows platinum-cure dental silicone is standard lens-molding material in the 38F optics lab.',
        'Knows Executive Admin Key ADM-04 is held by himself, Julian, and Guard Victor.',
        'Parks his black sedan in B2 Underground Garage, Bay 23.',
      ],
      privateSecrets: [
        'Stole two of Elena’s Zolpidem tablets from the 42F guest bath during dinner to sedate Guard Victor (23:20) and Julian.',
        'Cast a silicone lift of Julian’s thumbprint from the brass paperweight earlier in the week.',
        'Entered B1 Security at 23:36, looped cameras 42-A and 42-B with ADM-04 at 23:38, and took Service Master Fob #3.',
        'Opened the vault at 23:47, sedated and transported Julian alive in a rolling optical trunk down the Service Lift at 23:55 to Bay 23, and drove out at 00:06 to hide Julian at his coastal boathouse.',
      ],
      initialLies: [
        'Swears he stayed on Floor 38 from 22:45 until 01:00 without leaving his lab.',
        'Claims he never went down to B1 Security or B2 Garage tonight.',
        'Suggests Elena’s unstable temper or Marcus’s bitterness over frozen stock explains Julian’s disappearance.',
      ],
      inaccessibleFacts: [
        'Does NOT know Marcus Chen drove out to interview with a rival firm at 22:52.',
        'Does NOT know Priya Nair came back up to 42F at 00:08 to fetch her tablet.',
        'Does NOT know investigators already found the unplugged thermal backup USB behind Rack #3 unless the detective explicitly presents it.',
      ],
      isCulprit: true,
      contradictionClueIds: [
        'ev_keycard_log',
        'ev_cctv_gap',
        'ev_parking_receipt',
        'ev_usb_dongle',
        'ev_zurich_wire',
        'ev_cashmere_tag',
        'ev_vault_log',
        'ev_silicone_dust',
      ],
      suggestedQuestions: [
        'Where were you between 23:00 and midnight?',
        'Did you go down to the B1 Security Room or garage tonight?',
        'What do you know about the Helios-9 prototype vault?',
        'Were you and Julian arguing about company finances?',
      ],
      unlockableTestimonies: [
        {
          id: 'test_aris_b1_admit',
          title: 'Thorne Admits Visiting B1 Corridor',
          summary:
            'Confronted with the elevator ledger or CCTV log, Dr. Thorne backpedals and admits going to B1 at 23:36—claiming he only checked on an HVAC alarm.',
          triggerClueIds: ['ev_keycard_log', 'ev_cctv_gap'],
          triggerKeywords: ['23:36', 'security', 'adm-04', 'keycard', 'elevator', 'loop'],
          canonicalDisclosure:
            'Fine—I stepped down to B1 at 23:36 because my lab cooling alarm tripped. Victor was dozing at the console, so I left. That proves nothing about the cameras.',
        },
        {
          id: 'test_aris_garage_crack',
          title: 'Thorne Caught Leaving Garage at 00:06',
          summary:
            'When shown the 00:06 gate scanner log or thermal trunk footage, Thorne loses composure and invents a late-night pharmacy errand.',
          triggerClueIds: ['ev_parking_receipt', 'ev_usb_dongle', 'ev_trunk_wheel', 'ev_cashmere_tag'],
          triggerKeywords: ['00:06', 'bay 23', 'garage', 'sedan', 'trunk', 'thermal', 'button'],
          canonicalDisclosure:
            'I drove out at 00:06 to clear my head in the storm—I have migraines! You cannot connect a coat button or blurry thermal frame to Julian’s disappearance.',
        },
        {
          id: 'test_aris_zurich_deflect',
          title: 'Thorne Confirms Helvetia Zurich Account',
          summary:
            'Pressed with the Zurich wire slip, Thorne admits authorizing the $4.2M transfer but claims it was a confidential vendor advance.',
          triggerClueIds: ['ev_zurich_wire', 'ev_deleted_draft'],
          triggerKeywords: ['zurich', 'helvetia', '4.2', 'wire', 'embezzle', 'transfer'],
          canonicalDisclosure:
            'Helvetia Bio-Optics was an off-books cleanroom reserve I authorized for next quarter’s optics run. Julian overreacted—he never understood the cost of staying ahead.',
        },
      ],
      openingStatement:
        'Detective. A tragic storm-night chaos, and I have already given my statement to the uniformed officers. I was in my 38th-floor optics lab calibrating lenses from 22:45 until you summoned me. Please be brief.',
    },
    {
      id: 'elena-rostova',
      name: 'Elena Rostova',
      role: 'Chief Operating Officer & Ex-Fiancée',
      age: 34,
      portraitUrl: '/src/assets/images/portrait_elena_rostova_1795184367900.jpg',
      initialEmotion: 'guarded',
      personality:
        'Sharp, poised, fiercely defensive of her reputation. Masks hurt pride behind corporate composure, but turns incisively helpful once she realizes someone tried to frame her.',
      background:
        'Built Aethelgard’s commercial operations alongside Julian. Engaged to Julian until a bitter breakup three weeks ago; stayed in the 40th-floor guest suite during the storm.',
      claimedAlibi:
        'Initially claims she went down to her 40th-floor guest suite at 23:00 and slept through the storm until police knocked.',
      apparentMotive:
        'Recently broken engagement and disputed founder equity split; her prescribed Zolpidem blister was found in the B2 garage.',
      accessibleKnowledge: [
        'Attended dinner on 42F until 22:45; saw Marcus hand Julian a scotch glass around 22:30.',
        'Keeps a spare strip of prescription 10mg Zolpidem for insomnia in the 42F guest bathroom cabinet.',
        'Noticed Dr. Aris Thorne lingering near the 42F guest bathroom around 22:15 wearing his charcoal cashmere overcoat and bergamot cologne.',
        'Knows Julian was obsessively auditing R&D wires all evening.',
      ],
      privateSecrets: [
        'Returned to 42F at 23:32 to argue with Julian about calling off their wedding and demanding her equity buyout.',
        'Found Julian already unusually drowsy and slurring words on his sofa at 23:34; she left angry at 23:40 before anyone else arrived.',
      ],
      initialLies: [
        'Initially denies returning to the 42nd floor at 23:32 because she fears becoming the prime suspect.',
      ],
      inaccessibleFacts: [
        'Does NOT know who looped the CCTV cameras or how the biometric vault was bypassed.',
        'Does NOT know Julian was wheeled down the Service Elevator to Bay 23.',
        'Does NOT know Marcus left the building at 22:52.',
      ],
      isCulprit: false,
      contradictionClueIds: ['ev_keycard_log', 'ev_sedative_vial'],
      suggestedQuestions: [
        'Did you return to the 42nd floor after dinner?',
        'Tell me about your Zolpidem prescription.',
        'Did you notice anyone acting strangely during dinner?',
        'How did Julian seem the last time you saw him?',
      ],
      unlockableTestimonies: [
        {
          id: 'test_elena_2332_confess',
          title: 'Elena Admits 23:32 Visit — Julian Already Sedated',
          summary:
            'Confronted with the elevator log, Elena admits seeing Julian at 23:32 and reveals he was already drowsy and slurring after drinking his scotch.',
          triggerClueIds: ['ev_keycard_log', 'ev_scotch_glass'],
          triggerKeywords: ['23:32', 'elevator', 'keycard', '42f', 'return', 'drowsy'],
          canonicalDisclosure:
            'Alright—I went back up to 42F at 23:32 to settle our breakup terms. Julian was barely coherent on the sofa, slurring about someone betraying him at 23:45. I stormed out at 23:40—he was alive when I left.',
        },
        {
          id: 'test_elena_thorne_pills',
          title: 'Elena Identifies Thorne Near Medicine Cabinet & Cashmere Coat',
          summary:
            'Shown her planted Zolpidem blister or cashmere fiber, Elena recalls catching Aris Thorne near her 42F bath cabinet at 22:15 and confirms his signature charcoal cashmere overcoat and bergamot cologne.',
          triggerClueIds: ['ev_sedative_vial', 'ev_balcony_latch', 'ev_cashmere_tag', 'ev_service_fob_hook'],
          triggerKeywords: ['zolpidem', 'pills', 'blister', 'cashmere', 'bergamot', 'coat', 'frame'],
          canonicalDisclosure:
            'Someone stole that spare Zolpidem strip from my 42F bath cabinet to frame me! Wait—at 22:15 I saw Aris Thorne stepping out of that hallway in his charcoal cashmere coat, reeking of bergamot.',
        },
      ],
      openingStatement:
        'If you are here to treat an ex-fiancée as the automatic suspect, Detective, save us both the cliché. I retired to the 40th-floor guest suite at 23:00 and stayed there.',
    },
    {
      id: 'marcus-chen',
      name: 'Marcus Chen',
      role: 'Lead Hardware Architect',
      age: 37,
      portraitUrl: '/src/assets/images/portrait_marcus_chen_1795184399538.jpg',
      initialEmotion: 'defensive',
      personality:
        'Fast-talking, restless, technically brilliant, and visibly stressed. Easily rattled when accused of loyalty breaches, but lights up with crisp analytical insight when examining hardware forensics.',
      background:
        'Julian’s college roommate and lead designer of Helios-9’s housing and biometric vault electronics. Habitually marks schematics with cobalt-blue technical drafting ink.',
      claimedAlibi:
        'Initially claims he left 42F at 22:45 and sat in the ground-floor lobby lounge waiting for a cab until 23:30.',
      apparentMotive:
        'Julian froze his stock vesting last week, and Marcus’s cobalt drafting ink was found on Julian’s sedated scotch glass.',
      accessibleKnowledge: [
        'Poured and handed Julian his scotch glass at 22:30 during dinner—leaving a smudge of cobalt drafting ink from his fingers.',
        'Designed the biometric wall vault’s sensor spec: it rejects fingertips below 31°C unless fooled by a warmed platinum-cure silicone cast.',
        'Knows Dr. Aris Thorne keeps platinum-cure dental silicone in the 38th-floor optics lab for custom lens molds.',
        'Knows the tower’s rolling silver optical-equipment trunks weigh 25 lbs empty and fit a grown adult.',
      ],
      privateSecrets: [
        'He did NOT wait in the lobby—he drove his silver coupe out the East Gate at 22:52 to secretly interview with a rival CEO at a Midtown hotel until 00:30.',
        'Lied about staying in the lobby only because a non-compete violation would void his remaining equity.',
      ],
      initialLies: [
        'Claims he waited in the ground-floor lobby lounge from 22:45 to 23:30 because of the storm.',
      ],
      inaccessibleFacts: [
        'Does NOT know what happened inside Obsidian Tower after 22:52 because he genuinely drove away.',
        'Does NOT know about the $4.2M Zurich wire or who spiked Guard Victor’s espresso.',
      ],
      isCulprit: false,
      contradictionClueIds: ['ev_parking_receipt', 'ev_scotch_glass'],
      suggestedQuestions: [
        'Why is your cobalt drafting ink on Julian’s scotch glass?',
        'Did you really stay in the lobby after 22:45?',
        'How could someone open Julian’s biometric vault without forced entry?',
        'Who in this tower uses platinum-cure silicone?',
      ],
      unlockableTestimonies: [
        {
          id: 'test_marcus_alibi_truth',
          title: 'Marcus Confesses 22:52 Midtown Interview (Alibi Verified)',
          summary:
            'Caught by the 22:52 garage exit log, Marcus admits driving out to meet a rival firm—confirming he left the tower nearly an hour before the crime.',
          triggerClueIds: ['ev_parking_receipt', 'ev_scotch_glass'],
          triggerKeywords: ['22:52', 'gate', 'coupe', 'east gate', 'lobby', 'ink', 'interview'],
          canonicalDisclosure:
            'Okay, stop—I didn’t wait in the lobby! I drove out the East Gate at 22:52 to meet Meridian Optics about jumping ship. Check the Midtown hotel valet cameras—I wasn’t even in the tower when Julian vanished!',
        },
        {
          id: 'test_marcus_silicone_lab',
          title: 'Marcus Links 29.4°C Vault Anomaly to Thorne’s 38F Silicone Lab',
          summary:
            'Examining the vault thermal log or silicone flakes, Marcus explains how a warmed platinum-cure silicone mold fakes a thumbprint—and confirms only Dr. Thorne stocks that compound on 38F.',
          triggerClueIds: ['ev_vault_log', 'ev_silicone_dust'],
          triggerKeywords: ['29.4', 'thermal', 'vault', 'silicone', 'paperweight', 'biometric', 'mold'],
          canonicalDisclosure:
            'Wait—29.4°C on the vault sensor and platinum-cure silicone? That’s a warmed fingerprint cast! You press dental silicone onto a smooth surface Julian touches, then warm it in your palm. Only Aris Thorne stocks platinum-cure silicone in his 38F optics lab!',
        },
      ],
      openingStatement:
        'Look, Detective, Julian and I argued about my vesting schedule earlier, sure, everybody knows that. I rode down to the lobby at 22:45 and waited out the storm. I had nothing to do with this.',
    },
    {
      id: 'priya-nair',
      name: 'Priya Nair',
      role: 'Executive Assistant & Compliance Auditor',
      age: 29,
      portraitUrl: '/src/assets/images/portrait_priya_nair_1795184362305.jpg',
      initialEmotion: 'guarded',
      personality:
        'Meticulous, observant, earnest but visibly anxious about legal liability and board fallout. Respects concrete evidence and gives crystal-clear timeline details once reassured.',
      background:
        'Manages Julian’s executive calendar and internal compliance audits. Assisted Julian with Q3 R&D financial reviews before dinner and stayed in a 40th-floor guest suite.',
      claimedAlibi:
        'Claims she worked in her 40th-floor suite from 22:45 until she noticed police sirens at 00:20.',
      apparentMotive:
        'Was logged entering 42F at 00:08—just ten minutes before Julian was reported missing—and waited before calling police.',
      accessibleKnowledge: [
        'Helped Julian pull Q3 R&D wire logs at 21:00; Julian looked pale when he flagged a $4.2M Zurich transfer.',
        'Knows Julian scheduled a private 23:45 confrontation in his study with the person behind the offshore wire.',
        'Confirms Executive CCTV Admin Key ADM-04 is restricted solely to Guard Victor, Julian Vance, and Dr. Aris Thorne.',
        'Knows Elena and Marcus do NOT possess ADM-04.',
      ],
      privateSecrets: [
        'Returned to 42F at 00:08 to pick up her compliance tablet; found the study empty, rain soaked across the carpet, and Julian’s watch cracked by the terrace.',
        'Panicked for ten minutes trying to phone Julian before finally alerting building security at 00:18.',
      ],
      initialLies: [
        'Initially omits her 00:08 visit to 42F out of fear that waiting ten minutes to call police looks suspicious.',
      ],
      inaccessibleFacts: [
        'Does NOT know the exact name of the Zurich shell company unless shown the wire slip.',
        'Does NOT know Julian was moved in a rolling trunk through the B2 garage.',
      ],
      isCulprit: false,
      contradictionClueIds: ['ev_keycard_log', 'ev_deleted_draft'],
      suggestedQuestions: [
        'What financial issue was Julian auditing tonight?',
        'Why did your keycard log on the 42nd floor at 00:08?',
        'Who holds the ADM-04 security override key?',
        'Did Julian tell you who he was meeting at 23:45?',
      ],
      unlockableTestimonies: [
        {
          id: 'test_priya_0008_scene',
          title: 'Priya Admits 00:08 Visit & Confirms 23:45 Confrontation',
          summary:
            'Shown the elevator log or deleted draft, Priya admits going up at 00:08 to fetch her tablet—finding the study already empty—and confirms Julian planned to confront the $4.2M embezzler at 23:45.',
          triggerClueIds: ['ev_keycard_log', 'ev_deleted_draft', 'ev_smartwatch'],
          triggerKeywords: ['00:08', '23:45', 'draft', 'zurich', 'tablet', '42f'],
          canonicalDisclosure:
            'I shouldn’t have hidden it—I went up at 00:08 for my audit tablet. The room was already empty, the carpet drenched, and Julian’s watch cracked. Earlier at 22:00 he told me he found a $4.2M Zurich wire and was confronting the executive responsible at 23:45.',
        },
        {
          id: 'test_priya_adm04_holders',
          title: 'Priya Confirms Only Co-Founders Hold Key ADM-04',
          summary:
            'Asked about the CCTV override log, Priya confirms that ADM-04 belongs exclusively to Guard Victor, Julian Vance, and Dr. Aris Thorne.',
          triggerClueIds: ['ev_cctv_gap', 'ev_zurich_wire'],
          triggerKeywords: ['adm-04', 'cctv', 'override', 'camera', 'cipher', 'access'],
          canonicalDisclosure:
            'I drafted the tower security matrix myself. Executive Override ADM-04 is only issued to three people: Security Chief Victor, Julian Vance, and Co-Founder Dr. Aris Thorne. Neither Elena nor Marcus has it.',
        },
      ],
      openingStatement:
        'Detective, please tell me you have a lead on Julian. I was reviewing audit files in the 40th-floor guest suite all evening—I want to help however I can.',
    },
  ],

  contradictions: [
    {
      id: 'con_b1_alibi',
      title: 'Alibi Breach: B1 Security Override',
      clueIds: ['ev_keycard_log', 'ev_cctv_gap'],
      kind: 'contradiction',
      implicatedSuspectId: 'aris-thorne',
      deductionText:
        'Dr. Aris Thorne swiped into B1 Security at 23:36—two minutes before Executive Key ADM-04 looped the 42F cameras at 23:38, shattering his 38F lab alibi.',
      proofNote: 'Directly disproves Thorne’s alibi and ties him to the camera blackout.',
    },
    {
      id: 'con_biometric_forge',
      title: 'Biometric Forgery: 29.4°C Silicone Cast',
      clueIds: ['ev_vault_log', 'ev_silicone_dust'],
      kind: 'forensic_link',
      implicatedSuspectId: 'aris-thorne',
      deductionText:
        'The vault’s 29.4°C thermal anomaly proves Julian did not open it himself—platinum-cure silicone from his brass paperweight was used to forge his thumbprint.',
      proofNote: 'Explains how the locked biometric vault was opened without Julian’s consent.',
    },
    {
      id: 'con_garage_extraction',
      title: 'Midnight Extraction: Trunk to Bay 23',
      clueIds: ['ev_usb_dongle', 'ev_parking_receipt'],
      kind: 'contradiction',
      implicatedSuspectId: 'aris-thorne',
      deductionText:
        'Thermal footage at 00:02 shows a figure wheeling a warm rolling trunk and the Helios-9 cryo-case toward Bay 23; four minutes later at 00:06, Dr. Thorne’s sedan fled the garage.',
      proofNote: 'Disproves Thorne’s claim he never left the tower and explains how Julian vanished.',
    },
    {
      id: 'con_cashmere_chain',
      title: 'Physical Chain: 42F Latch to Bay 23',
      clueIds: ['ev_balcony_latch', 'ev_cashmere_tag'],
      kind: 'forensic_link',
      implicatedSuspectId: 'aris-thorne',
      deductionText:
        'Charcoal cashmere snagged on the staged 42F terrace deadbolt matches the torn horn cuff button dropped in Bay 23—linking the study struggle directly to Dr. Thorne.',
      proofNote: 'Exposes the terrace suicide/escape staging and places Thorne in both rooms.',
    },
    {
      id: 'con_zurich_motive',
      title: 'Hidden Motive: $4.2M Zurich Embezzlement',
      clueIds: ['ev_deleted_draft', 'ev_zurich_wire'],
      kind: 'motive',
      implicatedSuspectId: 'aris-thorne',
      deductionText:
        'Julian’s deleted 23:15 board warning about a $4.2M Zurich transfer matches the Helvetia Bio-Optics wire authorized with Dr. Aris Thorne’s executive cipher.',
      proofNote: 'Establishes why Julian scheduled the 23:45 confrontation and why Thorne acted.',
    },
  ],

  timeline: [
    {
      time: '22:15',
      title: 'Penthouse Dinner & Sedative Theft',
      description: 'All four suspects dine with Julian on 42F. Thorne slips near Elena’s guest bath cabinet.',
      revealedByClueIds: ['ev_sedative_vial'],
    },
    {
      time: '22:30',
      title: 'Scotch Poured with Drafting Ink',
      description: 'Marcus hands Julian a scotch tumbler (leaving cobalt ink). Later spiked with Zolpidem.',
      revealedByClueIds: ['ev_scotch_glass'],
    },
    {
      time: '22:45 – 22:52',
      title: 'Marcus Chen Leaves the Tower',
      description: 'Marcus rides down to 1F at 22:45 and drives his silver coupe out East Gate at 22:52.',
      revealedByClueIds: ['ev_keycard_log', 'ev_parking_receipt'],
    },
    {
      time: '23:15',
      title: 'Julian Drafts Urgent Board Warning',
      description: 'Julian uncovers the $4.2M Zurich transfer and prepares a 23:45 confrontation.',
      revealedByClueIds: ['ev_deleted_draft', 'ev_zurich_wire'],
      isCritical: true,
    },
    {
      time: '23:20 – 23:25',
      title: 'Security Guard Victor Sedated',
      description: 'Victor’s espresso in B1 Security is spiked with Zolpidem; he falls unconscious at 23:25.',
      revealedByClueIds: ['ev_coffee_cup'],
      isCritical: true,
    },
    {
      time: '23:32 – 23:40',
      title: 'Elena’s Brief Visit to 42F',
      description: 'Elena confronts Julian on 42F, finds him already drowsy from sedation, and leaves at 23:40.',
      revealedByClueIds: ['ev_keycard_log'],
    },
    {
      time: '23:36 – 23:38',
      title: 'Thorne Enters B1 & Loops Cameras',
      description: 'Dr. Thorne badges into B1 Security at 23:36, takes Master Fob #3, and loops 42F CCTV with ADM-04 at 23:38.',
      revealedByClueIds: ['ev_keycard_log', 'ev_cctv_gap', 'ev_service_fob_hook'],
      isCritical: true,
    },
    {
      time: '23:47',
      title: 'Vault Opened with Silicone Mold',
      description: 'Biometric safe unlocks at 29.4°C using a silicone cast lifted from Julian’s paperweight; Helios-9 removed.',
      revealedByClueIds: ['ev_vault_log', 'ev_silicone_dust'],
      isCritical: true,
    },
    {
      time: '23:49 – 23:54',
      title: 'Struggle by Terrace & Staged Lock',
      description: 'Julian wakes briefly, grabs Thorne’s cashmere coat (snagging thread/button); watch cracks at 23:54.',
      revealedByClueIds: ['ev_smartwatch', 'ev_balcony_latch', 'ev_cashmere_tag'],
      isCritical: true,
    },
    {
      time: '23:55',
      title: '168-lb Service Elevator Descent',
      description: 'Master Fob #3 operates the Service Lift from 42F directly to B2 Garage carrying 168 lbs.',
      revealedByClueIds: ['ev_keycard_log', 'ev_trunk_wheel'],
      isCritical: true,
    },
    {
      time: '00:02 – 00:06',
      title: 'Garage Extraction & Escape',
      description: 'Thermal backup catches a coated figure wheeling a warm trunk to Bay 23; Thorne’s sedan exits South Ramp at 00:06.',
      revealedByClueIds: ['ev_usb_dongle', 'ev_parking_receipt'],
      isCritical: true,
    },
    {
      time: '00:08',
      title: 'Priya Discovers Empty Study',
      description: 'Priya returns to 42F for her tablet, finds the drenched floor and cracked watch, and alerts security at 00:18.',
      revealedByClueIds: ['ev_keycard_log'],
    },
  ],

  motiveOptions: [
    {
      id: 'motive_embezzlement_prototype',
      label: 'Embezzlement Cover-Up & Helios-9 Theft',
      description:
        'Silenced Julian before he could expose the $4.2M Zurich R&D embezzlement to the board, while stealing the Helios-9 prototype.',
    },
    {
      id: 'motive_spurned_engagement',
      label: 'Bitter Breakup & Founder Equity Dispute',
      description:
        'Retaliated against Julian for calling off their engagement and refusing an immediate executive equity buyout.',
    },
    {
      id: 'motive_vesting_espionage',
      label: 'Frozen Stock Vesting & Rival Defection',
      description:
        'Stole the Helios-9 hardware prototype as leverage after Julian froze stock vesting prior to a rival job offer.',
    },
    {
      id: 'motive_audit_blackmail',
      label: 'Compliance Cover-Up & Board Blackmail',
      description:
        'Removed Julian to conceal falsified Q3 compliance filings and take control of the board emergency vote.',
    },
  ],

  solution: {
    culpritId: 'aris-thorne',
    motiveId: 'motive_embezzlement_prototype',
    keyProofClueIds: [
      'ev_keycard_log',
      'ev_cctv_gap',
      'ev_vault_log',
      'ev_silicone_dust',
      'ev_usb_dongle',
      'ev_parking_receipt',
      'ev_zurich_wire',
      'ev_cashmere_tag',
      'ev_trunk_wheel',
    ],
    minRequiredProofClues: 3,
    fullExplanation: [
      'Motive: Three days before the storm, Dr. Aris Thorne wired $4.2M from Aethelgard’s R&D Reserve to a Zurich shell account (EV-14). Julian uncovered the transfer and drafted an urgent 23:15 board alert planning to confront Thorne at 23:45 (EV-04).',
      'Preparation: During the 22:15 dinner, Thorne lifted two of Elena’s Zolpidem tablets to frame her (EV-13), spiked Julian’s scotch (EV-02), and earlier cast Julian’s thumbprint from the brass paperweight using 38F lab platinum-cure silicone (EV-03).',
      'Blackout: At 23:20 Thorne drugged Guard Victor’s espresso (EV-10). At 23:36 he swiped into B1 Security (EV-08), stole Master Fob #3 (EV-07), and triggered the 30-minute CCTV loop with Co-Founder Key ADM-04 at 23:38 (EV-09).',
      'The Vault & Extraction: At 23:47 Thorne bypassed the biometric safe using the 29.4°C silicone cast to take Helios-9 (EV-01). When the drowsy Julian briefly resisted at 23:49, he tore a horn button and charcoal cashmere fibers from Thorne’s coat (EV-05, EV-06, EV-16).',
      'Escape: Thorne loaded the sedated Julian into a rolling equipment trunk, took the Service Lift to B2 Garage at 23:55 (168 lbs, EV-08), rolled him to Bay 23 on un-looped thermal camera at 00:02 (EV-11, EV-15), and drove out the South Freight Ramp at 00:06 (EV-12).',
    ],
    epilogueSolved:
      'Confronted with the unbroken forensic chain from the 42nd-floor vault to Bay 23, Dr. Aris Thorne’s composure finally shatters. Police trace his sedan’s midnight toll transponder to a coastal boathouse forty minutes north—where Julian Vance is recovered alive, recovering from heavy sedation, alongside the sealed Helios-9 cryo-case.',
    epilogueUnsupported:
      'You identified the right mastermind—Dr. Aris Thorne—but your evidentiary packet lacked enough hard forensic proof to survive an emergency warrant hearing. Thorne’s counsel blocks the coastal search for six hours; by the time police arrive, the Helios-9 prototype is gone and Thorne has boarded a private charter to Zurich.',
    epilogueWrongSuspect:
      'The District Attorney issues an arrest warrant against the wrong executive. While precious overnight hours burn in interrogation, Dr. Aris Thorne slips past port customs with the Helios-9 prototype, leaving Julian Vance’s trail dangerously cold.',
  },
};

export function getCaseById(caseId: string): CaseFile | undefined {
  if (caseId === MIDNIGHT_DISAPPEARANCE_CASE.id) {
    return MIDNIGHT_DISAPPEARANCE_CASE;
  }
  return undefined;
}
