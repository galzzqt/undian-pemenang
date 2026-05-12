export type Participant = {
  id: string
  no: string
  name: string
  category: string
}

export type WinnerRecord = {
  participant: Participant
  at: number
}

export type DrawPhase =
  | 'idle'
  | 'shuffling'
  | 'countdown'
  | 'revealed'
