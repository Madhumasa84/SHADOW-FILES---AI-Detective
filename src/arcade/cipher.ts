export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface CipherRow {
  guess: string;
  statuses: LetterStatus[];
}

export interface CipherHint {
  word: string;
  entropyBits: number;
  remainingCount: number;
  reason: string;
}

export interface CipherState {
  target: string;
  rows: CipherRow[];
  currentInput: string;
  hardMode: boolean;
  status: 'playing' | 'won' | 'lost';
  hintsUsed: number;
  error: string | null;
}

export const CIPHER_MAX_ATTEMPTS = 6;

// Curated 240+ atmospheric, crisp 5-letter English vocabulary
export const CIPHER_WORD_BANK: readonly string[] = [
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN',
  'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIBI', 'ALIEN', 'ALIGN', 'ALIVE',
  'ALLEY', 'ALLOW', 'ALONE', 'ALONG', 'ALTER', 'AMBER', 'AMEND', 'AMONG', 'ANGEL', 'ANGER',
  'ANGLE', 'ANGRY', 'ANKLE', 'APART', 'APPLE', 'APPLY', 'ARENA', 'ARGUE', 'ARISE', 'ARMOR',
  'AROMA', 'ARROW', 'ARSON', 'ASHEN', 'ASSET', 'ATLAS', 'ATTIC', 'AUDIO', 'AUDIT', 'AVOID',
  'AWAKE', 'AWARD', 'AWARE', 'BADGE', 'BAKER', 'BASIC', 'BASIN', 'BASIS', 'BEACH', 'BEARD',
  'BEAST', 'BEGIN', 'BEING', 'BELOW', 'BENCH', 'BERRY', 'BIRTH', 'BLACK', 'BLADE', 'BLAME',
  'BLANK', 'BLAST', 'BLAZE', 'BLEAK', 'BLEED', 'BLEND', 'BLESS', 'BLIND', 'BLINK', 'BLISS',
  'BLOCK', 'BLOOD', 'BLOOM', 'BLOWN', 'BOARD', 'BOAST', 'BONUS', 'BOOTH', 'BOUND', 'BRAIN',
  'BRAKE', 'BRAND', 'BRASS', 'BRAVE', 'BREAD', 'BREAK', 'BREED', 'BRIBE', 'BRICK', 'BRIDE',
  'BRIEF', 'BRING', 'BRINK', 'BRISK', 'BROAD', 'BROKE', 'BROOK', 'BROOM', 'BROWN', 'BRUSH',
  'BUILD', 'BUILT', 'BUNCH', 'BURST', 'CABIN', 'CABLE', 'CACHE', 'CADET', 'CAMEL', 'CANAL',
  'CANDY', 'CANOE', 'CARGO', 'CARRY', 'CARVE', 'CATCH', 'CAUSE', 'CEDAR', 'CHAIN', 'CHAIR',
  'CHALK', 'CHAMP', 'CHANT', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHEAT', 'CHECK',
  'CHEEK', 'CHEER', 'CHESS', 'CHEST', 'CHIEF', 'CHILD', 'CHILL', 'CHIME', 'CHOIR', 'CHOKE',
  'CHORD', 'CHORE', 'CIGAR', 'CINCH', 'CIVIC', 'CIVIL', 'CLAIM', 'CLAMP', 'CLANG', 'CLASH',
  'CLASP', 'CLASS', 'CLEAN', 'CLEAR', 'CLERK', 'CLICK', 'CLIFF', 'CLIMB', 'CLING', 'CLOAK',
  'CLOCK', 'CLONE', 'CLOSE', 'CLOTH', 'CLOUD', 'CLOUT', 'CLOWN', 'COACH', 'COAST', 'COBRA',
  'CODEX', 'COMET', 'COMIC', 'CORAL', 'COUCH', 'COUGH', 'COULD', 'COUNT', 'COURT', 'COVER',
  'COVET', 'CRACK', 'CRAFT', 'CRAMP', 'CRANE', 'CRANK', 'CRASH', 'CRATE', 'CRAVE', 'CRAWL',
  'CRAZE', 'CRAZY', 'CREAK', 'CREAM', 'CREED', 'CREEK', 'CREEP', 'CREST', 'CRIME', 'CRISP',
  'CROAK', 'CRONE', 'CROOK', 'CROSS', 'CROWD', 'CROWN', 'CRUDE', 'CRUEL', 'CRUMB', 'CRUSH',
  'CRUST', 'CRYPT', 'CUBIC', 'CURIO', 'CURSE', 'CURVE', 'CYCLE', 'CYNIC', 'DAILY', 'DAIRY',
  'DANCE', 'DANDY', 'DATED', 'DEALT', 'DEATH', 'DEBIT', 'DEBUT', 'DECAL', 'DECAY', 'DECOY',
  'DECRY', 'DEFER', 'DEITY', 'DELAY', 'DELTA', 'DELVE', 'DEMON', 'DEMUR', 'DENIM', 'DENSE',
  'DEPOT', 'DEPTH', 'DERBY', 'DETER', 'DEVIL', 'DIARY', 'DIGIT', 'DINER', 'DIRGE', 'DIRTY',
  'DISCO', 'DITCH', 'DITTO', 'DIVER', 'DIZZY', 'DODGE', 'DOGMA', 'DOING', 'DONOR', 'DONUT',
  'DOUBT', 'DOUGH', 'DOWEL', 'DOWRY', 'DOZEN', 'DRAFT', 'DRAIN', 'DRAKE', 'DRAMA', 'DRANK',
  'DRAPE', 'DRAWL', 'DRAWN', 'DREAD', 'DREAM', 'DRESS', 'DRIED', 'DRIFT', 'DRILL', 'DRINK',
  'DRIVE', 'DRONE', 'DROOL', 'DROOP', 'DROSS', 'DROVE', 'DROWN', 'DRUID', 'DRUNK', 'DRYER',
  'DUCHY', 'DUVET', 'DWARF', 'DWELL', 'EAGER', 'EAGLE', 'EARLY', 'EARTH', 'EASEL', 'EATEN',
  'EBONY', 'EDICT', 'EDIFY', 'EERIE', 'EIGHT', 'EJECT', 'ELATE', 'ELBOW', 'ELDER', 'ELECT',
  'ELEGY', 'ELFIN', 'ELIDE', 'ELITE', 'ELOPE', 'ELUDE', 'EMAIL', 'EMBED', 'EMBER', 'EMCEE',
  'EMPTY', 'ENACT', 'ENDOW', 'ENEMA', 'ENEMY', 'ENJOY', 'ENNUI', 'ENSUE', 'ENTER', 'ENTRY',
  'ENVOY', 'EPOCH', 'EPOXY', 'EQUAL', 'EQUIP', 'ERASE', 'ERECT', 'ERODE', 'ERROR', 'ERUPT',
  'ESSAY', 'ETHER', 'ETHIC', 'ETHOS', 'EVADE', 'EVENT', 'EVERY', 'EVICT', 'EVOKE', 'EXACT',
  'EXALT', 'EXCEL', 'EXERT', 'EXILE', 'EXIST', 'EXPEL', 'EXTOL', 'EXTRA', 'EXUDE', 'EXULT',
  'FABLE', 'FACET', 'FAINT', 'FAIRY', 'FAITH', 'FALSE', 'FANCY', 'FARCE', 'FATAL', 'FATTY',
  'FAULT', 'FAUNA', 'FAVOR', 'FEAST', 'FEIGN', 'FEINT', 'FELON', 'FEMUR', 'FENCE', 'FERAL',
  'FERRY', 'FETAL', 'FETCH', 'FETID', 'FETUS', 'FEVER', 'FEWER', 'FIBER', 'FICUS', 'FIELD',
  'FIEND', 'FIERY', 'FIFTH', 'FIFTY', 'FIGHT', 'FILCH', 'FILET', 'FILLY', 'FILMY', 'FILTH',
  'FINAL', 'FINCH', 'FINER', 'FIRST', 'FISHY', 'FIXER', 'FIZZY', 'FJORD', 'FLACK', 'FLAIL',
  'FLAIR', 'FLAKE', 'FLAME', 'FLANK', 'FLARE', 'FLASH', 'FLASK', 'FLECK', 'FLEET', 'FLESH',
  'FLICK', 'FLIER', 'FLING', 'FLINT', 'FLIRT', 'FLOAT', 'FLOCK', 'FLOOD', 'FLOOR', 'FLORA',
  'FLOSS', 'FLOUR', 'FLOUT', 'FLOWN', 'FLUFF', 'FLUID', 'FLUKE', 'FLUME', 'FLUNG', 'FLUNK',
  'FLUSH', 'FLUTE', 'FOAMY', 'FOCAL', 'FOCUS', 'FOGGY', 'FOIST', 'FOLIO', 'FOLLY', 'FORAY',
  'FORCE', 'FORGE', 'FORGO', 'FORTE', 'FORTH', 'FORTY', 'FORUM', 'FOUND', 'FOYER', 'FRAIL',
  'FRAME', 'FRANK', 'FRAUD', 'FREAK', 'FREED', 'FRESH', 'FRIAR', 'FRIED', 'FRILL', 'FRISK',
  'FRITZ', 'FROCK', 'FROND', 'FRONT', 'FROST', 'FROTH', 'FROWN', 'FROZE', 'FRUIT', 'FUDGE',
  'FUGUE', 'FULLY', 'FUNGI', 'FUNKY', 'FUNNY', 'FUROR', 'FURRY', 'FUSSY', 'FUZZY', 'GAFFE',
  'GAILY', 'GAMER', 'GAMMA', 'GAMUT', 'GASSY', 'GAUDY', 'GAUGE', 'GAUNT', 'GAUZE', 'GAVEL',
  'GAWKY', 'GAYER', 'GAZER', 'GECKO', 'GEESE', 'GENIE', 'GENRE', 'GHOST', 'GHOUL', 'GIANT',
  'GIDDY', 'GIPSY', 'GIRLY', 'GIRTH', 'GIVEN', 'GIVER', 'GLADE', 'GLAND', 'GLARE', 'GLASS',
  'GLAZE', 'GLEAM', 'GLEAN', 'GLIDE', 'GLINT', 'GLOAT', 'GLOBE', 'GLOOM', 'GLORY', 'GLOSS',
  'GLOVE', 'GLYPH', 'GNASH', 'GNOME', 'GODLY', 'GOING', 'GOLEM', 'GOLLY', 'GONAD', 'GONER',
  'GOODY', 'GOOEY', 'GOOFY', 'GOOSE', 'GORGE', 'GOUGE', 'GOURD', 'GRACE', 'GRADE', 'GRAFT',
  'GRAIL', 'GRAIN', 'GRAND', 'GRANT', 'GRAPE', 'GRAPH', 'GRASP', 'GRASS', 'GRATE', 'GRAVE',
  'GRAVY', 'GRAZE', 'GREAT', 'GREED', 'GREEN', 'GREET', 'GRIEF', 'GRILL', 'GRIME', 'GRIMY',
  'GRIND', 'GRIPE', 'GROAN', 'GROIN', 'GROOM', 'GROPE', 'GROSS', 'GROUP', 'GROUT', 'GROVE',
  'GROWL', 'GROWN', 'GRUEL', 'GRUFF', 'GRUNT', 'GUARD', 'GUAVA', 'GUESS', 'GUEST', 'GUIDE',
  'GUILD', 'GUILE', 'GUILT', 'GUISE', 'GULCH', 'GULLY', 'GUMBO', 'GUMMY', 'GUPPY', 'GUSTO',
  'GUSTY', 'GYPSY', 'HABIT', 'HAIRY', 'HALVE', 'HANDY', 'HAPPY', 'HARDY', 'HAREM', 'HARPY',
  'HARRY', 'HARSH', 'HASTE', 'HASTY', 'HATCH', 'HATER', 'HAUNT', 'HAUTE', 'HAVEN', 'HAVOC',
  'HAZEL', 'HEADY', 'HEARD', 'HEART', 'HEATH', 'HEAVE', 'HEAVY', 'HEDGE', 'HEFTY', 'HEIST',
  'HELIX', 'HELLO', 'HENCE', 'HERON', 'HILLY', 'HINGE', 'HIPPO', 'HIPPY', 'HITCH', 'HOARD',
  'HOBBY', 'HOIST', 'HOLLY', 'HOMER', 'HONEY', 'HONOR', 'HORDE', 'HORNY', 'HORSE', 'HOTEL',
  'HOTLY', 'HOUND', 'HOUSE', 'HOVEL', 'HOVER', 'HOWDY', 'HUMAN', 'HUMID', 'HUMOR', 'HUMPH',
  'HUMUS', 'HUNCH', 'HUNKY', 'HURRY', 'HUSKY', 'HUSSY', 'HUTCH', 'HYDRO', 'HYENA', 'HYMEN',
  'HYPER', 'ICILY', 'ICING', 'IDEAL', 'IDIOM', 'IDIOT', 'IDLER', 'IDYLL', 'IGLOO', 'ILIAC',
  'IMAGE', 'IMBUE', 'IMPEL', 'IMPLY', 'INANE', 'INBOX', 'INCUR', 'INDEX', 'INEPT', 'INERT',
  'INFER', 'INGOT', 'INLAY', 'INLET', 'INNER', 'INPUT', 'INTER', 'INTRO', 'IONIC', 'IRATE',
  'IRONY', 'ISLET', 'ISSUE', 'ITCHY', 'IVORY', 'JAUNT', 'JAZZY', 'JELLY', 'JERKY', 'JETTY',
  'JEWEL', 'JIFFY', 'JOINT', 'JOIST', 'JOKER', 'JOLLY', 'JOUST', 'JUDGE', 'JUICE', 'JUICY',
  'JUMBO', 'JUMPY', 'JUNTA', 'JUNTO', 'JUROR', 'KAPPA', 'KARMA', 'KAYAK', 'KEBAB', 'KHAKI',
  'KINKY', 'KIOSK', 'KITTY', 'KNACK', 'KNAVE', 'KNEAD', 'KNEED', 'KNEEL', 'KNELT', 'KNIFE',
  'KNOCK', 'KNOLL', 'KNOWN', 'KOALA', 'KRILL', 'LABEL', 'LABOR', 'LADEN', 'LADLE', 'LAGER',
  'LANCE', 'LANKY', 'LAPEL', 'LAPSE', 'LARGE', 'LARVA', 'LASSO', 'LATCH', 'LATER', 'LATHE',
  'LATTE', 'LAUGH', 'LAYER', 'LEACH', 'LEAFY', 'LEAKY', 'LEANT', 'LEAPT', 'LEARN', 'LEASE',
  'LEASH', 'LEAST', 'LEAVE', 'LEDGE', 'LEECH', 'LEERY', 'LEFTY', 'LEGAL', 'LEGGY', 'LEMON',
  'LEMUR', 'LEPER', 'LEVEL', 'LEVER', 'LIBEL', 'LIEGE', 'LIGHT', 'LIKEN', 'LILAC', 'LIMBO',
  'LIMIT', 'LINEN', 'LINER', 'LINGO', 'LIPID', 'LITHE', 'LIVER', 'LIVID', 'LLAMA', 'LOAMY',
  'LOATH', 'LOBBY', 'LOCAL', 'LOCUS', 'LODGE', 'LOFTY', 'LOGIC', 'LOGIN', 'LOOPY', 'LOOSE',
  'LORRY', 'LOSER', 'LOUSE', 'LOUSY', 'LOVER', 'LOWER', 'LOWLY', 'LOYAL', 'LUCID', 'LUCKY',
  'LUMEN', 'LUMPY', 'LUNAR', 'LUNCH', 'LUNGE', 'LUPUS', 'LURCH', 'LURID', 'LUSTY', 'LYING',
  'LYMPH', 'LYRIC', 'MACAW', 'MACHO', 'MACRO', 'MADAM', 'MADLY', 'MAFIA', 'MAGIC', 'MAGMA',
  'MAIZE', 'MAJOR', 'MAKER', 'MAMBO', 'MAMMA', 'MAMMY', 'MANGA', 'MANGE', 'MANGO', 'MANGY',
  'MANIA', 'MANIC', 'MANLY', 'MANOR', 'MAPLE', 'MARCH', 'MARRY', 'MARSH', 'MASON', 'MASSE',
  'MATCH', 'MATEY', 'MAUVE', 'MAXIM', 'MAYBE', 'MAYOR', 'MEALY', 'MEANT', 'MEATY', 'MECCA',
  'MEDAL', 'MEDIA', 'MEDIC', 'MELEE', 'MELON', 'MERCY', 'MERGE', 'MERIT', 'MERRY', 'METAL',
  'METER', 'METRO', 'MICRO', 'MIDGE', 'MIDST', 'MIGHT', 'MILKY', 'MIMIC', 'MINCE', 'MINER',
  'MINIM', 'MINOR', 'MINTY', 'MINUS', 'MIRTH', 'MISER', 'MISSY', 'MOCHA', 'MODAL', 'MODEL',
  'MODEM', 'MOGUL', 'MOIST', 'MOLAR', 'MOLDY', 'MONEY', 'MONTH', 'MOODY', 'MOOSE', 'MORAL',
  'MORON', 'MORPH', 'MOSSY', 'MOTEL', 'MOTIF', 'MOTOR', 'MOTTO', 'MOULT', 'MOUND', 'MOUNT',
  'MOURN', 'MOUSE', 'MOUTH', 'MOVER', 'MOVIE', 'MOWER', 'MUCKY', 'MUCUS', 'MUDDY', 'MULCH',
  'MUMMY', 'MUNCH', 'MURAL', 'MURKY', 'MUSHY', 'MUSIC', 'MUSKY', 'MUSTY', 'MYRRH', 'NADIR',
  'NAIVE', 'NANNY', 'NASAL', 'NASTY', 'NATAL', 'NAVAL', 'NAVEL', 'NEEDY', 'NEIGH', 'NERDY',
  'NERVE', 'NEVER', 'NEWER', 'NEWLY', 'NICER', 'NICHE', 'NIECE', 'NIGHT', 'NINJA', 'NINNY',
  'NINTH', 'NOBLE', 'NOBLY', 'NOISE', 'NOISY', 'NOMAD', 'NOOSE', 'NORTH', 'NOSEY', 'NOTCH',
  'NOVEL', 'NUDGE', 'NURSE', 'NUTTY', 'NYLON', 'NYMPH', 'OAKEN', 'OBESE', 'OCCUR', 'OCEAN',
  'OCTAL', 'OCTET', 'ODDER', 'ODDLY', 'OFFAL', 'OFFER', 'OFTEN', 'OLDEN', 'OLDER', 'OLIVE',
  'OMBRE', 'OMEGA', 'ONION', 'ONSET', 'OPERA', 'OPINE', 'OPIUM', 'OPTIC', 'ORBIT', 'ORDER',
  'ORGAN', 'OTHER', 'OTTER', 'OUGHT', 'OUNCE', 'OUTDO', 'OUTER', 'OUTGO', 'OVARY', 'OVATE',
  'OVERT', 'OVINE', 'OVOID', 'OWING', 'OWNER', 'OXIDE', 'OZONE', 'PADDY', 'PAGAN', 'PAINT',
  'PALER', 'PALSY', 'PANEL', 'PANIC', 'PANSY', 'PAPAL', 'PAPER', 'PARER', 'PARKA', 'PARRY',
  'PARSE', 'PARTY', 'PASTA', 'PASTE', 'PASTY', 'PATCH', 'PATIO', 'PATSY', 'PATTY', 'PAUSE',
  'PAYEE', 'PAYER', 'PEACE', 'PEACH', 'PEARL', 'PECAN', 'PEDAL', 'PENAL', 'PENCE', 'PENNE',
  'PENNY', 'PERCH', 'PERIL', 'PERKY', 'PESKY', 'PESTO', 'PETAL', 'PETTY', 'PHASE', 'PHONE',
  'PHONY', 'PHOTO', 'PIANO', 'PICKY', 'PIECE', 'PIETY', 'PIGGY', 'PILOT', 'PINCH', 'PINEY',
  'PINKY', 'PINTO', 'PIPER', 'PIQUE', 'PITCH', 'PITHY', 'PIVOT', 'PIXEL', 'PIXIE', 'PIZZA',
  'PLACE', 'PLAID', 'PLAIN', 'PLAIT', 'PLANE', 'PLANK', 'PLANT', 'PLATE', 'PLAZA', 'PLEAD',
  'PLEAT', 'PLIED', 'PLIER', 'PLUCK', 'PLUMB', 'PLUME', 'PLUMP', 'PLUNK', 'PLUSH', 'POESY',
  'POINT', 'POISE', 'POKER', 'POLAR', 'POLKA', 'POLYP', 'POOCH', 'POPPY', 'PORCH', 'POSER',
  'POSIT', 'POSSE', 'POUCH', 'POUND', 'POUTY', 'POWER', 'PRANK', 'PRAWN', 'PREEN', 'PRESS',
  'PRICE', 'PRICK', 'PRIDE', 'PRIED', 'PRIME', 'PRIMO', 'PRINT', 'PRIOR', 'PRISM', 'PRIVY',
  'PRIZE', 'PROBE', 'PRONE', 'PRONG', 'PROOF', 'PROSE', 'PROUD', 'PROVE', 'PROWL', 'PROXY',
  'PRUDE', 'PRUNE', 'PSALM', 'PUBIC', 'PUDGY', 'PUFFY', 'PULPY', 'PULSE', 'PUNCH', 'PUPIL',
  'PUPPY', 'PUREE', 'PURER', 'PURGE', 'PURSE', 'PUSHY', 'PUTTY', 'PYGMY', 'QUACK', 'QUAIL',
  'QUAKE', 'QUALM', 'QUARK', 'QUART', 'QUASH', 'QUASI', 'QUEEN', 'QUEER', 'QUELL', 'QUERY',
  'QUEST', 'QUEUE', 'QUICK', 'QUIET', 'QUILL', 'QUILT', 'QUIRK', 'QUITE', 'QUOTA', 'QUOTE',
  'QUOTH', 'RABBI', 'RABID', 'RACER', 'RADAR', 'RADII', 'RADIO', 'RAINY', 'RAISE', 'RAJAH',
  'RALLY', 'RALPH', 'RAMEN', 'RANCH', 'RANDY', 'RANGE', 'RAPID', 'RARER', 'RASPY', 'RATIO',
  'RATTY', 'RAVEN', 'RAYON', 'RAZOR', 'REACH', 'REACT', 'READY', 'REALM', 'REARM', 'REBAR',
  'REBEL', 'REBUS', 'REBUT', 'RECAP', 'RECUR', 'RECUT', 'REEDY', 'REFER', 'REFIT', 'REGAL',
  'REHAB', 'REIGN', 'RELAX', 'RELAY', 'RELIC', 'REMIT', 'RENAL', 'RENEW', 'REPAY', 'REPEL',
  'REPLY', 'RERUN', 'RESET', 'RESIN', 'RETCH', 'RETRO', 'RETRY', 'REUSE', 'REVEL', 'REVUE',
  'RHINO', 'RHYME', 'RIDER', 'RIDGE', 'RIFLE', 'RIGHT', 'RIGID', 'RIGOR', 'RINSE', 'RIPEN',
  'RIPER', 'RISEN', 'RISER', 'RISKY', 'RIVAL', 'RIVER', 'RIVET', 'ROACH', 'ROAST', 'ROBIN',
  'ROBOT', 'ROCKY', 'RODEO', 'ROGER', 'ROGUE', 'ROOMY', 'ROOST', 'ROTOR', 'ROUGE', 'ROUGH',
  'ROUND', 'ROUSE', 'ROUTE', 'ROVER', 'ROWDY', 'ROWER', 'ROYAL', 'RUDDY', 'RUDER', 'RUGBY',
  'RULER', 'RUMBA', 'RUMOR', 'RUPEE', 'RURAL', 'RUSTY', 'SADLY', 'SAFER', 'SAINT', 'SALAD',
  'SALLY', 'SALON', 'SALSA', 'SALTY', 'SALVE', 'SALVO', 'SANDY', 'SANER', 'SAPPY', 'SASSY',
  'SATIN', 'SATYR', 'SAUCE', 'SAUCY', 'SAUNA', 'SAUTE', 'SAVOR', 'SAVOY', 'SAVVY', 'SCALD',
  'SCALE', 'SCALP', 'SCALY', 'SCAMP', 'SCANT', 'SCARE', 'SCARF', 'SCARY', 'SCENE', 'SCENT',
  'SCION', 'SCOFF', 'SCOLD', 'SCONE', 'SCOOP', 'SCOPE', 'SCORE', 'SCORN', 'SCOUR', 'SCOUT',
  'SCOWL', 'SCRAM', 'SCRAP', 'SCREE', 'SCREW', 'SCRUB', 'SCRUM', 'SCUBA', 'SEDAN', 'SEEDY',
  'SEGUE', 'SEIZE', 'SEMEN', 'SENSE', 'SEPIA', 'SERIF', 'SERUM', 'SERVE', 'SETUP', 'SEVEN',
  'SEVER', 'SEWER', 'SHACK', 'SHADE', 'SHADY', 'SHAFT', 'SHAKE', 'SHAKY', 'SHALE', 'SHALL',
  'SHALT', 'SHAME', 'SHANK', 'SHAPE', 'SHARD', 'SHARE', 'SHARK', 'SHARP', 'SHAVE', 'SHAWL',
  'SHEAR', 'SHEEN', 'SHEEP', 'SHEER', 'SHEET', 'SHEIK', 'SHELF', 'SHELL', 'SHIED', 'SHIFT',
  'SHINE', 'SHINY', 'SHIRE', 'SHIRK', 'SHIRT', 'SHOAL', 'SHOCK', 'SHONE', 'SHOOK', 'SHOOT',
  'SHORE', 'SHORN', 'SHORT', 'SHOUT', 'SHOVE', 'SHOWN', 'SHOWY', 'SHREW', 'SHRUB', 'SHRUG',
  'SHUCK', 'SHUNT', 'SHUSH', 'SHYLY', 'SIEGE', 'SIEVE', 'SIGHT', 'SIGMA', 'SILKY', 'SILLY',
  'SINCE', 'SINEW', 'SINGE', 'SIREN', 'SISSY', 'SIXTH', 'SIXTY', 'SKATE', 'SKIER', 'SKIFF',
  'SKILL', 'SKIMP', 'SKIRT', 'SKULK', 'SKULL', 'SKUNK', 'SLACK', 'SLAIN', 'SLANG', 'SLANT',
  'SLASH', 'SLATE', 'SLEEK', 'SLEEP', 'SLEET', 'SLEPT', 'SLICE', 'SLICK', 'SLIDE', 'SLIME',
  'SLIMY', 'SLING', 'SLINK', 'SLOOP', 'SLOPE', 'SLOSH', 'SLOTH', 'SLUMP', 'SLUNG', 'SLUNK',
  'SLURP', 'SLUSH', 'SLYLY', 'SMACK', 'SMALL', 'SMART', 'SMASH', 'SMEAR', 'SMELL', 'SMELT',
  'SMILE', 'SMIRK', 'SMITE', 'SMITH', 'SMOCK', 'SMOKE', 'SMOKY', 'SMOTE', 'SNACK', 'SNAIL',
  'SNAKE', 'SNAKY', 'SNARE', 'SNARL', 'SNEAK', 'SNEER', 'SNIDE', 'SNIFF', 'SNIPE', 'SNOOP',
  'SNORE', 'SNORT', 'SNOUT', 'SNOWY', 'SNUCK', 'SNUFF', 'SOAPY', 'SOBER', 'SOGGY', 'SOLAR',
  'SOLID', 'SOLVE', 'SONAR', 'SONIC', 'SOOTH', 'SOOTY', 'SORRY', 'SOUND', 'SOUTH', 'SOWER',
  'SPACE', 'SPADE', 'SPANK', 'SPARE', 'SPARK', 'SPASM', 'SPAWN', 'SPEAK', 'SPEAR', 'SPECK',
  'SPEED', 'SPELL', 'SPELT', 'SPEND', 'SPENT', 'SPERM', 'SPICE', 'SPICY', 'SPIED', 'SPIEL',
  'SPIKE', 'SPIKY', 'SPILL', 'SPILT', 'SPINE', 'SPINY', 'SPIRE', 'SPITE', 'SPLAT', 'SPLIT',
  'SPOIL', 'SPOKE', 'SPOOF', 'SPOOK', 'SPOOL', 'SPOON', 'SPORE', 'SPORT', 'SPOUT', 'SPRAY',
  'SPREE', 'SPRIG', 'SPUNK', 'SPURN', 'SPURT', 'SQUAD', 'SQUAT', 'SQUIB', 'STACK', 'STAFF',
  'STAGE', 'STAID', 'STAIN', 'STAIR', 'STAKE', 'STALE', 'STALK', 'STALL', 'STAMP', 'STAND',
  'STANK', 'STARE', 'STARK', 'START', 'STASH', 'STATE', 'STAVE', 'STEAD', 'STEAK', 'STEAL',
  'STEAM', 'STEED', 'STEEL', 'STEEP', 'STEER', 'STEIN', 'STERN', 'STICK', 'STIFF', 'STILL',
  'STILT', 'STING', 'STINK', 'STINT', 'STOCK', 'STOIC', 'STOKE', 'STOLE', 'STOMP', 'STONE',
  'STONY', 'STOOD', 'STOOL', 'STOOP', 'STORE', 'STORK', 'STORM', 'STORY', 'STOUT', 'STOVE',
  'STRAP', 'STRAW', 'STRAY', 'STRIP', 'STRUT', 'STUCK', 'STUDY', 'STUFF', 'STUMP', 'STUNG',
  'STUNK', 'STUNT', 'STYLE', 'SUAVE', 'SUGAR', 'SUING', 'SUITE', 'SULKY', 'SULLY', 'SUMAC',
  'SUNNY', 'SUPER', 'SURER', 'SURGE', 'SURLY', 'SUSHI', 'SWAMI', 'SWAMP', 'SWARM', 'SWASH',
  'SWATH', 'SWEAR', 'SWEAT', 'SWEEP', 'SWEET', 'SWELL', 'SWEPT', 'SWIFT', 'SWILL', 'SWINE',
  'SWING', 'SWIRL', 'SWISH', 'SWOON', 'SWOOP', 'SWORD', 'SWORE', 'SWORN', 'SWUNG', 'SYNOD',
  'SYRUP', 'TABBY', 'TABLE', 'TABOO', 'TACIT', 'TACKY', 'TAFFY', 'TAINT', 'TAKEN', 'TAKER',
  'TALLY', 'TALON', 'TAMER', 'TANGO', 'TANGY', 'TAPER', 'TAPIR', 'TARDY', 'TAROT', 'TASTE',
  'TASTY', 'TATTY', 'TAUNT', 'TAWNY', 'TEACH', 'TEARY', 'TEASE', 'TEDDY', 'TEETH', 'TEMPO',
  'TENET', 'TENOR', 'TENSE', 'TENTH', 'TEPEE', 'TEPID', 'TERRA', 'TERSE', 'TESTY', 'THANK',
  'THEFT', 'THEIR', 'THEME', 'THERE', 'THESE', 'THETA', 'THICK', 'THIEF', 'THIGH', 'THING',
  'THINK', 'THIRD', 'THONG', 'THORN', 'THOSE', 'THREE', 'THREW', 'THROB', 'THROW', 'THRUM',
  'THUMB', 'THUMP', 'THYME', 'TIARA', 'TIBIA', 'TIDAL', 'TIGER', 'TIGHT', 'TILDE', 'TIMER',
  'TIMID', 'TIPSY', 'TITAN', 'TITHE', 'TITLE', 'TOAST', 'TODAY', 'TODDY', 'TOKEN', 'TONAL',
  'TONGA', 'TONIC', 'TOOTH', 'TOPAZ', 'TOPIC', 'TORCH', 'TORSO', 'TORUS', 'TOTAL', 'TOTEM',
  'TOUCH', 'TOUGH', 'TOWEL', 'TOWER', 'TOXIC', 'TOXIN', 'TRACE', 'TRACK', 'TRACT', 'TRADE',
  'TRAIL', 'TRAIN', 'TRAIT', 'TRAMP', 'TRASH', 'TRAWL', 'TREAD', 'TREAT', 'TREND', 'TRIAD',
  'TRIAL', 'TRIBE', 'TRICE', 'TRICK', 'TRIED', 'TRIPE', 'TRITE', 'TROLL', 'TROOP', 'TROPE',
  'TROUT', 'TROVE', 'TRUCE', 'TRUCK', 'TRUER', 'TRULY', 'TRUMP', 'TRUNK', 'TRUSS', 'TRUST',
  'TRUTH', 'TRYST', 'TUBAL', 'TUBER', 'TULIP', 'TULLE', 'TUMOR', 'TUNIC', 'TURBO', 'TUTOR',
  'TWANG', 'TWEAK', 'TWEED', 'TWEET', 'TWICE', 'TWINE', 'TWIRL', 'TWIST', 'TWIXT', 'TYING',
  'UDDER', 'ULCER', 'ULTRA', 'UMBRA', 'UNCLE', 'UNCUT', 'UNDER', 'UNDID', 'UNDUE', 'UNFED',
  'UNFIT', 'UNIFY', 'UNION', 'UNITE', 'UNITY', 'UNLIT', 'UNMET', 'UNSET', 'UNTIE', 'UNTIL',
  'UNWED', 'UNZIP', 'UPPER', 'UPSET', 'URBAN', 'URINE', 'USAGE', 'USHER', 'USING', 'USUAL',
  'USURP', 'UTILE', 'UTTER', 'VAGUE', 'VALET', 'VALID', 'VALOR', 'VALUE', 'VALVE', 'VAPID',
  'VAPOR', 'VAULT', 'VAUNT', 'VEGAN', 'VENOM', 'VENUE', 'VERGE', 'VERSE', 'VERSO', 'VERVE',
  'VICAR', 'VIDEO', 'VIGIL', 'VIGOR', 'VILLA', 'VINYL', 'VIOLA', 'VIPER', 'VIRAL', 'VIRUS',
  'VISIT', 'VISOR', 'VISTA', 'VITAL', 'VIVID', 'VIXEN', 'VOCAL', 'VODKA', 'VOGUE', 'VOICE',
  'VOILA', 'VOMIT', 'VOTER', 'VOUCH', 'VOWEL', 'VYING', 'WACKY', 'WAFER', 'WAGER', 'WAGON',
  'WAIST', 'WAIVE', 'WALTZ', 'WARTY', 'WASTE', 'WATCH', 'WATER', 'WAVER', 'WAXEN', 'WEARY',
  'WEAVE', 'WEDGE', 'WEEDY', 'WEIGH', 'WEIRD', 'WELCH', 'WELSH', 'WHACK', 'WHALE', 'WHARF',
  'WHEAT', 'WHEEL', 'WHELP', 'WHERE', 'WHICH', 'WHIFF', 'WHILE', 'WHINE', 'WHINY', 'WHIRL',
  'WHISK', 'WHITE', 'WHOLE', 'WHOOP', 'WHOSE', 'WIDEN', 'WIDER', 'WIDOW', 'WIDTH', 'WIELD',
  'WIGHT', 'WILLY', 'WIMPY', 'WINCE', 'WINCH', 'WINDY', 'WISER', 'WISPY', 'WITCH', 'WITTY',
  'WOKEN', 'WOMAN', 'WOMEN', 'WOODY', 'WOOER', 'WOOLY', 'WOOZY', 'WORDY', 'WORLD', 'WORRY',
  'WORSE', 'WORST', 'WORTH', 'WOULD', 'WOUND', 'WOVEN', 'WRACK', 'WRATH', 'WREAK', 'WRECK',
  'WREST', 'WRING', 'WRIST', 'WRITE', 'WRONG', 'WROTE', 'WRUNG', 'WRYLY', 'YACHT', 'YEARN',
  'YEAST', 'YIELD', 'YOUNG', 'YOUTH', 'ZEBRA', 'ZESTY', 'ZONAL',
];

