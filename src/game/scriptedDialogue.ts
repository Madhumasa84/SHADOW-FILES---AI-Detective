import type {
  CaseFile,
  EmotionalState,
  InterrogateApiRequest,
  InterrogateApiResponse,
  Suspect,
  SuspectTestimonyUnlock,
} from './types';

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

export function generateScriptedInterrogationReply(
  caseFile: CaseFile,
  req: InterrogateApiRequest,
  fallbackReason: string
): InterrogateApiResponse {
  const suspect = caseFile.suspects.find((s) => s.id === req.suspectId);
  if (!suspect) {
    return {
      reply: 'The suspect remains silent behind the interrogation glass.',
      emotionalState: 'composed',
      mode: 'scripted_fallback',
      fallbackReason,
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
      mode: 'scripted_fallback',
      fallbackReason,
      unlockedTestimonyId: matchedTestimony.id,
      contradictionReacted: isContradictionClue || suspect.isCulprit,
    };
  }

  // Presented evidence that does not directly unlock a testimony
  if (presentedClue) {
    if (suspect.id === 'aris-thorne') {
      if (presentedClue.id === 'ev_vault_log' || presentedClue.id === 'ev_silicone_dust') {
        return {
          reply:
            'A thermal sensor glitch on a prototype safe? Hardly surprising—Julian insisted on rushing that lock firmware. As for silicone, half the optics industry uses it; that does not put me on the 42nd floor.',
          emotionalState: 'defensive',
          mode: 'scripted_fallback',
          fallbackReason,
          contradictionReacted: true,
        };
      }
      return {
        reply: `You are showing me ${presentedClue.title}, Detective? Interesting, certainly—perhaps you should ask Elena or Marcus how it relates to their evening. I was in my 38th-floor lab calibrating lenses.`,
        emotionalState: 'composed',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }

    if (suspect.id === 'elena-rostova') {
      return {
        reply: `I don't know what you expect me to make of ${presentedClue.title}. If you think I had anything to do with harming Julian, you're chasing the wrong shadow.`,
        emotionalState: 'guarded',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }

    if (suspect.id === 'marcus-chen') {
      return {
        reply: `Look at ${presentedClue.title}—I can't speak to what went down after 22:45, okay? I wasn't up in that study when the vault opened.`,
        emotionalState: 'defensive',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }

    return {
      reply: `Regarding ${presentedClue.title}, I only handled compliance files earlier that evening. Let me know if you need the executive access permissions—I memorized the security matrix.`,
      emotionalState: 'cooperative',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }

  // General natural-language topic matching without presented evidence
  const q = req.question.toLowerCase();

  if (suspect.id === 'aris-thorne') {
    if (q.includes('alibi') || q.includes('where') || q.includes('23:') || q.includes('midnight')) {
      return {
        reply:
          'I left dinner on 42F at 22:45 and went straight down to my 38th-floor optics lab. I stayed at the laser bench alone until your officers knocked at 01:00. I never set foot in B1 Security or the garage.',
        emotionalState: 'composed',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    if (q.includes('vault') || q.includes('helios') || q.includes('prototype')) {
      return {
        reply:
          'Helios-9 was our life’s work, locked inside Julian’s biometric wall vault. Only Julian’s thumbprint opens it—which is why I suspect he either opened it himself or someone coerced him.',
        emotionalState: 'composed',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    if (q.includes('finance') || q.includes('money') || q.includes('audit') || q.includes('argue')) {
      return {
        reply:
          'Julian and I disagreed over R&D budgets occasionally—every co-founder does. Nothing remotely worth disappearing over.',
        emotionalState: 'guarded',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    return {
      reply:
        'Unless you have concrete evidence that contradicts my presence on the 38th floor, Detective, speculation will not bring Julian back.',
      emotionalState: 'composed',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }

  if (suspect.id === 'elena-rostova') {
    if (q.includes('alibi') || q.includes('where') || q.includes('42') || q.includes('return')) {
      return {
        reply:
          'After dinner broke up at 22:45, I went down to my 40th-floor guest suite around 23:00. Yes, Julian and I ended our engagement, and yes, dinner was frostier than the storm—but I stayed in my suite.',
        emotionalState: 'guarded',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    if (q.includes('dinner') || q.includes('strange') || q.includes('aris') || q.includes('marcus')) {
      return {
        reply:
          'Marcus was sweating bullets and left right at 22:45 after pouring Julian a scotch. Aris was unusually quiet—I even caught him coming out of the hallway by my 42F guest bath around 22:15.',
        emotionalState: 'guarded',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    if (q.includes('pill') || q.includes('sleep') || q.includes('zolpidem')) {
      return {
        reply:
          'I have a prescription for Zolpidem for travel insomnia—I keep a spare blister pack in the 42F guest bathroom cabinet. Why are you asking about my medication?',
        emotionalState: 'defensive',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    return {
      reply:
        'Julian was obsessed with an R&D audit all evening. If you actually have something from the study or security logs, put it on the table.',
      emotionalState: 'guarded',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }

  if (suspect.id === 'marcus-chen') {
    if (q.includes('ink') || q.includes('scotch') || q.includes('glass')) {
      return {
        reply:
          'My cobalt drafting ink? I mark schematic revisions with that pen all day! I poured Julian a scotch at 22:30 during dinner—if someone spiked that glass, it happened after I left.',
        emotionalState: 'defensive',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    if (q.includes('alibi') || q.includes('lobby') || q.includes('where') || q.includes('22:45')) {
      return {
        reply:
          'I took the main elevator down at 22:45 because Julian and I had words about my vesting schedule. I just waited out the storm downstairs in the lobby lounge until things cooled off.',
        emotionalState: 'defensive',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    if (q.includes('vault') || q.includes('biometric') || q.includes('silicone')) {
      return {
        reply:
          'I engineered that wall safe’s sensor spec. It checks capacitive ridges AND skin warmth—anything under 31°C should flag a thermal warning unless someone warms a platinum-cure silicone cast. Only Aris keeps that compound in his 38F optics lab.',
        emotionalState: 'cooperative',
        mode: 'scripted_fallback',
        fallbackReason,
        contradictionReacted: false,
      };
    }
    return {
      reply:
        'Look, Julian froze my stock, which made me furious—not a kidnapper. Ask me about the hardware or show me what you pulled from the vault.',
      emotionalState: 'defensive',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }

  // Priya Nair
  if (q.includes('audit') || q.includes('finance') || q.includes('23:45') || q.includes('meeting')) {
    return {
      reply:
        'Before dinner, Julian asked me to pull Q3 R&D wire confirmations. Something on that ledger rattled him deeply—he said he was confronting someone in his study at 23:45 before the Helios-9 handoff.',
      emotionalState: 'cooperative',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }
  if (q.includes('adm') || q.includes('camera') || q.includes('cctv') || q.includes('security')) {
    return {
      reply:
        'The tower’s Executive Override key ADM-04 is strictly limited to Security Chief Victor and the two co-founders—Julian Vance and Dr. Aris Thorne. Nobody else has that credential.',
      emotionalState: 'cooperative',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }
  if (q.includes('00:08') || q.includes('where') || q.includes('alibi')) {
    return {
      reply:
        'I was reviewing compliance notes in my 40th-floor guest suite after dinner... look, if you check the elevator ledger, you’ll see I ran back up briefly. Show me the log if you want the exact minute.',
      emotionalState: 'guarded',
      mode: 'scripted_fallback',
      fallbackReason,
      contradictionReacted: false,
    };
  }

  return {
    reply:
      'I’ll answer anything I know, Detective. Ask about the audit Julian was running, the security permissions, or show me any document you found.',
    emotionalState: 'cooperative',
    mode: 'scripted_fallback',
    fallbackReason,
    contradictionReacted: false,
  };
}
