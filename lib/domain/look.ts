/**
 * Choosing an icon and a colour from whatever the user types.
 *
 * Pure and UI-free: this picks a *semantic* icon key and a palette token name,
 * both of which get stored on the category. The mapping from those keys to
 * actual Tabler components and CSS lives in lib/ui.
 *
 * The same keyword table serves two jobs — dressing a budget line, and guessing
 * which category a merchant belongs to when logging a transaction.
 */

export const ICON_KEYS = [
  'home', 'tools', 'bolt', 'flame', 'droplet', 'wifi', 'phone', 'spray', 'laundry',
  'basket', 'plant', 'meat', 'kitchen', 'coffee', 'pizza', 'glass', 'cake',
  'bus', 'car', 'train', 'plane', 'bike', 'fuel', 'parking',
  'health', 'pill', 'gym', 'salon',
  'movie', 'tv', 'music', 'game', 'books', 'ticket',
  'card', 'cash', 'bank', 'shield', 'chart', 'piggy', 'wallet', 'briefcase',
  'gift', 'receipt', 'school', 'family', 'pet', 'bag', 'laptop', 'heart',
  'store', 'coins', 'umbrella', 'certificate', 'tag',
] as const
export type IconKey = (typeof ICON_KEYS)[number]

export const CATEGORY_COLORS = [
  'lime', 'yellow', 'purple', 'sky', 'teal', 'blue', 'pink', 'orange', 'red', 'slate',
] as const
export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export interface Look {
  icon: IconKey
  color: CategoryColor
}

interface Entry {
  words: string[]
  icon: IconKey
  color: CategoryColor
}

/**
 * Order does not matter — the longest matching keyword wins, so "credit card"
 * beats "card" and "house help" beats "house".
 */
const TABLE: Entry[] = [
  { words: ['rent', 'lease', 'landlord'], icon: 'home', color: 'blue' },
  { words: ['maintenance', 'society', 'repair'], icon: 'tools', color: 'slate' },
  { words: ['electricity', 'power', 'bijli', 'electric'], icon: 'bolt', color: 'yellow' },
  { words: ['gas', 'cylinder', 'lpg'], icon: 'flame', color: 'orange' },
  { words: ['water'], icon: 'droplet', color: 'sky' },
  { words: ['wifi', 'internet', 'broadband', 'fiber'], icon: 'wifi', color: 'sky' },
  { words: ['phone', 'mobile', 'recharge', 'airtel', 'jio', 'vodafone'], icon: 'phone', color: 'sky' },
  { words: ['house help', 'maid', 'cook', 'cleaning', 'domestic'], icon: 'spray', color: 'teal' },
  { words: ['laundry', 'dhobi', 'dry clean'], icon: 'laundry', color: 'sky' },

  { words: ['grocery', 'groceries', 'bigbasket', 'blinkit', 'zepto', 'dmart', 'supermarket', 'kirana'], icon: 'basket', color: 'yellow' },
  { words: ['vegetable', 'fruit', 'sabzi'], icon: 'plant', color: 'lime' },
  { words: ['meat', 'chicken', 'egg', 'protein', 'fish'], icon: 'meat', color: 'red' },
  { words: ['dining', 'restaurant', 'going out', 'swiggy', 'zomato', 'eating out', 'takeaway'], icon: 'kitchen', color: 'purple' },
  { words: ['coffee', 'cafe', 'starbucks', 'chai', 'tea'], icon: 'coffee', color: 'orange' },
  { words: ['pizza', 'mcdonald', 'burger', 'kfc', 'domino'], icon: 'pizza', color: 'red' },
  { words: ['alcohol', 'bar', 'drinks', 'beer', 'wine'], icon: 'glass', color: 'pink' },
  { words: ['cake', 'dessert', 'bakery', 'sweet', 'ice cream'], icon: 'cake', color: 'pink' },

  { words: ['commute', 'transport', 'travel'], icon: 'bus', color: 'sky' },
  { words: ['car', 'uber', 'ola', 'cab', 'taxi', 'rapido'], icon: 'car', color: 'sky' },
  { words: ['metro', 'train', 'rail', 'irctc'], icon: 'train', color: 'blue' },
  { words: ['flight', 'plane', 'airline', 'indigo', 'vistara'], icon: 'plane', color: 'purple' },
  { words: ['bike', 'cycle', 'scooter'], icon: 'bike', color: 'teal' },
  { words: ['petrol', 'fuel', 'diesel', 'cng'], icon: 'fuel', color: 'orange' },
  { words: ['parking', 'toll'], icon: 'parking', color: 'slate' },

  { words: ['doctor', 'medical', 'hospital', 'clinic', 'health'], icon: 'health', color: 'red' },
  { words: ['medicine', 'pharmacy', 'pharmeasy', 'apollo', 'chemist'], icon: 'pill', color: 'red' },
  { words: ['gym', 'fitness', 'cult', 'workout', 'yoga'], icon: 'gym', color: 'lime' },
  { words: ['salon', 'haircut', 'grooming', 'personal care', 'beauty', 'spa'], icon: 'salon', color: 'pink' },

  { words: ['movie', 'cinema', 'bookmyshow', 'pvr', 'inox'], icon: 'movie', color: 'purple' },
  { words: ['netflix', 'prime', 'hotstar', 'spotify', 'subscription', 'subscriptions', 'ott'], icon: 'tv', color: 'purple' },
  { words: ['music', 'concert'], icon: 'music', color: 'purple' },
  { words: ['game', 'gaming', 'playstation', 'steam', 'xbox'], icon: 'game', color: 'purple' },
  { words: ['book', 'books', 'kindle', 'audible'], icon: 'books', color: 'orange' },
  { words: ['ticket', 'event'], icon: 'ticket', color: 'pink' },

  { words: ['credit card', 'card', 'cred'], icon: 'card', color: 'teal' },
  { words: ['cash', 'atm', 'withdrawal'], icon: 'cash', color: 'lime' },
  { words: ['loan', 'emi', 'mortgage'], icon: 'bank', color: 'red' },
  { words: ['insurance', 'policy', 'lic', 'premium', 'term plan'], icon: 'shield', color: 'blue' },
  { words: ['elss', 'mutual fund', 'sip', 'nps', 'ppf', 'investment', 'stocks', 'equity', 'invest'], icon: 'chart', color: 'lime' },
  { words: ['savings', 'deposit', 'fixed deposit'], icon: 'piggy', color: 'lime' },
  { words: ['salary', 'income', 'pay', 'wage'], icon: 'wallet', color: 'lime' },
  { words: ['freelance', 'business', 'consulting', 'client'], icon: 'briefcase', color: 'lime' },
  { words: ['bonus', 'gift', 'cashback', 'refund'], icon: 'gift', color: 'pink' },
  { words: ['tax', 'gst', 'tds'], icon: 'receipt', color: 'slate' },

  { words: ['school', 'college', 'tuition', 'education', 'course', 'fees'], icon: 'school', color: 'blue' },
  { words: ['pocket money', 'mom', 'dad', 'family', 'parents'], icon: 'family', color: 'pink' },
  { words: ['pet', 'dog', 'cat'], icon: 'pet', color: 'orange' },
  { words: ['shopping', 'amazon', 'flipkart', 'myntra', 'clothes', 'apparel', 'zara', 'walmart'], icon: 'bag', color: 'teal' },
  { words: ['electronics', 'laptop', 'gadget', 'apple'], icon: 'laptop', color: 'slate' },
  { words: ['furniture', 'decor', 'ikea'], icon: 'store', color: 'orange' },
  { words: ['donation', 'charity', 'temple'], icon: 'heart', color: 'pink' },
  { words: ['other', 'others', 'misc', 'miscellaneous'], icon: 'tag', color: 'slate' },
]

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The best keyword hit for a name, or null. Longest keyword wins. */
export function matchKeyword(name: string): Look | null {
  const haystack = normalise(name)
  if (!haystack) return null

  let best: { entry: Entry; length: number } | null = null
  for (const entry of TABLE) {
    for (const word of entry.words) {
      if (!haystack.includes(word)) continue
      if (!best || word.length > best.length) best = { entry, length: word.length }
    }
  }
  return best ? { icon: best.entry.icon, color: best.entry.color } : null
}