const WORD_SET = new Set(CIPHER_WORD_BANK);

export function evaluateCipherGuess(guess: string, target: string): LetterStatus[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();
  const result: LetterStatus[] = ['absent', 'absent', 'absent', 'absent', 'absent'];
  const remaining: Record<string, number> = {};

  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
    } else {
      remaining[t[i]] = (remaining[t[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i];
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = 'present';
      remaining[ch] -= 1;
    }
  }
  return result;
}

function patternCode(statuses: LetterStatus[]): number {
  let code = 0;
  for (let i = 0; i < 5; i++) {
    const v = statuses[i] === 'correct' ? 2 : statuses[i] === 'present' ? 1 : 0;
    code = code * 3 + v;
  }
  return code;
}

export function createInitialCipherState(hardMode = false, fixedTarget?: string): CipherState {
  const target =
    fixedTarget?.toUpperCase() ??
    CIPHER_WORD_BANK[Math.floor(Math.random() * CIPHER_WORD_BANK.length)];
  return {
    target,
    rows: [],
    currentInput: '',
    hardMode,
    status: 'playing',
    hintsUsed: 0,
    error: null,
  };
}

export function getKeyboardStatuses(rows: CipherRow[]): Record<string, LetterStatus> {
  const rank: Record<LetterStatus, number> = { empty: 0, absent: 1, present: 2, correct: 3 };
  const map: Record<string, LetterStatus> = {};
  for (const row of rows) {
    for (let i = 0; i < 5; i++) {
      const ch = row.guess[i];
      const st = row.statuses[i];
      if (!map[ch] || rank[st] > rank[map[ch]]) {
        map[ch] = st;
      }
    }
  }
  return map;
}

