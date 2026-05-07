// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract ManualLottery {
    address public owner;
    address public winner;
    bool public isFinished;
    address[] public participants;
    mapping(address => bool) public hasJoined;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
}
