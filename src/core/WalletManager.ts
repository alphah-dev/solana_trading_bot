import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import bs58 from 'bs58';
import config from '../config/config';
import { connection } from '../config/solana';
import logger from '../utils/logger';

export class WalletManager {
    public readonly treasuryWallet: Keypair;
    private connection: Connection;
    private activeWorkerWallets: Map<string, Keypair>;

    constructor() {
        this.connection = connection;
        this.activeWorkerWallets = new Map();

        if (!config.privateKey) {
            logger.error("PRIVATE_KEY is missing from environment variables.");
            throw new Error("WalletManager initialization failed due to missing PRIVATE_KEY.");
        }

        try {
            const privateKeyBytes = bs58.decode(config.privateKey);
            this.treasuryWallet = Keypair.fromSecretKey(privateKeyBytes);
            logger.info({ pubKey: this.treasuryWallet.publicKey.toBase58() }, "Treasury wallet loaded successfully.");
        } catch (error) {
            logger.error({ err: error }, "Failed to load treasury wallet from PRIVATE_KEY.");
            throw new Error("Could not initialize WalletManager due to invalid private key.");
        }
    }

    public async createAndFundWallet(amountInSol: number): Promise<Keypair> {
        const workerWallet = Keypair.generate();
        const workerPubKey = workerWallet.publicKey.toBase58();

        this.activeWorkerWallets.set(workerPubKey, workerWallet);

        logger.info({ workerPubKey }, `Creating and funding worker wallet with ${amountInSol} SOL`);
        await this.transferSol(this.treasuryWallet, workerWallet.publicKey, amountInSol);

        return workerWallet;
    }

    public async transferSol(from: Keypair, to: PublicKey, amountInSol: number): Promise<string> {
        const lamports = Math.round(amountInSol * LAMPORTS_PER_SOL);

        logger.info({
            from: from.publicKey.toBase58(),
            to: to.toBase58(),
            amountInSol
        }, "Initiating SOL transfer");

        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: from.publicKey,
                    toPubkey: to,
                    lamports
                })
            );

            const signature = await sendAndConfirmTransaction(this.connection, transaction, [from]);

            logger.info({ signature }, "Transfer successful");
            return signature;
        } catch (error) {
            logger.error({
                err: error,
                from: from.publicKey.toBase58(),
                to: to.toBase58(),
                amountInSol
            }, "Transfer failed");
            throw error;
        }
    }

    public async closeWalletAndReclaimSol(workerKeypair: Keypair): Promise<string> {
        const workerPubKey = workerKeypair.publicKey;
        const workerAddress = workerPubKey.toBase58();

        try {
            const balance = await this.connection.getBalance(workerPubKey);

            if (balance === 0) {
                logger.info({ workerPubKey: workerAddress }, "Worker wallet has zero balance.");
                this.activeWorkerWallets.delete(workerAddress);
                return "No transaction needed.";
            }

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: workerPubKey,
                    toPubkey: this.treasuryWallet.publicKey,
                    lamports: balance
                })
            );

            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.treasuryWallet.publicKey;

            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [workerKeypair, this.treasuryWallet]
            );

            logger.info({
                signature,
                reclaimedAmount: balance / LAMPORTS_PER_SOL
            }, "Wallet closed and SOL reclaimed");

            this.activeWorkerWallets.delete(workerAddress);
            return signature;
        } catch (error) {
            logger.error({ err: error, workerPubKey: workerAddress }, "Failed to close worker wallet");
            throw error;
        }
    }

    public async getSolBalance(publicKey: PublicKey): Promise<number> {
        const balance = await this.connection.getBalance(publicKey);
        return balance / LAMPORTS_PER_SOL;
    }
}
