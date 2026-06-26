export type AccountState = {
  telegram: { connected: boolean; username: string | null }
  email: { address: string | null; verified: boolean; pending: string | null }
  hasPassword: boolean
  lastLoginMethod: string | null
  mustChangePassword: boolean
  methods: string[]
}