/** Stable colour for anything the table does not know — same name, same colour. */
function hashColor(name: string): CategoryColor {
  let hash = 0
  for (const char of normalise(name)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length]
}

/**
 * Never fails. An unrecognised name still gets a deliberate-looking icon and a
 * colour that stays the same every time it is asked for.
 */
export function inferLook(name: string): Look {
  return matchKeyword(name) ?? { icon: 'tag', color: hashColor(name) }
}

export function isIconKey(value: string): value is IconKey {
  return (ICON_KEYS as readonly string[]).includes(value)
}

export function isCategoryColor(value: string): value is CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(value)
}

/**
 * Icons that mean roughly the same kind of spending. A merchant that reads as a
 * cab should still find a "Commute" category wearing a bus, rather than giving
 * up because the glyphs differ.
 *
 * Each family is ordered most-representative first, so a cab prefers a general
 * "Commute" line over a narrow "Car parking" one.
 */
export const ICON_FAMILIES: IconKey[][] = [
  ['bus', 'car', 'train', 'plane', 'bike', 'fuel', 'parking'],
  ['basket', 'meat', 'plant', 'kitchen', 'coffee', 'pizza', 'glass', 'cake'],
  ['home', 'tools', 'bolt', 'flame', 'droplet', 'spray', 'laundry'],
  ['health', 'pill', 'gym', 'salon'],
  ['movie', 'tv', 'music', 'game', 'books', 'ticket'],
  ['card', 'cash', 'bank', 'shield', 'chart', 'piggy', 'wallet', 'briefcase', 'coins', 'receipt'],
  ['wifi', 'phone', 'laptop'],
  ['bag', 'store', 'gift', 'tag'],
  ['school', 'certificate'],
  ['family', 'heart', 'pet'],
]

/** The icons that count as the same kind of thing, most representative first. */
export function relatedIcons(icon: IconKey): IconKey[] {
  return ICON_FAMILIES.find((f) => f.includes(icon)) ?? [icon]
}
