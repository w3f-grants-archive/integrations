import { BigInt } from "@web3api/wasm-as";
import { ChainId, FeeAmount, Pool, PoolChangeResult, Token, TokenAmount } from "../../../query/w3";
import { getWETH } from "../../../utils/tokenUtils";
import {
  createPool,
  encodeSqrtRatioX96, getPoolInputAmount, getPoolOutputAmount,
  getTickAtSqrtRatio,
  nearestUsableTick,
  poolChainId,
  poolInvolvesToken,
  poolPriceOf,
  poolToken0Price,
  poolToken1Price, tokenEquals
} from "../../../query";
import { MAX_TICK, MIN_TICK } from "../../../utils/constants";
import { getTickSpacings } from "../../../utils/utils";
import { BigFloat } from "as-bigfloat";


const ONE_ETHER: BigInt = BigInt.pow(BigInt.fromUInt16(10), 18);

const USDC: Token = {
  chainId: ChainId.MAINNET,
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  currency: {
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin",
  },
};
const DAI: Token = {
  chainId: ChainId.MAINNET,
  address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  currency: {
    decimals: 18,
    symbol: "DAI",
    name: "DAI Stablecoin",
  },
};

let swapPool: Pool;

describe('Pool', () => {

  describe('Pool constructor', () => {

    it('cannot be used for tokens on different chains', () => {
      const error = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.ROPSTEN),
          fee: FeeAmount.MEDIUM,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      };
      expect(error).toThrow("CHAIN_IDS: tokens in a pool must have the same chain id");
    });

    it('cannot be given two of the same token', () => {
      const error = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: USDC,
          fee: FeeAmount.MEDIUM,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      };
      expect(error).toThrow("ADDRESSES: tokens in a pool cannot have the same address");
    });

    it('price must be within tick price bounds', () => {
      const error = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.MAINNET),
          fee: FeeAmount.MEDIUM,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 1,
          ticks: { ticks: [] },
        });
      };
      expect(error).toThrow("PRICE_BOUNDS: sqrtRatioX96 is invalid for current tick");

      const errorNeg = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.MAINNET),
          fee: FeeAmount.MEDIUM,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }).addInt(1),
          liquidity: BigInt.ZERO,
          tickCurrent: -1,
          ticks: { ticks: [] },
        });
      };
      expect(errorNeg).toThrow("PRICE_BOUNDS: sqrtRatioX96 is invalid for current tick");
    });

    it('works with valid arguments for empty pool medium fee', () => {
      const noError = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.MAINNET),
          fee: FeeAmount.MEDIUM,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      };
      expect(noError).not.toThrow();
    });

    it('works with valid arguments for empty pool low fee', () => {
      const noError = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.MAINNET),
          fee: FeeAmount.LOW,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      };
      expect(noError).not.toThrow();
    });

    it('works with valid arguments for empty pool lowest fee', () => {
      const noError = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.MAINNET),
          fee: FeeAmount.LOWEST,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      };
      expect(noError).not.toThrow();
    });

    it('works with valid arguments for empty pool high fee', () => {
      const noError = (): void => {
        createPool({
          tokenA: USDC,
          tokenB: getWETH(ChainId.MAINNET),
          fee: FeeAmount.HIGH,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      };
      expect(noError).not.toThrow();
    });
  });

  describe('token0', () => {
    it('always is the token that sorts before', () => {
        const poolA: Pool = createPool({
          tokenA: USDC,
          tokenB: DAI,
          fee: FeeAmount.LOW,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
      expect(poolA.token0).toStrictEqual(DAI);

      const poolB: Pool = createPool({
        tokenA: DAI,
        tokenB: USDC,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolB.token0).toStrictEqual(DAI);
    });
  });

  describe('token1', () => {
    it('always is the token that sorts after', () => {
      const poolA: Pool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolA.token1).toStrictEqual(USDC);

      const poolB: Pool = createPool({
        tokenA: DAI,
        tokenB: USDC,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolB.token1).toStrictEqual(USDC);
    });
  });

  describe('poolToken0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      const amount1: BigInt = BigInt.fromString("101000000");
      const amount0: BigInt = BigInt.fromString("100000000000000000000");
      const sqrtRatioX96: BigInt = encodeSqrtRatioX96({ amount1, amount0 });
      const poolA: Pool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: sqrtRatioX96,
        liquidity: BigInt.ZERO,
        tickCurrent: getTickAtSqrtRatio({ sqrtRatioX96 }),
        ticks: { ticks: [] },
      });
      const priceA: string = poolToken0Price({ pool: poolA }).price.substring(0, 5);
      expect(priceA).toStrictEqual("1.010");

      const poolB: Pool = createPool({
        tokenA: DAI,
        tokenB: USDC,
        fee: FeeAmount.LOW,
        sqrtRatioX96: sqrtRatioX96,
        liquidity: BigInt.ZERO,
        tickCurrent: getTickAtSqrtRatio({ sqrtRatioX96 }),
        ticks: { ticks: [] },
      });
      const priceB: string = poolToken0Price({ pool: poolB }).price.substring(0, 5);
      expect(priceB).toStrictEqual("1.010");
    });
  });

  describe('poolToken1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      const amount1: BigInt = BigInt.fromString("101000000");
      const amount0: BigInt = BigInt.fromString("100000000000000000000");
      const sqrtRatioX96: BigInt = encodeSqrtRatioX96({ amount1, amount0 });
      const poolA: Pool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: sqrtRatioX96,
        liquidity: BigInt.ZERO,
        tickCurrent: getTickAtSqrtRatio({ sqrtRatioX96 }),
        ticks: { ticks: [] },
      });
      const priceA: string = poolToken1Price({ pool: poolA }).price;
      const priceRoundedA: string = BigFloat.fromString(priceA).toFixed(4);
      expect(priceRoundedA).toStrictEqual("0.9901");

      const poolB: Pool = createPool({
        tokenA: DAI,
        tokenB: USDC,
        fee: FeeAmount.LOW,
        sqrtRatioX96: sqrtRatioX96,
        liquidity: BigInt.ZERO,
        tickCurrent: getTickAtSqrtRatio({ sqrtRatioX96 }),
        ticks: { ticks: [] },
      });
      const priceB: string = poolToken1Price({ pool: poolB }).price;
      const priceRoundedB: string = BigFloat.fromString(priceB).toFixed(4);
      expect(priceRoundedB).toStrictEqual("0.9901");
    });
  });

  describe('poolPriceOf', () => {

    it('returns price of token in terms of other token', () => {
      const pool: Pool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolPriceOf({ token: DAI, pool: pool })).toStrictEqual(poolToken0Price({ pool }));
      expect(poolPriceOf({ token: USDC, pool: pool })).toStrictEqual(poolToken1Price({ pool }));
    });

    it('throws if invalid token', () => {
      const error = (): void => {
        const pool: Pool = createPool({
          tokenA: USDC,
          tokenB: DAI,
          fee: FeeAmount.LOW,
          sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
          liquidity: BigInt.ZERO,
          tickCurrent: 0,
          ticks: { ticks: [] },
        });
        poolPriceOf({ token: getWETH(ChainId.MAINNET), pool: pool });
      };
      expect(error).toThrow("TOKEN: Cannot return the price of a token that is not in the pool");
    });
  });

  describe('chainId', () => {
    it('returns the token0 chainId', () => {
      const poolA: Pool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolChainId({ pool: poolA })).toStrictEqual(ChainId.MAINNET);

      const poolB: Pool = createPool({
        tokenA: DAI,
        tokenB: USDC,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolChainId({ pool: poolB })).toStrictEqual(ChainId.MAINNET);
    });
  });

  describe('involvesToken', () => {
    it('returns true iff token is in pool', () => {
      const pool: Pool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: BigInt.ZERO,
        tickCurrent: 0,
        ticks: { ticks: [] },
      });
      expect(poolInvolvesToken({ token: USDC, pool: pool })).toStrictEqual(true);
      expect(poolInvolvesToken({ token: DAI, pool: pool })).toStrictEqual(true);
      expect(poolInvolvesToken({ token: getWETH(ChainId.MAINNET), pool: pool })).toStrictEqual(false);
    });
  });

  describe('swaps', () => {

    beforeAll(() => {
      swapPool = createPool({
        tokenA: USDC,
        tokenB: DAI,
        fee: FeeAmount.LOW,
        sqrtRatioX96: encodeSqrtRatioX96({ amount1: BigInt.ONE, amount0: BigInt.ONE }),
        liquidity: ONE_ETHER,
        tickCurrent: 0,
        ticks: { ticks: [
          {
            index: nearestUsableTick({ tick: MIN_TICK, tickSpacing: getTickSpacings(FeeAmount.LOW) }),
            liquidityNet: ONE_ETHER,
            liquidityGross: ONE_ETHER
          },
            {
              index: nearestUsableTick({ tick: MAX_TICK, tickSpacing: getTickSpacings(FeeAmount.LOW) }),
              liquidityNet: ONE_ETHER.opposite(),
              liquidityGross: ONE_ETHER
            }]
        },
      });
    });

    describe('getOutputAmount', () => {

      it('USDC -> DAI', () => {
        const inputAmount: TokenAmount = {
          token: USDC,
          amount: BigInt.fromUInt16(100),
        };
        const poolChangeResult: PoolChangeResult = getPoolOutputAmount({ inputAmount, sqrtPriceLimitX96: null, pool: swapPool });
        const outputAmount: TokenAmount = poolChangeResult.tokenAmount;
        expect(tokenEquals({ tokenA: outputAmount.token, tokenB: DAI })).toStrictEqual(true);
        expect(outputAmount.amount.toInt32()).toStrictEqual(98);
      });

      // it('DAI -> USDC', () => {
      //   const inputAmount: TokenAmount = {
      //     token: DAI,
      //     amount: BigInt.fromUInt16(100),
      //   };
      //   const poolChangeResult: PoolChangeResult = getPoolOutputAmount({ inputAmount, sqrtPriceLimitX96: null, pool: swapPool });
      //   const outputAmount: TokenAmount = poolChangeResult.tokenAmount;
      //   expect(tokenEquals({ tokenA: outputAmount.token, tokenB: USDC })).toStrictEqual(true);
      //   expect(outputAmount.amount.toInt32()).toStrictEqual(98);
      // });
    });

    describe('getInputAmount', () => {

      it('USDC -> DAI', () => {
        const outputAmount: TokenAmount = {
          token: DAI,
          amount: BigInt.fromUInt16(98),
        };
        const poolChangeResult: PoolChangeResult = getPoolInputAmount({ outputAmount, sqrtPriceLimitX96: null, pool: swapPool });
        const inputAmount: TokenAmount = poolChangeResult.tokenAmount;
        expect(tokenEquals({ tokenA: inputAmount.token, tokenB: USDC })).toStrictEqual(true);
        expect(inputAmount.amount.toInt32()).toStrictEqual(100);
      });

      // it('DAI -> USDC', () => {
      //   const outputAmount: TokenAmount = {
      //     token: USDC,
      //     amount: BigInt.fromUInt16(98),
      //   };
      //   const poolChangeResult: PoolChangeResult = getPoolInputAmount({ outputAmount, sqrtPriceLimitX96: null, pool: swapPool });
      //   const inputAmount: TokenAmount = poolChangeResult.tokenAmount;
      //   expect(tokenEquals({ tokenA: inputAmount.token, tokenB: DAI })).toStrictEqual(true);
      //   expect(inputAmount.amount.toInt32()).toStrictEqual(100);
      // });
    });
  });
});