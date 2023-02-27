pragma solidity ^0.5.16;

import "./NBNB.sol";

/**
 * @title Narwhal's Maximillion Contract
 * @author Narwhal
 */
contract Maximillion {
    /**
     * @notice The default nBnb market to repay in
     */
    NBNB public nBnb;

    /**
     * @notice Construct a Maximillion to repay max in a NBNB market
     */
    constructor(NBNB nBnb_) public {
        nBnb = nBnb_;
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in the nBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, nBnb);
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in a nBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param nBnb_ The address of the nBnb contract to repay in
     */
    function repayBehalfExplicit(address borrower, NBNB nBnb_) public payable {
        uint received = msg.value;
        uint borrows = nBnb_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            nBnb_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            nBnb_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
