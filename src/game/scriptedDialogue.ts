import type {
  CaseFile,
  EmotionalState,
  InterrogateApiRequest,
  InterrogateApiResponse,
  Suspect,
  SuspectTestimonyUnlock,
} from './types.ts';

function findTriggeredTestimony(
  suspect: Suspect,
  question: string,
  presentedClueId: string | null | undefined,
  discoveredClueIds: string[]
): SuspectTestimonyUnlock | undefined {
  const lower = question.toLowerCase();

  // Direct evidence presentation has highest priority
  if (presentedClueId && discoveredClueIds.includes(presentedClueId)) {
    const byPresented = suspect.unlockableTestimonies.find((t) =>
      t.triggerClueIds.includes(presentedClueId)
    );
    if (byPresented) return byPresented;
  }

  // Keyword questioning only triggers if player has discovered at least one supporting clue
  for (const testimony of suspect.unlockableTestimonies) {
    const hasSupportingClue = testimony.triggerClueIds.some((id) =>
      discoveredClueIds.includes(id)
    );
    if (!hasSupportingClue) continue;
    const mentionsKeyword = testimony.triggerKeywords.some((kw) => lower.includes(kw.toLowerCase()));
    if (mentionsKeyword) {
      return testimony;
    }
  }

  return undefined;
}

function pickByTurn(options: string[], historyLength: number): string {
  return options[historyLength % options.length];
}

