export interface CrowdFundMemo {
  email: string,
  name: string
  description: string
  image: string
  target: string
  beneficiary: string
  tokenMint: string
  tokenDecimals: number
}

export enum CrowdFundStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum SupportedToken {
  SEND = 'SEND',
  USDC = 'USDC',
  SOL = 'SOL',
}

export type Query = {
  [key: string]: undefined | string | string[] | number | number[]
}
