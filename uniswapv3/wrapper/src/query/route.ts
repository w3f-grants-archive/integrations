import {
  ChainId,
  Pool,
  Route,
  Token,
  Price as PriceType,
  Input_createRoute,
  Input_routeChainId,
  Input_routeMidPrice,
} from "./w3";
import {
  poolChainId,
  poolInvolvesToken,
  poolToken0Price,
  poolToken1Price,
} from "./pool";
import { wrapToken } from "../utils/tokenUtils";
import { tokenEquals } from "./token";
import Price from "../utils/Price";

class MidPriceStep {
  nextInput: Token;
  price: Price;
}

/**
 * Constructs and validates a Route
 * @param input.pools the ordered list of pools from which to construct the route
 * @param input.inToken the input token
 * @param input.outToken the output token
 */
export function createRoute(input: Input_createRoute): Route {
  const pools: Pool[] = input.pools;
  const inToken: Token = input.inToken;
  const outToken: Token = input.outToken;

  if (pools.length == 0) {
    throw new Error("POOLS: pools cannot be an empty array");
  }

  const chainId: ChainId = poolChainId({ pool: pools[0] });
  let allOnSameChain: boolean = true;
  for (let i = 0; i < pools.length; i++) {
    if (poolChainId({ pool: pools[i] }) != chainId) {
      allOnSameChain = false;
      break;
    }
  }
  if (!allOnSameChain) {
    throw new Error("CHAIN_IDS: all pools must be on the same chain");
  }

  const wrappedInput: Token = wrapToken(inToken);
  if (!poolInvolvesToken({ pool: pools[0], token: wrappedInput })) {
    throw new Error(
      "INPUT: the first pool in pools must involve the input token"
    );
  }

  const wrappedOutput: Token = wrapToken(outToken);
  if (
    !poolInvolvesToken({ pool: pools[pools.length - 1], token: wrappedOutput })
  ) {
    throw new Error(
      "OUTPUT: the last pool in pools must involve the output token"
    );
  }

  // Normalizes token0-token1 order and selects the next token/fee step to add to the path
  const tokenPath: Token[] = [wrappedInput];
  for (let i = 0; i < pools.length; i++) {
    const pool: Pool = pools[i];
    const currentInputToken: Token = tokenPath[i];
    if (!poolInvolvesToken({ pool: pool, token: currentInputToken })) {
      throw new Error(
        "PATH: pools does not constitute a valid path, wherein each pool has a token in common with its adjacent pool"
      );
    }
    const nextToken: Token = tokenEquals({
      tokenA: currentInputToken,
      tokenB: pool.token0,
    })
      ? pool.token1
      : pool.token0;
    tokenPath.push(nextToken);
  }

  return {
    pools: pools,
    path: tokenPath,
    input: inToken,
    output: outToken,
  };
}

/**
 * Returns the chain id of the tokens in the route
 */
export function routeChainId(input: Input_routeChainId): ChainId {
  return poolChainId({ pool: input.route.pools[0] });
}

/**
 * Returns the mid price of the route
 */
export function routeMidPrice(input: Input_routeMidPrice): PriceType {
  const route: Route = input.route;

  const price: Price = route.pools.slice(1).reduce<MidPriceStep>(
    (step: MidPriceStep, pool: Pool) => {
      const nextInput: Token = step.nextInput;
      const price: Price = step.price;
      return tokenEquals({
        tokenA: nextInput,
        tokenB: pool.token0,
      })
        ? {
            nextInput: pool.token1,
            price: price.mul(Price.from(poolToken0Price({ pool }))),
          }
        : {
            nextInput: pool.token0,
            price: price.mul(Price.from(poolToken1Price({ pool }))),
          };
    },
    tokenEquals({
      tokenA: route.pools[0].token0,
      tokenB: wrapToken(route.input),
    })
      ? {
          nextInput: route.pools[0].token1,
          price: Price.from(poolToken0Price({ pool: route.pools[0] })),
        }
      : {
          nextInput: route.pools[0].token0,
          price: Price.from(poolToken1Price({ pool: route.pools[0] })),
        }
  ).price;

  return new Price(
    route.input,
    route.output,
    price.denominator,
    price.numerator
  ).toPriceType();
}
