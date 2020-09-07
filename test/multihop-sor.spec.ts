// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import { expect, assert } from 'chai';
import 'mocha';
import { filterAllPools } from './testScripts/utils/subgraph';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
const allPools = require('./allPools.json');
import { BONE } from '../src/bmath';

// const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case

// const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case

// const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0'; // ANT
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case

// const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC lower case

// const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'; // MKR
const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR lower case

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

let allTokensSet, allPoolsNonZeroBalances;

describe('Tests Multihop SOR vs static allPools.json', () => {
    it('Saved pool check', async () => {
        // Uses saved pools @25/05/20.
        assert.equal(allPools.pools.length, 59, 'Should be 59 pools');

        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsNonZeroBalances] = filterAllPools(allPools);

        assert.equal(allTokensSet.size, 37, 'Should be 37 tokens'); // filter excludes duplicates
        assert.equal(
            allPoolsNonZeroBalances.length,
            45,
            'Should be 45 pools with non-zero balance'
        );
    });

    it('getTokenPairsMultiHop - Should return direct & multihop partner tokens', async () => {
        console.time('getTokenPairsMultiHop');
        let [directTokenPairsSET, allTokenPairsSET] = sor.getTokenPairsMultiHop(
            DAI,
            allTokensSet
        );
        console.timeEnd('getTokenPairsMultiHop');

        assert.equal(
            directTokenPairsSET.length,
            16,
            'Should have 16 direct tokens'
        );

        assert.equal(
            allTokenPairsSET.length,
            33,
            'Should be 33 multi-hop tokens'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/ANT Pools', async () => {
        console.time('filterPoolsWithTokensDirect');
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            ANT
        );
        console.timeEnd('filterPoolsWithTokensDirect');
        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/DAI Pools', async () => {
        console.time('filterPoolsWithTokensDirect');
        let directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensDirect');
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
        directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            DAI,
            WETH
        );
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
    });

    it('Get multihop pools - WETH>DAI', async () => {
        console.time('filterPoolsWithTokensMultihop');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensMultihop');

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        console.time('parsePoolData');
        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH,
            DAI,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );
        console.timeEnd('parsePoolData');

        // console.log("poolsSET")
        // console.log(pools)

        assert.equal(
            mostLiquidPoolsFirstHop.length,
            4,
            'Should have 4 mostLiquidPoolsFirstHop'
        );
        assert.equal(
            mostLiquidPoolsSecondHop.length,
            4,
            'Should have 4 mostLiquidPoolsSecondHop'
        );
        assert.equal(hopTokens.length, 4, 'Should have 4 hopTokens');
        assert.equal(
            Object.keys(pools).length,
            16,
            'Should have 16 multi-hop pools'
        );
    });

    it('Full Multihop SOR, WETH>DAI, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            DAI.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        // PROCESS paths
        // Finds sorted price & slippage information for paths
        let paths = sor.processPaths(pathData, pools, swapType);
        // processEpsOfInterestMultiHop
        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );
        // smartOrderRouterMultiHopEps
        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(swaps.length, 3, 'Should have 3 swaps.');

        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '202.860557251722913901',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>DAI, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            DAI.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountOut,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(swaps.length, 4, 'Should have 4 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '4.978956703358553061',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            ANT
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            WETH,
            ANT
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            ANT.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;

        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            WETH,
            ANT
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            WETH,
            ANT
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            ANT.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountOut,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber('1000000'); // 1 USDC
        const swapType = 'swapExactIn';
        const noPools = 4;

        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            USDC,
            MKR
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            USDC,
            MKR
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            USDC.toLowerCase(), // TODO - Why is this required????
            MKR.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 2, 'Should have 2 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.002932410291658511',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;

        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            USDC,
            MKR
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            USDC,
            MKR
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            USDC.toLowerCase(), // TODO - Why is this required????
            MKR.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountOut,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 2, 'Should have 2 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.000000003559698325',
            'Total Out Should Match'
        );
    });
});
