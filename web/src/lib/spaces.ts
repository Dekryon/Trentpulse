import type { Space } from './types'

// The spaces we track. `match` finds the building in OpenStreetMap by name.
// `approx` is the [lng, lat] centre of the OpenStreetMap outline, used only if the outline is missing.
export interface SpaceDef extends Space {
  match: RegExp
  approx: [number, number]
}

// Approximate centre of Trent's Symons Campus (Peterborough)
export const CAMPUS_CENTER: [number, number] = [-78.2905, 44.3575]

export const SPACES: SpaceDef[] = [
  { id: 'bata', name: 'Bata Library',       bank: 'west', type: 'study',   match: /bata/i,                     approx: [-78.29043, 44.35723] },
  { id: 'sc',   name: 'Student Centre',     bank: 'west', type: 'social',  match: /student cent/i,             approx: [-78.29110, 44.35670] },
  { id: 'ath',  name: 'Athletics Centre',   bank: 'west', type: 'gym',     match: /athletic/i,                 approx: [-78.29250, 44.35546] },
  { id: 'cc',   name: 'Champlain College',  bank: 'west', type: 'college', match: /champlain/i,                approx: [-78.29070, 44.35896] },
  { id: 'lec',  name: 'Lady Eaton College', bank: 'west', type: 'college', match: /lady eaton/i,               approx: [-78.29221, 44.35821] },
  { id: 'sci',  name: 'Science Complex',    bank: 'east', type: 'lecture', match: /science complex|chemical sci|environmental sci/i, approx: [-78.28831, 44.35871] },
  { id: 'dna',  name: 'DNA Building',       bank: 'east', type: 'lecture', match: /life (and|&) health|\bdna\b/i, approx: [-78.28495, 44.35903] },
  { id: 'gz',   name: 'Gzowski College',    bank: 'east', type: 'lecture', match: /gzowski/i,                  approx: [-78.28752, 44.35745] },
  { id: 'oc',   name: 'Otonabee College',   bank: 'east', type: 'college', match: /otonabee college/i,         approx: [-78.28629, 44.35798] },
]

export const SPACE_BY_ID: Record<string, SpaceDef> = Object.fromEntries(SPACES.map((s) => [s.id, s]))
