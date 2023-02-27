// SPDX-License-Identifier: MIT
pragma solidity ^0.5.16;

import "./UniswapInterface.sol";
import "../Utils/SafeMath.sol";
import "../ComptrollerInterface.sol";
import "../NTokenInterfaces.sol";
import "./IWETH.sol";
import "../Utils/SafeBEP20.sol";
import "../Utils/WithAdmin.sol";
import "../Ownable.sol";
import "../NAIControllerInterface.sol";

interface IPancakeCallee {
    function pancakeCall(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}

contract INBNB is NTokenInterface {
    function liquidateBorrow(address borrower, NToken nTokenCollateral) external payable;

    function repayBorrowBehalf(address borrower) external payable;

    function mint() external payable;
}

contract INToken is NTokenInterface, NBep20Interface {

}

/// https://github.com/Rari-Capital/fuse-contracts/blob/master/contracts/FuseSafeLiquidator.sol
contract FlashLiquidateAndSwap is IPancakeCallee, Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    event LiquidateInfo(address nTokenBorrow,uint256 repayAmount,address nTokenCollateral);

    // testnet router:0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"
    IUniswapV2Router02 public constant PancakeRouter =
    IUniswapV2Router02(0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3);

    // testnet 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd
    address payable public constant WETH_ADDRESS = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;

    address public NBNB_ADDRESS = 0xD6694aCDdeE7bec26Bd3cD40Ae396dB594540062;
    address public NAIController_ADDRESS = 0x21c7f8958677140E721c969128D2dc4E2b580FcC;

    address payable public receiver = 0xE17281c17443b90A145d1a103d57189ffB2D912f;

    /**
     * @dev WETH contract object.
     */
    IWETH public WETH = IWETH(WETH_ADDRESS);

    /**
     * @dev Cached liquidator profit exchange source.
     * ERC20 token address or the zero address for ETH.
     * For use in `safeLiquidateToTokensWithFlashLoan`/`safeLiquidateToEthWithFlashLoan` after it is set by `postFlashLoanTokens`/`postFlashLoanWeth`.
     */
    address private _liquidatorProfitExchangeSource;

    function getERC20Balance(IBEP20 token, address account) external view returns (uint256) {
        return token.balanceOf(account);
    }

    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function leave(IBEP20 token) external {
        safeTransfer(token, msg.sender, token.balanceOf(address(this)));
    }

    function safeTransfer(
        IBEP20 token,
        address to,
        uint256 value
    ) public onlyOwner {
        token.safeTransfer(to, value);
    }

    function withdrawETH(uint256 _amount) external onlyOwner {
        address(msg.sender).transfer(_amount);
    }

    function safeApprove(
        IBEP20 token,
        address to,
        uint256 minAmount
    ) private {
        uint256 allowance = token.allowance(address(this), to);

        if (allowance < minAmount) {
            if (allowance > 0) token.safeApprove(to, 0);
            token.safeApprove(to, uint256(-1));
        }
    }

    function() external payable {}

    function safeLiquidateToEthWithFlashLoan(
        address borrower,
        uint256 repayAmount,
        INBNB nTokenBorrow,
        INToken nTokenCollateral,
        uint256 minProfitAmount,
        address exchangeProfitTo
    ) external onlyOwner {
        // Input validation
        require(repayAmount > 0, "Repay amount must be greater than 0.");

        bytes memory data = abi.encode(
            borrower,
            repayAmount,
            address(nTokenBorrow),
            address(nTokenCollateral),
            minProfitAmount,
            exchangeProfitTo
        );

        // Flashloan via Uniswap
        IUniswapV2Pair pair = IUniswapV2Pair(
            IUniswapV2Factory(PancakeRouter.factory()).getPair(
                address(nTokenCollateral.underlying()),
                WETH_ADDRESS
            )
        );
        require(address(pair) != address(0), "FlashLiquidateAndSwap: pair not is zero address");

        address token0 = pair.token0();

        pair.swap(
            token0 == WETH_ADDRESS ? repayAmount : 0,
            token0 != WETH_ADDRESS ? repayAmount : 0,
            address(this),
            data
        );
    }