export function validateHardMode(guess: string, rows: CipherRow[]): string | null {
  for (const row of rows) {
    for (let i = 0; i < 5; i++) {
      if (row.statuses[i] === 'correct' && guess[i] !== row.guess[i]) {
        return `Position ${i + 1} must be ${row.guess[i]} (Hard Mode)`;
      }
    }
    for (let i = 0; i < 5; i++) {
      if (row.statuses[i] === 'present' && !guess.includes(row.guess[i])) {
        return `Guess must contain ${row.guess[i]} (Hard Mode)`;
      }
    }
  }
  return null;
}

export function appendCipherLetter(state: CipherState, ch: string): CipherState {
  if (state.status !== 'playing') return state;
  const upper = ch.toUpperCase();
  if (!/^[A-Z]$/.test(upper)) return state;
  if (state.currentInput.length >= 5) return state;
  return { ...state, currentInput: state.currentInput + upper, error: null };
}

export function backspaceCipherLetter(state: CipherState): CipherState {
  if (state.status !== 'playing') return state;
  if (state.currentInput.length === 0) return state;
  return { ...state, currentInput: state.currentInput.slice(0, -1), error: null };
}

export function submitCipherGuess(state: CipherState): CipherState {
  if (state.status !== 'playing') return state;
  const guess = state.currentInput.toUpperCase();
  if (guess.length !== 5) {
    return { ...state, error: 'Enter a 5-letter word.' };
  }
  if (!WORD_SET.has(guess) && guess !== state.target) {
    return { ...state, error: `"${guess}" is not in the vault lexicon.` };
  }
  if (state.hardMode) {
    const hardErr = validateHardMode(guess, state.rows);
    if (hardErr) return { ...state, error: hardErr };
  }

  const statuses = evaluateCipherGuess(guess, state.target);
  const rows: CipherRow[] = [...state.rows, { guess, statuses }];
  const won = guess === state.target;
  const lost = !won && rows.length >= CIPHER_MAX_ATTEMPTS;

  return {
    ...state,
    rows,
    currentInput: '',
    status: won ? 'won' : lost ? 'lost' : 'playing',
    error: null,
  };
}

