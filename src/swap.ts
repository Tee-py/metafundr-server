// import {
//   LIQUIDITY_STATE_LAYOUT_V4,
//   LiquidityPoolKeys,
//   MAINNET_PROGRAM_ID,
//   MARKET_STATE_LAYOUT_V3,
//   LiquidityPoolInfo,
//   TOKEN_PROGRAM_ID,
//   WSOL,
//   Liquidity,
//   Percent,
//   Token,
//   TokenAmount,
// } from '@raydium-io/raydium-sdk'
// import fs from 'fs'
// import BN from 'bn.js'
// import {
//   Connection,
//   PublicKey,
//   Keypair,
//   SystemProgram,
//   Transaction,
//   TransactionInstruction,
//   sendAndConfirmTransaction,
//   clusterApiUrl,
// } from '@solana/web3.js'
// import {
//   createWrappedNativeAccount,
//   getOrCreateAssociatedTokenAccount,
//   createSyncNativeInstruction,
//   NATIVE_MINT,
//   getAccount,
//   getAssociatedTokenAddress,
//   ASSOCIATED_TOKEN_PROGRAM_ID,
//   createAssociatedTokenAccountInstruction,
// } from '@solana/spl-token'
// import { SOL_SEND_POOL, SOL_USDC_POOL } from './constants'
// import { solSendPoolKeys, solUsdcPoolKeys } from './pool'

// const getPoolKeys = async (ammId: string, connection: Connection) => {
//   const ammAccount = await connection.getAccountInfo(new PublicKey(ammId))
//   if (ammAccount) {
//     const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(ammAccount.data)
//     const marketAccount = await connection.getAccountInfo(poolState.marketId)
//     if (marketAccount) {
//       const marketState = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)
//       const marketAuthority = PublicKey.createProgramAddressSync(
//         [
//           marketState.ownAddress.toBuffer(),
//           marketState.vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
//         ],
//         MAINNET_PROGRAM_ID.OPENBOOK_MARKET
//       )
//       return {
//         id: new PublicKey(ammId),
//         programId: MAINNET_PROGRAM_ID.AmmV4,
//         status: poolState.status,
//         baseDecimals: poolState.baseDecimal.toNumber(),
//         quoteDecimals: poolState.quoteDecimal.toNumber(),
//         lpDecimals: 9,
//         baseMint: poolState.baseMint,
//         quoteMint: poolState.quoteMint,
//         version: 4,
//         authority: new PublicKey(
//           '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'
//         ),
//         openOrders: poolState.openOrders,
//         baseVault: poolState.baseVault,
//         quoteVault: poolState.quoteVault,
//         marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
//         marketId: marketState.ownAddress,
//         marketBids: marketState.bids,
//         marketAsks: marketState.asks,
//         marketEventQueue: marketState.eventQueue,
//         marketBaseVault: marketState.baseVault,
//         marketQuoteVault: marketState.quoteVault,
//         marketAuthority: marketAuthority,
//         targetOrders: poolState.targetOrders,
//         lpMint: poolState.lpMint,
//       } as unknown as LiquidityPoolKeys
//     }
//   }
// }

// const calculateAmountIn = async (
//   poolKeys: LiquidityPoolKeys,
//   poolInfo: LiquidityPoolInfo,
//   tokenToBuy: string,
//   amountOut: number,
//   rawSlippage: number
// ) => {
//   let tokenOutMint = new PublicKey(tokenToBuy)
//   let tokenOutDecimals = poolKeys.baseMint.equals(tokenOutMint)
//     ? poolInfo.baseDecimals
//     : poolKeys.quoteDecimals
//   let tokenInMint = poolKeys.baseMint.equals(tokenOutMint)
//     ? poolKeys.quoteMint
//     : poolKeys.baseMint
//   let tokenInDecimals = poolKeys.baseMint.equals(tokenOutMint)
//     ? poolInfo.quoteDecimals
//     : poolInfo.baseDecimals
//   const baseIn = poolKeys.baseMint.equals(tokenInMint) ? true : false
//   const tokenIn = new Token(TOKEN_PROGRAM_ID, tokenInMint, tokenInDecimals)
//   const tokenOut = new Token(TOKEN_PROGRAM_ID, tokenOutMint, tokenOutDecimals)
//   const tknAmountOut = new TokenAmount(tokenOut, amountOut, false)
//   const slippage = new Percent(rawSlippage, 100)
//   return {
//     amountOut: tknAmountOut,
//     tokenIn: tokenInMint,
//     tokenOut: tokenOutMint,
//     baseIn,
//     ...Liquidity.computeAmountIn({
//       poolKeys,
//       poolInfo,
//       amountOut: tknAmountOut,
//       currencyIn: tokenIn,
//       slippage,
//     }),
//   }
// }

// const makeSwapInstruction = async (
//   connection: Connection,
//   tokenToBuy: string,
//   rawAmountIn: number,
//   slippage: number,
//   poolKeys: LiquidityPoolKeys,
//   poolInfo: LiquidityPoolInfo,
//   keyPair: Keypair
// ) => {
//   const { amountOut, amountIn, tokenIn, tokenOut, maxAmountIn, baseIn } =
//     await calculateAmountIn(
//       poolKeys,
//       poolInfo,
//       tokenToBuy,
//       rawAmountIn,
//       slippage
//     )
//   const tokenInAccount = await getAssociatedTokenAddress(
//     NATIVE_MINT,
//     keyPair.publicKey,
//     false,
//     TOKEN_PROGRAM_ID,
//     ASSOCIATED_TOKEN_PROGRAM_ID
//   )
//   const tokenOutAccount = await getAssociatedTokenAddress(
//     tokenOut,
//     keyPair.publicKey,
//     false,
//     TOKEN_PROGRAM_ID,
//     ASSOCIATED_TOKEN_PROGRAM_ID
//   )
//   let instructions: TransactionInstruction[] = [];