    function safeLiquidateToTokensWithFlashLoan(
        address borrower,
        uint256 repayAmount,
        INToken nTokenBorrow,
        INToken nTokenCollateral,
        uint256 minProfitAmount,
        address exchangeProfitTo
    ) external onlyOwner {
        // Input validation
        require(repayAmount > 0, "Repay amount must be greater than 0.");

        // Flashloan via Uniswap (scoping `underlyingBorrow` variable to avoid "stack too deep" compiler error)
        IUniswapV2Pair pair;
        bool token0IsUnderlyingBorrow;
        {
            address underlyingBorrow;

            if  (address(nTokenBorrow) == NAIController_ADDRESS) {
                underlyingBorrow = NAIControllerInterface(address(nTokenBorrow)).getNAIAddress();
            } else {
                underlyingBorrow = nTokenBorrow.underlying();
            }
            pair = IUniswapV2Pair(
                IUniswapV2Factory(PancakeRouter.factory()).getPair(underlyingBorrow, WETH_ADDRESS)
            );
            require(address(pair) != address(0), "FlashLiquidateAndSwap: pair not is zero address");

            token0IsUnderlyingBorrow = pair.token0() == underlyingBorrow;
        }

        bytes memory data = abi.encode(
            borrower,
            repayAmount,
            address(nTokenBorrow),
            address(nTokenCollateral),
            minProfitAmount,
            exchangeProfitTo
        );

        pair.swap(
            token0IsUnderlyingBorrow ? repayAmount : 0,
            !token0IsUnderlyingBorrow ? repayAmount : 0,
            address(this),
            data
        );
    }

    function pancakeCall(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        // Decode params
        (
        address borrower,
        uint256 repayAmount,
        address nTokenBorrow,
        address nTokenCollateral,
        uint256 minProfitAmount,
        address exchangeProfitTo
        ) = abi.decode(data, (address, uint256, address, address, uint256, address));

        if (nTokenBorrow == NBNB_ADDRESS) {
            // Calculate flashloan return amount
            uint256 flashLoanReturnAmount = repayAmount.mul(1000).div(997);
            if (repayAmount.mul(1000).mod(997) > 0) flashLoanReturnAmount++; // Round up if division resulted in a remainder

            // Post WETH flashloan
            postFlashLoanWeth(
                borrower,
                repayAmount,
                INBNB(nTokenBorrow),
                INToken(nTokenCollateral),
                flashLoanReturnAmount,
                exchangeProfitTo
            );
        } else if(nTokenBorrow == NAIController_ADDRESS){
            uint256 flashLoanReturnAmount = repayAmount.mul(10000).div(9975);
            if (repayAmount.mul(10000).mod(9975) > 0) flashLoanReturnAmount++; // Round up if division resulted in a remainder

            // Post token flashloan
            postFlashLoanNai(
                borrower,
                repayAmount,
                NAIControllerInterface(nTokenBorrow),
                INToken(nTokenCollateral),
                flashLoanReturnAmount,
                exchangeProfitTo
            );
        } else {
            // Calculate flashloan return amount
            uint256 flashLoanReturnAmount = repayAmount.mul(1000).div(997);
            if (repayAmount.mul(1000).mod(997) > 0) flashLoanReturnAmount++; // Round up if division resulted in a remainder

            // Post token flashloan
            postFlashLoanTokens(
                borrower,
                repayAmount,
                INToken(nTokenBorrow),
                INToken(nTokenCollateral),
                flashLoanReturnAmount,
                exchangeProfitTo
            );
        }
    }

    function postFlashLoanWeth(
        address borrower,
        uint256 repayAmount,
        INBNB nTokenBorrow,
        INToken nTokenCollateral,
        uint256 flashLoanReturnAmount,
        address exchangeProfitTo
    ) private {
        // Unwrap WETH
        WETH.withdraw(repayAmount);

        // Liquidate ETH borrow using flashloaned ETH
        nTokenBorrow.liquidateBorrow.value(repayAmount)(borrower, NToken(address(nTokenCollateral)));

        // Redeem seized nTokens for underlying asset
        uint256 seizedNTokenAmount = nTokenCollateral.balanceOf(address(this));
        require(seizedNTokenAmount > 0, "No nTokens seized");
        uint256 redeemResult = nTokenCollateral.redeem(seizedNTokenAmount);
        require(
            redeemResult == 0,
            "Error calling redeeming seized nToken: error code not equal to 0"
        );

        // Repay flashloan
        repayWethFlashLoan(repayAmount, nTokenCollateral, flashLoanReturnAmount, exchangeProfitTo);

        emit LiquidateInfo(address(nTokenBorrow),repayAmount,address(nTokenCollateral));
    }