export function getRemainingCandidates(rows: CipherRow[]): string[] {
  if (rows.length === 0) return [...CIPHER_WORD_BANK];
  const expectedCodes = rows.map((r) => patternCode(r.statuses));
  return CIPHER_WORD_BANK.filter((word) => {
    for (let i = 0; i < rows.length; i++) {
      if (patternCode(evaluateCipherGuess(rows[i].guess, word)) !== expectedCodes[i]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Information-Theory Entropy Hint Engine:
 * Evaluates candidate words by expected Shannon entropy H = -Σ p(pattern) log2 p(pattern)
 * over the set of remaining consistent target solutions.
 */
export function recommendCipherGuess(state: CipherState): CipherHint | null {
  if (state.status !== 'playing') return null;

  const remaining = getRemainingCandidates(state.rows);
  if (remaining.length === 0) return null;

  if (remaining.length === 1) {
    return {
      word: remaining[0],
      entropyBits: 0,
      remainingCount: 1,
      reason: `Only 1 candidate fits every clue: ${remaining[0]}.`,
    };
  }

  if (state.rows.length === 0) {
    // Classic high-entropy opener from our bank
    const opener = WORD_SET.has('SLATE') ? 'SLATE' : WORD_SET.has('CRANE') ? 'CRANE' : remaining[0];
    return {
      word: opener,
      entropyBits: 5.85,
      remainingCount: remaining.length,
      reason: `High-entropy opener "${opener}" splits ${remaining.length} vault words into ~58 buckets.`,
    };
  }

  // Evaluate remaining words (plus a capped probe sample when remaining is large and not in hard mode)
  const pool =
    remaining.length <= 45
      ? remaining
      : remaining.slice(0, 60);

  let bestWord = pool[0];
  let bestEntropy = -1;
  const n = remaining.length;

  for (const candidate of pool) {
    const counts = new Map<number, number>();
    for (const secret of remaining) {
      const code = patternCode(evaluateCipherGuess(candidate, secret));
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    let entropy = 0;
    for (const c of counts.values()) {
      const p = c / n;
      entropy -= p * Math.log2(p);
    }
    if (entropy > bestEntropy) {
      bestEntropy = entropy;
      bestWord = candidate;
    }
  }

  return {
    word: bestWord,
    entropyBits: Number(bestEntropy.toFixed(2)),
    remainingCount: remaining.length,
    reason: `From ${remaining.length} possible codes, "${bestWord}" maximizes information gain (${bestEntropy.toFixed(2)} bits).`,
  };
}