export function generateScriptedInterrogationReply(
  caseFile: CaseFile,
  req: InterrogateApiRequest,
  _optionalNote?: string
): InterrogateApiResponse {
  const suspect = caseFile.suspects.find((s) => s.id === req.suspectId);
  if (!suspect) {
    return {
      reply: 'The suspect remains silent behind the interrogation glass.',
      emotionalState: 'composed',
      mode: 'local',
      contradictionReacted: false,
    };
  }

  const presentedClue = req.presentedClueId
    ? caseFile.clues.find(
        (c) => c.id === req.presentedClueId && req.discoveredClueIds.includes(c.id)
      )
    : undefined;

  const matchedTestimony = findTriggeredTestimony(
    suspect,
    req.question,
    presentedClue?.id,
    req.discoveredClueIds
  );

  const isContradictionClue =
    !!presentedClue && suspect.contradictionClueIds.includes(presentedClue.id);

  if (matchedTestimony) {
    let emotion: EmotionalState = suspect.isCulprit ? 'rattled' : 'cooperative';
    if (suspect.id === 'aris-thorne' && req.unlockedTestimonyIds.length === 0) {
      emotion = 'defensive';
    }
    return {
      reply: matchedTestimony.canonicalDisclosure,
      emotionalState: emotion,
      mode: 'local',
      unlockedTestimonyId: matchedTestimony.id,
      contradictionReacted: isContradictionClue || suspect.isCulprit,
    };
  }

  const turnCount = req.history.length;

  // Presented evidence that does not directly unlock a new testimony
  if (presentedClue) {
    if (suspect.id === 'aris-thorne') {
      if (presentedClue.id === 'ev_vault_log' || presentedClue.id === 'ev_silicone_dust') {
        return {
          reply:
            'A thermal sensor anomaly on a prototype safe? Hardly surprising—Julian insisted on rushing that lock firmware. As for silicone residue, half the optics industry uses it; that does not place me on the 42nd floor.',
          emotionalState: 'defensive',
          mode: 'local',
          contradictionReacted: true,
        };
      }
      if (presentedClue.id === 'ev_scotch_glass' || presentedClue.id === 'ev_sedative_vial') {
        return {
          reply:
            'Zolpidem in Julian’s scotch and Victor’s espresso? That sounds like Elena’s prescription—she was the one who left dinner furious. I drank sparkling water and went straight to my lab.',
          emotionalState: 'guarded',
          mode: 'local',
          contradictionReacted: true,
        };
      }
      if (presentedClue.id === 'ev_smartwatch' || presentedClue.id === 'ev_balcony_latch') {
        return {
          reply:
            'A shattered watch at 23:46 and storm damage on the terrace latch only prove someone confronted Julian while I was four floors below calibrating interferometers.',
          emotionalState: 'guarded',
          mode: 'local',
          contradictionReacted: false,
        };
      }
      return {
        reply: `You are showing me ${presentedClue.title}, Detective? Interesting, certainly—perhaps you should ask Elena or Marcus how it relates to their evening. I was in my 38th-floor lab.`,
        emotionalState: 'composed',
        mode: 'local',
        contradictionReacted: false,
      };
    }

    if (suspect.id === 'elena-rostova') {
      if (presentedClue.id === 'ev_sedative_vial') {
        return {
          reply:
            'Yes, I have a travel prescription for Zolpidem—I keep a spare pack in the 42F guest bath. If tablets were missing, someone took them out of that cabinet before dinner ended. I remember seeing Aris step out of that exact hallway around 22:15.',
          emotionalState: 'defensive',
          mode: 'local',
          contradictionReacted: true,
        };
      }
      if (presentedClue.id === 'ev_balcony_latch' || presentedClue.id === 'ev_cashmere_tag') {
        return {
          reply:
            'Charcoal cashmere? Look at my coat—I wore ivory wool tonight. Aris is the one who wears that tailored dark charcoal overcoat everywhere.',
          emotionalState: 'cooperative',
          mode: 'local',
          contradictionReacted: false,
        };
      }
      return {
        reply: `I don't know what you expect me to make of ${presentedClue.title}. If you think I had anything to do with harming Julian, you're chasing the wrong shadow.`,
        emotionalState: 'guarded',
        mode: 'local',
        contradictionReacted: false,
      };
    }

    if (suspect.id === 'marcus-chen') {
      if (presentedClue.id === 'ev_vault_log' || presentedClue.id === 'ev_silicone_dust') {
        return {
          reply:
            'Look at that 29.4°C sensor reading—I designed that lock! A live fingertip reads 33 to 36°C. That means somebody used a warmed platinum-cure silicone cast, and Aris Thorne is the only person in Obsidian Tower who keeps optical-grade silicone in his 38F lab.',
          emotionalState: 'cooperative',
          mode: 'local',
          contradictionReacted: false,
        };
      }
      if (presentedClue.id === 'ev_wheel_tracks' || presentedClue.id === 'ev_key_cabinet') {
        return {
          reply:
            'Wide dolly caster tracks and Service Lift Fob #3? That lift connects 42F directly down to the B2 freight bays without crossing the main lobby. Whoever used it knew the building cold.',
          emotionalState: 'cooperative',
          mode: 'local',
          contradictionReacted: false,
        };
      }
      return {
        reply: `Look at ${presentedClue.title}—I can't speak to what went down after 22:45, okay? I wasn't up in that study when the vault opened.`,
        emotionalState: 'defensive',
        mode: 'local',
        contradictionReacted: false,
      };
    }

    // Priya Nair presenting clues
    if (presentedClue.id === 'ev_cctv_gap' || presentedClue.id === 'ev_usb_dongle') {
      return {
        reply:
          'That ADM-04 override code belongs exclusively to Victor Hale and the two co-founders—Julian Vance and Dr. Aris Thorne. Neither Elena nor Marcus has clearance to loop the surveillance array.',
        emotionalState: 'cooperative',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (presentedClue.id === 'ev_zurich_wire') {
      return {
        reply:
          'That $4.2M Zurich transfer matches the offshore discrepancy Julian asked me to verify before dinner! He told me he was confronting the person responsible in his study at 23:45.',
        emotionalState: 'cooperative',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    return {
      reply: `Regarding ${presentedClue.title}, I only handled compliance files earlier that evening. Let me know if you need the executive access permissions or audit trail—I memorized the security matrix.`,
      emotionalState: 'cooperative',
      mode: 'local',
      contradictionReacted: false,
    };
  }

  // General natural-language topic matching without presented evidence
  const q = req.question.toLowerCase();

  if (suspect.id === 'aris-thorne') {
    if (q.includes('alibi') || q.includes('where') || q.includes('23:') || q.includes('midnight') || q.includes('time')) {
      return {
        reply:
          'I left dinner on 42F at 22:45 and went straight down to my 38th-floor optics lab. I stayed at the laser bench alone until your officers knocked at 01:00. I never set foot in B1 Security or the garage.',
        emotionalState: 'composed',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('vault') || q.includes('helios') || q.includes('prototype') || q.includes('safe') || q.includes('silicone')) {
      return {
        reply:
          'Helios-9 was our life’s work, locked inside Julian’s biometric wall vault. Only Julian’s thumbprint opens it—which is why I suspect he either opened it himself or someone coerced him.',
        emotionalState: 'composed',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('finance') || q.includes('money') || q.includes('audit') || q.includes('argue') || q.includes('zurich') || q.includes('motive')) {
      return {
        reply:
          'Julian and I disagreed over R&D budgets occasionally—every co-founder does. Nothing remotely worth disappearing over. If you have financial records, show them to me.',
        emotionalState: 'guarded',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('security') || q.includes('cctv') || q.includes('camera') || q.includes('victor') || q.includes('b1') || q.includes('garage') || q.includes('bay')) {
      return {
        reply:
          'I have no reason to visit B1 Security or the B2 garage during a storm. Victor handles the monitors, and my sedan stayed parked in Bay 23 all evening.',
        emotionalState: 'guarded',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('elena') || q.includes('marcus') || q.includes('priya') || q.includes('julian') || q.includes('dinner')) {
      return {
        reply:
          'Dinner was tense—Marcus was furious over his frozen stock vesting, and Elena barely spoke to Julian after calling off the engagement. Perhaps you should examine their motives rather than mine.',
        emotionalState: 'composed',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    return {
      reply: pickByTurn(
        [
          'Unless you have concrete physical evidence that contradicts my presence on the 38th floor, Detective, speculation will not bring Julian back.',
          'You are circling without proof, Detective. Present something from the building logs or the study if you wish to challenge my timeline.',
          'I have answered your questions plainly. Bring verified evidence to this table and I will address it.',
        ],
        turnCount
      ),
      emotionalState: 'composed',
      mode: 'local',
      contradictionReacted: false,
    };
  }

  if (suspect.id === 'elena-rostova') {
    if (q.includes('alibi') || q.includes('where') || q.includes('42') || q.includes('return') || q.includes('midnight') || q.includes('time')) {
      return {
        reply:
          'After dinner broke up at 22:45, I went down to my 40th-floor guest suite around 23:00. Yes, Julian and I ended our engagement, and yes, dinner was frostier than the storm—but I stayed in my suite.',
        emotionalState: 'guarded',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('dinner') || q.includes('strange') || q.includes('aris') || q.includes('marcus') || q.includes('priya') || q.includes('julian')) {
      return {
        reply:
          'Marcus was sweating bullets and left right at 22:45 after pouring Julian a scotch. Aris was unusually quiet—I even caught him coming out of the hallway by my 42F guest bath around 22:15.',
        emotionalState: 'guarded',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('pill') || q.includes('sleep') || q.includes('zolpidem') || q.includes('sedat') || q.includes('scotch') || q.includes('drug')) {
      return {
        reply:
          'I have a prescription for Zolpidem for travel insomnia—I keep a spare blister pack in the 42F guest bathroom cabinet. Why are you asking about my medication?',
        emotionalState: 'defensive',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('coat') || q.includes('button') || q.includes('cashmere') || q.includes('terrace') || q.includes('balcony')) {
      return {
        reply:
          'The storm was rattling the terrace glass all evening, so nobody stepped outside casually. And if you found dark cashmere thread, check Aris—he lives in that tailored charcoal overcoat.',
        emotionalState: 'cooperative',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    return {
      reply: pickByTurn(
        [
          'Julian was obsessed with an R&D audit all evening. If you actually have something from the study or security logs, put it on the table.',
          'Ending an engagement isn’t a crime, Detective. Show me what you found in the penthouse if you want straight answers.',
          'Ask me about dinner, my whereabouts, or present whatever log you’re holding—I’m not going to guess what you suspect.',
        ],
        turnCount
      ),
      emotionalState: 'guarded',
      mode: 'local',
      contradictionReacted: false,
    };
  }

  if (suspect.id === 'marcus-chen') {
    if (q.includes('ink') || q.includes('scotch') || q.includes('glass') || q.includes('pen') || q.includes('paperweight')) {
      return {
        reply:
          'My cobalt drafting ink? I mark schematic revisions with that pen all day! I poured Julian a scotch at 22:30 during dinner—if someone spiked that glass, it happened after I left.',
        emotionalState: 'defensive',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('alibi') || q.includes('lobby') || q.includes('where') || q.includes('22:45') || q.includes('car') || q.includes('garage') || q.includes('time')) {
      return {
        reply:
          'I took the main elevator down at 22:45 because Julian and I had words about my vesting schedule. I just waited out the storm downstairs in the lobby lounge until things cooled off.',
        emotionalState: 'defensive',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('vault') || q.includes('biometric') || q.includes('silicone') || q.includes('helios') || q.includes('prototype') || q.includes('safe')) {
      return {
        reply:
          'I engineered that wall safe’s sensor spec. It checks capacitive ridges AND skin warmth—anything under 31°C flags a thermal anomaly unless someone warms a platinum-cure silicone cast. Only Aris keeps that compound in his 38F optics lab.',
        emotionalState: 'cooperative',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    if (q.includes('aris') || q.includes('elena') || q.includes('priya') || q.includes('julian') || q.includes('motive')) {
      return {
        reply:
          'Julian froze my stock, sure—I was livid. But Aris has been acting cagey ever since Priya started pulling the Q3 R&D wire confirmations for Julian.',
        emotionalState: 'guarded',
        mode: 'local',
        contradictionReacted: false,
      };
    }
    return {
      reply: pickByTurn(
        [
          'Look, Julian froze my stock, which made me furious—not a kidnapper. Ask me about the vault hardware or show me what you pulled from the garage.',
          'I told you I stormed out at 22:45. If you have a log or receipt that says otherwise, put it in front of me.',
          'Ask me about the biometric lock or the scotch glass—I’m not hiding anything about what happened to Julian.',
        ],
        turnCount
      ),
      emotionalState: 'defensive',
      mode: 'local',
      contradictionReacted: false,
    };
  }

  // Priya Nair
  if (q.includes('audit') || q.includes('finance') || q.includes('23:45') || q.includes('meeting') || q.includes('zurich') || q.includes('money') || q.includes('draft')) {
    return {
      reply:
        'Before dinner, Julian asked me to pull Q3 R&D wire confirmations. Something on that ledger rattled him deeply—he said he was confronting someone in his study at 23:45 before the Helios-9 handoff.',
      emotionalState: 'cooperative',
      mode: 'local',
      contradictionReacted: false,
    };
  }
  if (q.includes('adm') || q.includes('camera') || q.includes('cctv') || q.includes('security') || q.includes('override') || q.includes('victor')) {
    return {
      reply:
        'The tower’s Executive Override key ADM-04 is strictly limited to Security Chief Victor and the two co-founders—Julian Vance and Dr. Aris Thorne. Nobody else has that credential.',
      emotionalState: 'cooperative',
      mode: 'local',
      contradictionReacted: false,
    };
  }
  if (q.includes('00:08') || q.includes('where') || q.includes('alibi') || q.includes('time') || q.includes('42')) {
    return {
      reply:
        'I was reviewing compliance notes in my 40th-floor guest suite after dinner... look, if you check the elevator ledger, you’ll see I ran back up briefly. Show me the log if you want the exact minute.',
      emotionalState: 'guarded',
      mode: 'local',
      contradictionReacted: false,
    };
  }
  if (q.includes('aris') || q.includes('elena') || q.includes('marcus') || q.includes('julian')) {
    return {
      reply:
        'Julian trusted Aris implicitly until this week’s wire audit. Elena left dinner hurt, and Marcus was worried about his equity—but only one executive had both offshore signing authority and ADM-04 clearance.',
      emotionalState: 'cooperative',
      mode: 'local',
      contradictionReacted: false,
    };
  }

  return {
    reply: pickByTurn(
      [
        'I’ll answer anything I know, Detective. Ask about the audit Julian was running, the security permissions, or show me any document you found.',
        'If you pull the elevator ledger or anything from Julian’s desk blotter, present it to me—I can verify every timestamp and clearance code.',
        'Check who holds Executive Override ADM-04 and who had access to the R&D wire accounts. Put the records on the table and I’ll walk you through them.',
      ],
      turnCount
    ),
    emotionalState: 'cooperative',
    mode: 'local',
    contradictionReacted: false,
  };
}
