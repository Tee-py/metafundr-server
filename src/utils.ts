import { ActionGetResponse, MEMO_PROGRAM_ID } from '@solana/actions'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import { CrowdFundMemo, Query, SupportedToken } from './types'
import {
  SEND_ADDRESS,
  SEND_DECIMALS,
  WSOL_ADDRESS,
  WSOL_DECIMALS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  DEFAULT_IMAGE,
} from './constants'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

export const validateAccount = (account: string) => {
  try {
    return new PublicKey(account)
  } catch (err) {
    console.log(err)
    throw 'Invalid "account" provided'
  }
}

export const validateCreateCrowdFundTransactionSignature = async (
  connection: Connection,
  signature: string,
  data: string,
  account: PublicKey
) => {
  const transaction = await connection.getParsedTransaction(
    signature,
    'confirmed'
  )
  if (!transaction) throw 'Invalid signature provided'
  if (transaction.meta?.err) throw 'Transaction failed'
  const signer = transaction.transaction.message.accountKeys.filter(
    (ky) => ky.signer == true
  )
  if (!signer[0].pubkey.equals(account))
    throw 'Transaction signer does not match account'
  const memoIx = transaction?.transaction.message.instructions.filter(
    (ix) => ix.programId.toString() == MEMO_PROGRAM_ID
  )
  if (memoIx.length == 0) throw 'Invalid signature'
  // @ts-ignore
  if (memoIx[0].parsed != 'metafundr | create') throw 'invalid memo transaction'
  const memoData = JSON.parse(data)
  const validated = validateVerifyCrowdFundQueryParams(memoData) as CrowdFundMemo
  return {
    signature,
    memoData: validated
  }
}