    function postFlashLoanTokens(
        address borrower,
        uint256 repayAmount,
        INToken nTokenBorrow,
        INToken nTokenCollateral,
        uint256 flashLoanReturnAmount,
        address exchangeProfitTo
    ) private {
        IBEP20 underlyingBorrow = IBEP20(nTokenBorrow.underlying());
        safeApprove(underlyingBorrow, address(nTokenBorrow), repayAmount);

        // 执行清算

        require(
            nTokenBorrow.liquidateBorrow(borrower, repayAmount, nTokenCollateral) == 0,
            "Liquidation borrow failed"
        );

        // 获取得到的抵押品nToken数量
        uint256 seizedNTokenAmount = nTokenCollateral.balanceOf(address(this));
        require(seizedNTokenAmount > 0, "No nTokens seized.");

        // 执行赎回
        uint256 redeemResult = nTokenCollateral.redeem(seizedNTokenAmount);
        require(
            redeemResult == 0,
            "Error calling redeeming seized nToken: error code not equal to 0"
        );

        // 还给闪电贷
        repayTokenFlashLoan(
            repayAmount,
            nTokenCollateral,
            underlyingBorrow,
            flashLoanReturnAmount,
            exchangeProfitTo
        );

        emit LiquidateInfo(address(underlyingBorrow),repayAmount,address(nTokenCollateral));
    }

    function postFlashLoanNai(
        address borrower,
        uint256 repayAmount,
        NAIControllerInterface naiController,
        INToken nTokenCollateral,
        uint256 flashLoanReturnAmount,
        address exchangeProfitTo
    ) private {
        IBEP20 underlyingBorrow = IBEP20(naiController.getNAIAddress());
        safeApprove(underlyingBorrow, address(naiController), repayAmount);


        (uint err,) = naiController.liquidateNAI(borrower, repayAmount, nTokenCollateral);
        require(
            err == 0,
            "Liquidation borrow failed"
        );

        uint256 seizedNTokenAmount = nTokenCollateral.balanceOf(address(this));
        require(seizedNTokenAmount > 0, "No nTokens seized.");

        uint256 redeemResult = nTokenCollateral.redeem(seizedNTokenAmount);
        require(
            redeemResult == 0,
            "Error calling redeeming seized nToken: error code not equal to 0"
        );

        repayTokenFlashLoan(
            repayAmount,
            nTokenCollateral,
            underlyingBorrow,
            flashLoanReturnAmount,
            exchangeProfitTo
        );

        emit LiquidateInfo(address(underlyingBorrow),repayAmount,address(nTokenCollateral));
    }

    function repayWethFlashLoan(
        uint256 repayAmount,
        INToken nTokenCollateral,
        uint256 flashLoanReturnAmount,
        address exchangeProfitTo
    ) private {
        if (address(nTokenCollateral) == NBNB_ADDRESS) {
            // Deposit ETH to WETH to repay flashloan
            WETH.deposit.value(flashLoanReturnAmount)();

            // Repay flashloan in WETH
            require(
                flashLoanReturnAmount <= IBEP20(WETH_ADDRESS).balanceOf(address(this)),
                "Flashloan return amount greater than WETH exchanged from seized collateral"
            );
            require(
                WETH.transfer(msg.sender, flashLoanReturnAmount),
                "Failed to transfer WETH back to flashlender"
            );

            uint amount = IBEP20(WETH_ADDRESS).balanceOf(address(this));
            if (amount > 0) {
                require(
                    WETH.transfer(receiver, amount),
                    "Failed to send token to receiver."
                );
            }
        } else {
            // Check underlying collateral seized
            IBEP20 underlyingCollateral = IBEP20(nTokenCollateral.underlying());
            uint256 underlyingCollateralSeized = underlyingCollateral.balanceOf(address(this));

            uint256 tokensRequired = PancakeRouter.getAmountsIn(
                repayAmount,
                array(address(underlyingCollateral), WETH_ADDRESS)
            )[0];

            require(
                tokensRequired <= underlyingCollateralSeized,
                "Flashloan return amount greater than seized collateral."
            );

            require(
                underlyingCollateral.transfer(msg.sender, tokensRequired),
                "Failed to transfer non-WETH tokens back to flashlender."
            );

            uint amount = underlyingCollateral.balanceOf(address(this));
            if (amount > 0) {
                require(
                    underlyingCollateral.transfer(receiver, amount),
                    "Failed to send token to receiver."
                );
            }
        }
    }

