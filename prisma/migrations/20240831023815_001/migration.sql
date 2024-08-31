-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "CrowdFund" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "target" BIGINT NOT NULL,
    "total_raised" BIGINT NOT NULL,
    "token_mint" TEXT NOT NULL,
    "mint_decimals" INTEGER NOT NULL,
    "status" "Status" NOT NULL,
    "memo_txn_sig" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrowdFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" SERIAL NOT NULL,
    "crowd_fund_id" INTEGER NOT NULL,
    "donor" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "txn_sig" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrowdFund_memo_txn_sig_key" ON "CrowdFund"("memo_txn_sig");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_txn_sig_key" ON "Donation"("txn_sig");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_crowd_fund_id_fkey" FOREIGN KEY ("crowd_fund_id") REFERENCES "CrowdFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
