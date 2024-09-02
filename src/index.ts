import express from 'express'
import {
  createPostResponse,
  actionCorsMiddleware,
  ActionPostRequest,
  MEMO_PROGRAM_ID,
  ActionPostResponse,
  CompletedAction,
  ActionsJson,
} from '@solana/actions'
import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  getCreateCrowdFundActionGetResponse,
  getDonateActionGetResponse,
  validateAccount,
  validateDonateParams,
  validateCreateCrowdFundTransactionSignature,
  validatedCreateCrowdFundQueryParams,
  validateDonateTransactionSignature,
  getCurrency,
} from './utils'
import { PrismaClient } from '@prisma/client'
import { CrowdFundStatus } from './types'
import { DEFAULT_IMAGE, WSOL_ADDRESS } from './constants'
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import { sendCreateEmail, sendTargetReachedMail } from './email'

const connection = new Connection(
  process.env.RPC_URL || clusterApiUrl('mainnet-beta')
)
const prisma = new PrismaClient()

const app = express()
app.use(express.text())
app.use(express.json())
app.use(actionCorsMiddleware({}))

const PORT = process.env.PORT || 3000
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`

app.get('/actions.json', (req, res) => {
  const response: ActionsJson = {
    rules: [
      {
        pathPattern: '/actions',
        apiPath: '/actions',
      },
    ],
  }
  res.json(response)
})

app.get('/actions/crowdfund/create', async (req, res) => {
  const action = getCreateCrowdFundActionGetResponse(BASE_URL)
  res.json(action)
})
app.post('/actions/crowdfund/create', async (req, res) => {
  try {
    const body: ActionPostRequest = req.body
    const account = validateAccount(body.account)

    // @ts-ignore
    const validatedParams = validatedCreateCrowdFundQueryParams(req.query)
    const memoData = Buffer.from("metafundr | create", 'utf8')

    const transaction = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      }),
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: memoData,
        keys: [],
      })
    )
    transaction.feePayer = account
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash
    const respData: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: 'Transaction submitted',
        links: {
          next: {
            href: `/actions/signature/verify?type=crowdfund&data=${JSON.stringify(validatedParams)}`,
            type: 'post',
          },
        },
      },
    })
    res.json(respData)
  } catch (err) {
    console.log(err)
    await prisma.$disconnect()
    // @ts-ignore
    res.status(400).json({ error: err.message || 'An unknown error occurred' })
  }
})

app.get('/actions/donate', async (req, res) => {
  try {
    const crowdFundId = req.query.cId
    if (!crowdFundId) throw 'Param "cId" required'
    const crowdFund = await prisma.crowdFund.findUnique({
      where: {
        id: parseInt(crowdFundId.toString()),
      },
    })
    if (!crowdFund) throw 'Campaign not found'
    const action = getDonateActionGetResponse(
      crowdFund.id,
      crowdFund.target,
      crowdFund.totalRaised,
      crowdFund.name,
      crowdFund.logoUrl,
      crowdFund.description,
      crowdFund.tokenMint,
      crowdFund.mintDecimals,
      BASE_URL
    )
    res.json(
      action
    )
  } catch (err) {
    console.log(err)
    await prisma.$disconnect()
    // @ts-ignore
    res.status(400).json({ error: err.message || 'An unknown error occurred' })
  }
})
app.post('/actions/donate', async (req, res) => {
  try {
    let account: PublicKey
    try {
      account = new PublicKey(req.body.account)
    } catch (err) {
      throw 'Invalid "account" provided'
    }
    const crowdFundId = req.query.cId
    if (!crowdFundId) throw 'Param "cId" required'
    const crowdFund = await prisma.crowdFund.findUnique({
      where: {
        id: parseInt(crowdFundId.toString()),
      },
    })
    if (!crowdFund) throw 'Campaign not found'

    //@ts-ignore
    const validatedParams = validateDonateParams(req.query)
    const tokenMint = new PublicKey(crowdFund.tokenMint)
    const beneficiary = new PublicKey(crowdFund.beneficiary)
    const memoData = Buffer.from(JSON.stringify({ cId: crowdFund.id }), 'utf8')
    let transaction = new Transaction()
    transaction.add(
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: memoData,
        keys: [],
      })
    )
    if (crowdFund.tokenMint == validatedParams.token) {
      if (crowdFund.tokenMint == WSOL_ADDRESS) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: account,
            toPubkey: beneficiary,
            lamports:
              parseFloat(validatedParams.amount.toString()) * LAMPORTS_PER_SOL,
          })
        )
      } else {
        const beneficiaryAta = await getAssociatedTokenAddress(
          tokenMint,
          beneficiary
        )
        const donorAta = await getAssociatedTokenAddress(tokenMint, account)
        transaction.add(
          createTransferInstruction(
            donorAta,
            beneficiaryAta,
            account,
            BigInt(validatedParams.amount) *
              BigInt(10) ** BigInt(crowdFund.mintDecimals)
          )
        )
      }
    } else {
      //Todo: Routing on raydium and sending the token to the destination ATA
      console.log('Raydium routing needed')
      throw 'Not supported'
    }
    transaction.feePayer = account
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash
    const respData: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: 'Transaction submitted',
        links: {
          next: {
            type: 'post',
            href: '/actions/signature/verify?type=donate',
          },
        },
      },
    })
    res.json(respData)
  } catch (err) {
    console.log(err)
    //@ts-ignore
    res.status(400).json({ error: err.message || 'An error occurred' })
  }
})

app.post('/actions/signature/verify', async (req, res) => {
  try {
    if (typeof req.body == 'string') {
      req.body = JSON.parse(req.body)
    }
    const account = validateAccount(req.body.account)
    const type = req.query.type
    let payload: CompletedAction
    if (type == 'crowdfund') {
      const details = await validateCreateCrowdFundTransactionSignature(
        connection,
        req.body.signature,
        req.query.data as string,
        account
      )
      const crowdFund = await prisma.crowdFund.create({
        data: {
          name: details.memoData.name,
          email: details.memoData.email,
          description: details.memoData.description,
          memoTxnSig: details.signature,
          logoUrl: details.memoData.image,
          beneficiary: details.memoData.beneficiary,
          tokenMint: details.memoData.tokenMint,
          mintDecimals: details.memoData.tokenDecimals,
          target:
            BigInt(parseFloat(details.memoData.target)) *
            BigInt(10) ** BigInt(details.memoData.tokenDecimals),
          totalRaised: BigInt(0),
          status: CrowdFundStatus.ACTIVE,
        },
      })
      payload = {
        type: 'completed',
        title: 'Operation was successful!',
        icon: DEFAULT_IMAGE,
        label: 'Complete!',
        description:
          `You have now created a crowdfund campaign! ` +
          `You can share the donation link for your campaign: \nhttps://dial.to/?action=solana-action:${BASE_URL}/actions/donate?cId=${crowdFund.id}`,
      }
      if (crowdFund.email) {
        const formattedTarget = parseInt(crowdFund.target.toString()) / 10 ** crowdFund.mintDecimals
        const currency = getCurrency(crowdFund.tokenMint)
        try {
          await sendCreateEmail(
            crowdFund.email,
            crowdFund.name,
            `${formattedTarget} ${currency}`,
            `https://dial.to/?action=solana-action:${BASE_URL}/actions/donate?cId=${crowdFund.id}`
          )
        } catch (error) {
          console.log(error)
        }
      }
    } else if (type == 'donate') {
      const details = await validateDonateTransactionSignature(
        connection,
        req.body.signature,
        account
      )
      const crowdFund = await prisma.crowdFund.findUnique({
        where: {
          id: details.memoData.cId,
        }
      })
      if (!crowdFund) throw 'crowdfund campaign not found'
      if (parseInt(details.amount.toString()) == 0)
        throw 'Invalid donation amount'
      if (
        details.to.toString() != crowdFund.beneficiary &&
        details.to.toString() !=
          (
            await getAssociatedTokenAddress(
              new PublicKey(crowdFund.tokenMint),
              new PublicKey(crowdFund.beneficiary)
            )
          ).toString()
      )
        throw 'Invalid beneficiary'
      await prisma.$transaction([
        prisma.donation.create({
          data: {
            crowdFundId: crowdFund.id,
            donor: details.from.toString(),
            amount: details.amount,
            txnSig: details.signature,
          },
        }),
        prisma.crowdFund.update({
          where: {
            id: crowdFund.id,
          },
          data: {
            totalRaised: crowdFund.totalRaised + BigInt(details.amount),
          },
        }),
      ])
      if (crowdFund.email && crowdFund.totalRaised + BigInt(details.amount) >= crowdFund.target) {
        const formattedTarget = parseInt(crowdFund.target.toString()) / 10 ** crowdFund.mintDecimals
        const formattedTotalRaised = parseInt((crowdFund.totalRaised + BigInt(details.amount)).toString()) / 10 ** crowdFund.mintDecimals
        const currency = getCurrency(crowdFund.tokenMint)
        try {
          await sendTargetReachedMail(
            crowdFund.email,
            crowdFund.name,
            `${formattedTarget} ${currency}`,
            `${formattedTotalRaised} ${currency}`,
            `https://dial.to/?action=solana-action:${BASE_URL}/actions/donate?cId=${crowdFund.id}`
          )
        } catch (error) {
          console.log(error)
        }
      }
      payload = {
        type: 'completed',
        title: 'Donation successful!',
        icon: crowdFund.logoUrl,
        label: 'Complete!',
        description:
          `Thank you for donating to this campaign!🎉\n` +
          `You can view your transaction signature: ${details.signature}`,
      }
    } else {
      throw new Error("invalid param 'type'")
    }
    res.json(payload)
  } catch (err) {
    console.log(err)
    // @ts-ignore
    res.status(400).json({ error: err.message || 'An unknown error occurred' })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