    function repayTokenFlashLoan(
        uint256 repayAmount,
        INToken nTokenCollateral,
        IBEP20 underlyingBorrow,
        uint256 flashLoanReturnAmount,
        address exchangeProfitTo
    ) private {
        if (address(nTokenCollateral)== NBNB_ADDRESS) {
            uint256 underlyingCollateralSeized = address(this).balance;

            uint256 wethRequired = PancakeRouter.getAmountsIn(
                repayAmount,
                array(WETH_ADDRESS, address(underlyingBorrow))
            )[0];

            require(
                wethRequired <= underlyingCollateralSeized,
                "Seized ETH collateral not enough to repay flashloan."
            );

            WETH.deposit.value(wethRequired)();

            require(
                WETH.transfer(msg.sender, wethRequired),
                "Failed to repay Uniswap flashloan with WETH exchanged from seized collateral."
            );

            uint amount = address(this).balance;
            if (amount > 0) {
                receiver.transfer(amount);
            }
        } else {
            IBEP20 underlyingCollateral = IBEP20(INToken(address(nTokenCollateral)).underlying());
            uint256 underlyingCollateralSeized = underlyingCollateral.balanceOf(address(this));

            // Check which side of the flashloan to repay
            if (address(underlyingCollateral) == address(underlyingBorrow)) {
                // Repay flashloan on borrow side with collateral
                require(
                    flashLoanReturnAmount <= underlyingBorrow.balanceOf(address(this)),
                    "Token flashloan return amount greater than tokens exchanged from seized collateral."
                );
                require(
                    underlyingBorrow.transfer(msg.sender, flashLoanReturnAmount),
                    "Failed to repay token flashloan on borrow (non-WETH) side."
                );

                uint amount = underlyingBorrow.balanceOf(address(this));
                if (amount > 0) {
                    require(
                        underlyingBorrow.transfer(receiver, amount),
                        "Failed to send token to receiver."
                    );
                }
            } else {
                // Get WETH required to repay flashloan
                uint256 wethRequired = PancakeRouter.getAmountsIn(
                    repayAmount,
                    array(WETH_ADDRESS, address(underlyingBorrow))
                )[0];

                safeApprove(
                    underlyingCollateral,
                    address(PancakeRouter),
                    underlyingCollateralSeized
                );

                if (exchangeProfitTo == address(underlyingCollateral)) {
                    PancakeRouter.swapTokensForExactTokens(
                        wethRequired,
                        underlyingCollateralSeized,
                        array(address(underlyingCollateral), WETH_ADDRESS),
                        address(this),
                        block.timestamp
                    );
                } else {
                    PancakeRouter.swapExactTokensForTokens(
                        underlyingCollateralSeized,
                        wethRequired,
                        array(address(underlyingCollateral), WETH_ADDRESS),
                        address(this),
                        block.timestamp
                    );
                }

                // Repay flashloan
                require(
                    wethRequired <= IBEP20(WETH_ADDRESS).balanceOf(address(this)),
                    "Not enough WETH exchanged from seized collateral to repay flashloan."
                );
                require(
                    WETH.transfer(msg.sender, wethRequired),
                    "Failed to repay Uniswap flashloan with WETH exchanged from seized collateral."
                );

                if (exchangeProfitTo == address(underlyingCollateral)) {
                    uint amount =  underlyingCollateral.balanceOf(address(this));
                    if (amount > 0) {
                        require(
                            underlyingCollateral.transfer(receiver, amount),
                            "Failed to send token to receiver."
                        );
                    }
                } else {
                    uint amount = IBEP20(WETH_ADDRESS).balanceOf(address(this));
                    if (amount > 0) {
                        require(
                            WETH.transfer(receiver, amount),
                            "Failed to send token to receiver."
                        );
                    }
                }
            }
        }
    }

    function array(address a, address b) private pure returns (address[] memory) {
        address[] memory arr = new address[](2);
        arr[0] = a;
        arr[1] = b;
        return arr;
    }

    function array(
        address a,
        address b,
        address c
    ) private pure returns (address[] memory) {
        address[] memory arr = new address[](3);
        arr[0] = a;
        arr[1] = b;
        arr[2] = c;
        return arr;
    }
}