//   try {
//     await getAccount(connection, tokenInAccount);
//   } catch (error) {
//     instructions.push(createAssociatedTokenAccountInstruction(
//         keyPair.publicKey,
//         tokenInAccount,
//         keyPair.publicKey,
//         tokenIn,
//         TOKEN_PROGRAM_ID,
//         ASSOCIATED_TOKEN_PROGRAM_ID
//     ))
//     instructions.push(
//       SystemProgram.transfer({
//         fromPubkey: keyPair.publicKey,
//         toPubkey: tokenInAccount,
//         lamports: amountIn.raw.toNumber(),
//       }),
//       createSyncNativeInstruction(tokenInAccount, TOKEN_PROGRAM_ID)
//     )
//   }
//   try {
//     await getAccount(connection, tokenOutAccount);
//   } catch (error) {
//     instructions.push(createAssociatedTokenAccountInstruction(
//         keyPair.publicKey,
//         tokenOutAccount,
//         keyPair.publicKey,
//         tokenOut,
//         TOKEN_PROGRAM_ID,
//         ASSOCIATED_TOKEN_PROGRAM_ID
//     ))
//   }
//   const amountInArray = baseIn ? new BN(amountIn.raw).toArray('le', 8) : new BN(maxAmountIn.raw).toArray('le', 8)
//   const amountOutArray = baseIn ? new BN(amountOut.raw).toArray('le', 8) : new BN(mi)
//   const swapIx = new TransactionInstruction({
//     programId: new PublicKey(poolKeys.programId),
//     keys: [
//       { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
//       { pubkey: poolKeys.id, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.authority, isSigner: false, isWritable: false },
//       { pubkey: poolKeys.openOrders, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.baseVault, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.quoteVault, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketProgramId, isSigner: false, isWritable: false },
//       { pubkey: poolKeys.marketId, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketBids, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketAsks, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketEventQueue, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketBaseVault, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketQuoteVault, isSigner: false, isWritable: true },
//       { pubkey: poolKeys.marketAuthority, isSigner: false, isWritable: false },
//       { pubkey: tokenInAccount, isSigner: false, isWritable: true },
//       { pubkey: tokenOutAccount, isSigner: false, isWritable: true },
//       { pubkey: keyPair.publicKey, isSigner: true, isWritable: false },
//     ],
//     data: Buffer.from(
//       Uint8Array.of(
//         baseIn ? 9 : 10,
//         ...amountInArray,
//         ...new BN(amountOut.raw).toArray('le', 8)
//       )
//     ),
//   })
//   return {
//     instructions,
//     tokenInAccount: tokenInAccount,
//     tokenOutAccount: tokenOutAccount,
//     tokenIn,
//     tokenOut,
//     amountIn,
//     amountOut,
//   }
// }

// const executeTransaction = async (swapAmountIn: number, tokenToBuy: string, ammId: string) => {
//   const connection = new Connection('https://api.mainnet-beta.solana.com')
//   const secretKey = Uint8Array.from(
//     JSON.parse(fs.readFileSync(`./keypair.json`) as unknown as string)
//   )
//   const keyPair = Keypair.fromSecretKey(secretKey)
//   const slippage = 0.2 // 2% slippage tolerance

//   const poolKeys = (ammId == SOL_USDC_POOL ? solUsdcPoolKeys : solSendPoolKeys) as unknown as LiquidityPoolKeys
//   const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
//   const txn = new Transaction()
//   const { instructions, tokenInAccount, tokenIn, amountIn } =
//     await makeSwapInstruction(
//       connection,
//       tokenToBuy,
//       swapAmountIn,
//       slippage,
//       poolKeys,
//       poolInfo,
//       keyPair
//     )
//   if (tokenIn.toString() == WSOL.mint) {
//     // Convert SOL to Wrapped SOL
    
//   }
//   txn.add(...instructions)
//   const hash = await sendAndConfirmTransaction(connection, txn, [keyPair], {
//     skipPreflight: false,
//     preflightCommitment: 'confirmed',
//   })
//   console.log('Transaction Completed Successfully 🎉🚀.')
//   console.log(`Explorer URL: https://solscan.io/tx/${hash}`)
// }

// // // Convert 0.01 SOL to USDC
// // executeTransaction(
// //   0.01,
// //   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC Address
// // )

// // Convert 1 USDC to SOL
// // executeTransaction(
// //     1,
// //     WSOL.mint // WSOL Address
// // )

// const main = async () => {
//   const conn = new Connection(clusterApiUrl('mainnet-beta'))
//   const solUSDCPoolKeys = await getPoolKeys(SOL_USDC_POOL, conn)
//   const solSENDPoolKeys = await getPoolKeys(SOL_SEND_POOL, conn)

//   fs.writeFileSync('sol_usdc.json', JSON.stringify(solUSDCPoolKeys))
//   fs.writeFileSync('sol_send.json', JSON.stringify(solSENDPoolKeys))
// }

// main()