export const validateDonateTransactionSignature = async (
  connection: Connection,
  signature: string,
  account: PublicKey
) => {
  const transaction = await connection.getParsedTransaction(
    signature,
    'confirmed'
  )
  if (!transaction) throw 'Invalid signature provided'
  if (transaction.meta?.err) throw 'Transaction failed'
  const signer = transaction.transaction.message.accountKeys.filter(
    (ky) => ky.signer == true
  )
  if (!signer[0].pubkey.equals(account))
    throw 'Transaction signer does not match account'
  const memoIx = transaction?.transaction.message.instructions.filter(
    (ix) => ix.programId.toString() == MEMO_PROGRAM_ID
  )
  const solTransferIx = transaction.transaction.message.instructions.filter(
    (ix) => ix.programId.equals(SystemProgram.programId)
  )
  const splTransferIx = transaction.transaction.message.instructions.filter(
    (ix) => ix.programId.equals(TOKEN_PROGRAM_ID)
  )
  if (memoIx.length == 0) throw 'Invalid signature'
  let details = {
    signature,
    amount: 0,
    from: PublicKey.default,
    to: PublicKey.default,
    // @ts-ignore
    memoData: JSON.parse(memoIx[0].parsed),
  }
  //@ts-ignore
  if (solTransferIx.length != 0) {
    const ix = solTransferIx[0]
    // @ts-ignore
    if (ix.parsed.type != 'transfer') throw 'Invalid transaction signature'
    // @ts-ignore
    details.amount = ix.parsed.info.lamports
    // @ts-ignore
    details.to = ix.parsed.info.destination
    // @ts-ignore
    details.from = ix.parsed.info.source
  } else if (splTransferIx.length != 0) {
    const ix = splTransferIx[0]
    // @ts-ignore
    details.amount = ix.parsed.info.amount
    // @ts-ignore
    details.from = ix.parsed.info.authority
    // @ts-ignore
    details.to = ix.parsed.info.destination
  } else {
    throw 'Transfer txn not found'
  }
  if (account.toString() != details.from.toString()) throw 'Invalid transaction'
  return details
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatedCreateCrowdFundQueryParams = (query: Query) => {
  let beneficiary
  let tokenMint
  let tokenDecimals
  if (query.beneficiary) {
    try {
      beneficiary = new PublicKey(query.beneficiary).toString()
    } catch (err) {
      throw new Error('Invalid payment address')
    }
  }
  if (query.token) {
    if (
      ![SEND_ADDRESS, USDC_ADDRESS, WSOL_ADDRESS].includes(
        query.token as string
      )
    ) {
      throw new Error('Invalid payment token')
    }
    try {
      tokenMint = new PublicKey(query.token).toString()
      if (query.token == SEND_ADDRESS) {
        tokenDecimals = SEND_DECIMALS
      } else if (query.token == USDC_ADDRESS) {
        tokenDecimals = USDC_DECIMALS
      } else {
        tokenDecimals = WSOL_DECIMALS
      }
    } catch (err) {
      throw new Error('Invalid payment token')
    }
  }
  if (!validateEmail(query.email as string)) {
    throw "Invalid email provided"
  }
  return {
    email: query.email,
    name: query.name,
    description: query.description,
    image: query.image || DEFAULT_IMAGE,
    target: query.target,
    beneficiary,
    tokenMint,
    tokenDecimals,
  }
}

export const validateVerifyCrowdFundQueryParams = (query: Query) => {
  let beneficiary
  let tokenMint
  let tokenDecimals
  if (query.beneficiary) {
    try {
      beneficiary = new PublicKey(query.beneficiary).toString()
    } catch (err) {
      throw new Error('Invalid payment address')
    }
  }
  if (query.tokenMint) {
    if (
      ![SEND_ADDRESS, USDC_ADDRESS, WSOL_ADDRESS].includes(
        query.tokenMint as string
      )
    ) {
      throw new Error('Invalid payment token')
    }
    try {
      tokenMint = new PublicKey(query.tokenMint).toString()
      if (query.tokenMint == SEND_ADDRESS) {
        tokenDecimals = SEND_DECIMALS
      } else if (query.tokenMint == USDC_ADDRESS) {
        tokenDecimals = USDC_DECIMALS
      } else {
        tokenDecimals = WSOL_DECIMALS
      }
    } catch (err) {
      throw new Error('Invalid payment token')
    }
  }
  if (!validateEmail(query.email as string)) {
    throw "Invalid email provided"
  }
  return {
    email: query.email,
    name: query.name,
    description: query.description,
    image: query.image || DEFAULT_IMAGE,
    target: query.target,
    beneficiary,
    tokenMint,
    tokenDecimals,
  }
}

export const validateDonateParams = (query: Query) => {
  if (!query.amount) throw 'Param "amount" required'
  if (!query.token) throw 'Param "payment" token required'
  return {
    amount: parseFloat(query.amount as string),
    token: query.token,
  }
}

export const getCurrency = (mint: string) => {
  if (mint == WSOL_ADDRESS) return SupportedToken.SOL
  if (mint == SEND_ADDRESS) return SupportedToken.SEND
  if (mint == USDC_ADDRESS) return SupportedToken.USDC
}

export const getDonateActionGetResponse = (
  crowdFundId: number,
  target: BigInt,
  totalRaised: BigInt,
  title: string,
  icon: string,
  description: string,
  tokenMint: string,
  decimals: number,
  baseUrl: string
) => {
  let currencyOptions = [
    {
      label: 'SOL',
      value: WSOL_ADDRESS,
      selected: false,
    },
  ]
  if (tokenMint == SEND_ADDRESS) {
    currencyOptions.push({
      label: 'SEND',
      value: SEND_ADDRESS,
      selected: true,
    })
  } else if (tokenMint == USDC_ADDRESS) {
    currencyOptions.push({
      label: 'USDC',
      value: USDC_ADDRESS,
      selected: true,
    })
  } else {
    currencyOptions[0].selected = true
  }
  const selectedOption = currencyOptions.filter((opt) => opt.selected)
  const formattedTarget = parseInt(target.toString()) / 10 ** decimals
  const formattedTotalRaised = parseInt(totalRaised.toString()) / 10 ** decimals
  const data: ActionGetResponse = {
    type: 'action',
    title,
    icon,
    description: `${description}\n\nTarget: ${formattedTarget}${selectedOption[0].label}\nTotalRaised: ${formattedTotalRaised}${selectedOption[0].label}`,
    label: '',
    disabled: target <= totalRaised,
    links: {
      actions: [
        {
          label: target <= totalRaised ? 'Target Reached' : 'Donate',
          href: `${baseUrl}/actions/donate?cId=${crowdFundId}&amount={amount}&token={token}`,
          parameters: [
            {
              name: 'amount',
              label: 'Enter amount to donate (10)',
              type: 'number',
              min: 0,
              required: true,
            },
            {
              name: 'token',
              label: 'Select payment token',
              type: 'select',
              options: currencyOptions,
            },
          ],
        },
      ],
    },
  }
  return data
}

export const getCreateCrowdFundActionGetResponse = (baseUrl: string) => {
  const data: ActionGetResponse = {
    type: 'action',
    title: 'Metafundr - Create crowdfund',
    icon: DEFAULT_IMAGE,
    description: 'Blockchain donation and crowdfunding platform using blinks',
    label: '',
    links: {
      actions: [
        {
          label: 'Create Crowdfund',
          href: `${baseUrl}/actions/crowdfund/create?name={name}&description={desc}&email={email}&image={img}&beneficiary={ben}&target={target}&token={token}`,
          parameters: [
            {
              name: 'name',
              label: 'Enter title of the crowdfund',
              type: 'text',
              required: true,
            },
            {
              name: 'desc',
              label: 'Enter crowdfund description',
              type: 'textarea',
              required: true,
            },
            {
              name: 'img',
              label: 'Enter image url for your crowdfund',
              type: 'url',
              required: false,
            },
            {
              name: 'ben',
              label: 'Enter payment address',
              type: 'text',
              required: true,
            },
            {
              name: 'target',
              label: 'Enter target amount (10)',
              type: 'number',
              min: 1,
              required: true,
            },
            {
              name: 'email',
              label: 'Enter email address to receive donation link',
              type: 'text',
              required: true,
            },
            {
              name: 'token',
              label: 'Select payment token',
              type: 'select',
              options: [
                {
                  label: 'SEND',
                  value: SEND_ADDRESS,
                  selected: true,
                },
                {
                  label: 'SOL',
                  value: WSOL_ADDRESS,
                  selected: false,
                },
                {
                  label: 'USDC',
                  value: USDC_ADDRESS,
                  selected: false,
                },
              ],
            },
          ],
        },
      ],
    },
  }
  return data
}
