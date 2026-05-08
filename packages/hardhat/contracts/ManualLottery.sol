// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract ManualLottery {
    address public owner;
    address public winner;
    bool public isFinished;
    address[] public participants;
    mapping(address => bool) public hasJoined;

    event ParticipantJoined(address indexed participant);
    event WinnerSelected(address indexed winner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function joinLottery() external {
        require(!isFinished, "Lottery is finished");
        require(!hasJoined[msg.sender], "Participant already joined");

        hasJoined[msg.sender] = true;
        participants.push(msg.sender);

        emit ParticipantJoined(msg.sender);
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function selectWinner(address _winner) external onlyOwner {
        require(!isFinished, "Lottery is already finished");
        require(hasJoined[_winner], "Winner must be a participant");

        winner = _winner;
        isFinished = true;

        emit WinnerSelected(_winner);
    }
}
