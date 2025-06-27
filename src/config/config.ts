import dotenv from 'dotenv';
dotenv.config();

const config = {
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.RPC_URL || 'https://api.devnet.solana.com'
};

export default config;
