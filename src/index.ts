// src/index.ts
import { WalletManager } from './core/WalletManager';
import logger from './utils/logger';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    logger.info("Starting Solana Bot ");

    let walletManager: WalletManager;
    try {
        walletManager = new WalletManager();
    } catch (error) {
        
        return;
    }

    const treasuryPubKey = walletManager.treasuryWallet.publicKey;
    const initialTreasuryBalance = await walletManager.getSolBalance(treasuryPubKey);
    logger.info(`Initial Treasury Balance: ${initialTreasuryBalance.toFixed(4)} SOL`);

    if (initialTreasuryBalance < 0.05) {
        logger.error("Treasury balance is too low. Please airdrop at least 0.05 SOL to it on devnet to run this demo.");
        logger.error(`Your treasury address is: ${treasuryPubKey.toBase58()}`);
        logger.error(`Run: solana airdrop 2 ${treasuryPubKey.toBase58()}`);
        return;
    }

    let workerWallet;
    const fundingAmount = 0.01; 
    try {
        logger.info("--- Starting Worker Wallet Creation ---");
        workerWallet = await walletManager.createAndFundWallet(fundingAmount);
        await sleep(1000); 

        const workerBalance = await walletManager.getSolBalance(workerWallet.publicKey);
        logger.info(`Worker wallet ${workerWallet.publicKey.toBase58()} created and funded with ~${workerBalance.toFixed(4)} SOL.`);
        
    } catch (error) {
        logger.error("Failed during worker wallet creation and funding. Aborting demo.");
        return;
    }
    
    
    logger.info("--- Simulating Trading Activity... ---");
    await sleep(3000); 
    logger.info("--- Trading Simulation Complete. ---");

    try {
        logger.info("--- Starting Worker Wallet Closure ---");
        await walletManager.closeWalletAndReclaimSol(workerWallet);
        await sleep(1000);

        const finalWorkerBalance = await walletManager.getSolBalance(workerWallet.publicKey);
        const finalTreasuryBalance = await walletManager.getSolBalance(treasuryPubKey);

        logger.info(`Final Worker Balance: ${finalWorkerBalance.toFixed(4)} SOL`);
        logger.info(`Final Treasury Balance: ${finalTreasuryBalance.toFixed(4)} SOL`);
        
    } catch (error) {
        logger.error("Failed to close the worker wallet.");
    }
    
    logger.info("Phase 2 Demonstration Complete.");
}

main().catch(err => {
    logger.error({ err }, "An unexpected, top-level error occurred in the main execution loop.");
});