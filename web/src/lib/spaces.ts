import type { Space } from './types'

// The spaces we track. `match` finds the building in OpenStreetMap by name.
// `approx` is a rough [lng, lat] used only if OpenStreetMap has no outline for it.
export interface SpaceDef extends Space {
  match: RegExp
  approx: [number, number]
}

// Approximate centre of Trent's Symons Campus (Peterborough)
export const CAMPUS_CENTER: [number, number] = [-78.2905, 44.3575]

export const SPACES: SpaceDef[] = [
  { id: 'bata', name: 'Bata Library',       bank: 'west', type: 'study',   match: /bata/i,                     approx: [-78.2915, 44.3575] },
  { id: 'sc',   name: 'Student Centre',     bank: 'west', type: 'social',  match: /student cent/i,             approx: [-78.2930, 44.3590] },
  { id: 'ath',  name: 'Athletics Centre',   bank: 'west', type: 'gym',     match: /athletic/i,                 approx: [-78.2945, 44.3610] },
  { id: 'cc',   name: 'Champlain College',  bank: 'west', type: 'college', match: /champlain/i,                approx: [-78.2918, 44.3560] },
  { id: 'lec',  name: 'Lady Eaton College', bank: 'west', type: 'college', match: /lady eaton/i,               approx: [-78.2960, 44.3535] },
  { id: 'sci',  name: 'Science Complex',    bank: 'east', type: 'lecture', match: /science complex|chemical sci|environmental sci/i, approx: [-78.2880, 44.3578] },
  { id: 'dna',  name: 'DNA Building',       bank: 'east', type: 'lecture', match: /life (and|&) health|\bdna\b/i, approx: [-78.2875, 44.3600] },
  { id: 'gz',   name: 'Gzowski College',    bank: 'east', type: 'lecture', match: /gzowski/i,                  approx: [-78.2872, 44.3555] },
  { id: 'oc',   name: 'Otonabee College',   bank: 'east', type: 'college', match: /otonabee college/i,         approx: [-78.2840, 44.3605] },
]

export const SPACE_BY_ID: Record<string, SpaceDef> = Object.fromEntries(SPACES.map((s) => [s.id, s]))
