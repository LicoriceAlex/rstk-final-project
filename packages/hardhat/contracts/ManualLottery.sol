// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ManualLottery
/// @notice Простая лотерея, в которой владелец вручную выбирает победителя среди участников.
contract ManualLottery {
    address public owner;
    address public winner;
    bool public isFinished;
    address[] public participants;
    mapping(address => bool) public hasJoined;

    /// @notice Событие срабатывает, когда новый участник входит в лотерею.
    /// @param participant Адрес участника, который вошел в лотерею.
    event ParticipantJoined(address indexed participant);

    /// @notice Событие срабатывает, когда владелец выбирает победителя.
    /// @param winner Адрес, выбранный победителем.
    event WinnerSelected(address indexed winner);

    /// @notice Назначает развернувший контракт адрес владельцем лотереи.
    constructor() {
        owner = msg.sender;
    }

    /// @notice Ограничивает вызов функции только владельцем.
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /// @notice Регистрирует отправителя транзакции как участника лотереи.
    function joinLottery() external {
        require(!isFinished, "Lottery is finished");
        require(!hasJoined[msg.sender], "Participant already joined");

        hasJoined[msg.sender] = true;
        participants.push(msg.sender);

        emit ParticipantJoined(msg.sender);
    }

    /// @notice Вручную выбирает победителя лотереи.
    /// @param _winner Адрес существующего участника, которого нужно выбрать победителем.
    function selectWinner(address _winner) external onlyOwner {
        require(!isFinished, "Lottery is already finished");
        require(hasJoined[_winner], "Winner must be a participant");

        winner = _winner;
        isFinished = true;

        emit WinnerSelected(_winner);
    }

    /// @notice Возвращает адреса всех участников.
    /// @return Список зарегистрированных участников.
    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    /// @notice Возвращает состояние лотереи и статус участия для указанного адреса.
    /// @param _participant Адрес для проверки участия в лотерее.
    /// @return lotteryOwner Адрес владельца контракта.
    /// @return selectedWinner Текущий победитель или нулевой адрес, если победитель еще не выбран.
    /// @return lotteryFinished Завершена ли лотерея.
    /// @return participantCount Количество зарегистрированных участников.
    /// @return participantJoined Участвует ли `_participant` в лотерее.
    function getLotteryInfo(
        address _participant
    )
        external
        view
        returns (
            address lotteryOwner,
            address selectedWinner,
            bool lotteryFinished,
            uint256 participantCount,
            bool participantJoined
        )
    {
        return (owner, winner, isFinished, participants.length, hasJoined[_participant]);
    }
}
