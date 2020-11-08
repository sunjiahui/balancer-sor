import { ethers } from 'ethers';
import { Pools, SubGraphPools } from './types';
export declare function getAllPoolDataOnChain(
    pools: SubGraphPools,
    multiAddress: string,
    provider: ethers.providers.BaseProvider
): Promise<Pools>;
