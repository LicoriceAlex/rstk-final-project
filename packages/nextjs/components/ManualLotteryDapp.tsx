"use client";

import { useMemo, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { isAddress, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import {
  useScaffoldReadContract,
  useScaffoldWatchContractEvent,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";

type TxState = {
  type: "idle" | "waiting-signature" | "sent" | "success" | "error";
  message: string;
};

type LotteryEvent = {
  id: string;
  text: string;
};

const getReadableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Participant already joined")) {
    return "Пользователь уже участвует в лотерее.";
  }

  if (message.includes("Lottery is finished")) {
    return "Лотерея уже завершена.";
  }

  if (message.includes("Only owner can call this function")) {
    return "Выбрать победителя может только владелец контракта.";
  }

  if (message.includes("Winner must be a participant")) {
    return "Победителем можно выбрать только участника лотереи.";
  }

  if (message.includes("Lottery is already finished")) {
    return "Победитель уже выбран, лотерея завершена.";
  }

  if (message.includes("User rejected")) {
    return "Пользователь отклонил подпись транзакции в MetaMask.";
  }

  return message;
};

export const ManualLotteryDapp = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const [winnerAddressInput, setWinnerAddressInput] = useState("");
  const [txState, setTxState] = useState<TxState>({
    type: "idle",
    message: "Транзакций пока не было.",
  });
  const [events, setEvents] = useState<LotteryEvent[]>([]);

  const { data: lotteryInfo, refetch: refetchLotteryInfo } = useScaffoldReadContract({
    contractName: "ManualLottery",
    functionName: "getLotteryInfo",
    args: [connectedAddress ?? zeroAddress],
  });

  const { data: participantsData, refetch: refetchParticipants } = useScaffoldReadContract({
    contractName: "ManualLottery",
    functionName: "getParticipants",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "ManualLottery",
  });

  useScaffoldWatchContractEvent({
    contractName: "ManualLottery",
    eventName: "ParticipantJoined",
    onLogs: logs => {
      setEvents(previousEvents => [
        ...logs.map(log => ({
          id: `${log.transactionHash}-${log.logIndex}`,
          text: `Участник вошёл в лотерею: ${String(log.args.participant)}`,
        })),
        ...previousEvents,
      ]);
    },
  });

  useScaffoldWatchContractEvent({
    contractName: "ManualLottery",
    eventName: "WinnerSelected",
    onLogs: logs => {
      setEvents(previousEvents => [
        ...logs.map(log => ({
          id: `${log.transactionHash}-${log.logIndex}`,
          text: `Победитель выбран: ${String(log.args.winner)}`,
        })),
        ...previousEvents,
      ]);
    },
  });

  const lotteryOwner = lotteryInfo?.[0];
  const selectedWinner = lotteryInfo?.[1] ?? zeroAddress;
  const lotteryFinished = Boolean(lotteryInfo?.[2]);
  const participantCount = lotteryInfo?.[3] ?? 0n;
  const currentUserJoined = Boolean(lotteryInfo?.[4]);

  const participants = useMemo(() => {
    return (participantsData ?? []) as readonly `0x${string}`[];
  }, [participantsData]);

  const isOwner = Boolean(
    connectedAddress && lotteryOwner && connectedAddress.toLowerCase() === lotteryOwner.toLowerCase(),
  );

  const canJoin = Boolean(connectedAddress) && !currentUserJoined && !lotteryFinished && !isMining;
  const canSelectWinner = Boolean(connectedAddress) && isOwner && !lotteryFinished && !isMining;

  const refreshLotteryData = async () => {
    await Promise.all([refetchLotteryInfo(), refetchParticipants()]);
  };

  const joinLottery = async () => {
    try {
      setTxState({
        type: "waiting-signature",
        message: "Ожидание подписи транзакции в MetaMask...",
      });

      await writeContractAsync(
        {
          functionName: "joinLottery",
        },
        {
          onSuccess: () => {
            setTxState({
              type: "sent",
              message: "Транзакция отправлена. Ожидаем подтверждения в сети...",
            });
          },
        },
      );

      setTxState({
        type: "success",
        message: "Вы успешно вошли в лотерею.",
      });

      await refreshLotteryData();
    } catch (error) {
      setTxState({
        type: "error",
        message: getReadableError(error),
      });
    }
  };

  const selectWinner = async () => {
    try {
      if (!isAddress(winnerAddressInput)) {
        setTxState({
          type: "error",
          message: "Введите корректный Ethereum-адрес участника.",
        });
        return;
      }

      const normalizedWinnerAddress = winnerAddressInput as `0x${string}`;

      const selectedAddressIsParticipant = participants.some(
        participant => participant.toLowerCase() === normalizedWinnerAddress.toLowerCase(),
      );

      if (!selectedAddressIsParticipant) {
        setTxState({
          type: "error",
          message: "Этот адрес отсутствует в списке участников.",
        });
        return;
      }

      setTxState({
        type: "waiting-signature",
        message: "Ожидание подписи транзакции выбора победителя в MetaMask...",
      });

      await writeContractAsync(
        {
          functionName: "selectWinner",
          args: [normalizedWinnerAddress],
        },
        {
          onSuccess: () => {
            setTxState({
              type: "sent",
              message: "Транзакция выбора победителя отправлена. Ожидаем подтверждения...",
            });
          },
        },
      );

      setTxState({
        type: "success",
        message: "Победитель успешно выбран. Лотерея завершена.",
      });

      setWinnerAddressInput("");
      await refreshLotteryData();
    } catch (error) {
      setTxState({
        type: "error",
        message: getReadableError(error),
      });
    }
  };

  const joinButtonText = useMemo(() => {
    if (!connectedAddress) {
      return "Подключите кошелёк";
    }

    if (lotteryFinished) {
      return "Лотерея завершена";
    }

    if (currentUserJoined) {
      return "Вы уже участвуете";
    }

    if (isMining) {
      return "Выполняется транзакция...";
    }

    return "Войти в лотерею";
  }, [connectedAddress, currentUserJoined, isMining, lotteryFinished]);

  return (
    <main className="min-h-screen bg-base-200 px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-3xl bg-base-100 p-6 shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide opacity-60">ManualLottery DApp</p>
              <h1 className="mt-2 text-3xl font-bold">Мини-игра «Лотерея»</h1>
              <p className="mt-3 max-w-2xl text-base opacity-75">
                Пользователь подключает кошелёк, входит в список участников, а владелец контракта вручную выбирает
                победителя.
              </p>
            </div>

            <div className="rounded-2xl bg-base-200 px-4 py-3 text-sm">
              <p className="mb-1 font-semibold">Подключённый адрес</p>
              {connectedAddress ? (
                <Address address={connectedAddress} chain={targetNetwork} />
              ) : (
                <span className="opacity-60">Кошелёк не подключён</span>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-base-100 p-5 shadow-md">
            <p className="text-sm opacity-60">Владелец</p>
            <div className="mt-3">
              {lotteryOwner ? <Address address={lotteryOwner} chain={targetNetwork} /> : <span>Загрузка...</span>}
            </div>
          </div>

          <div className="rounded-3xl bg-base-100 p-5 shadow-md">
            <p className="text-sm opacity-60">Победитель</p>
            <div className="mt-3">
              {selectedWinner !== zeroAddress ? (
                <Address address={selectedWinner} chain={targetNetwork} />
              ) : (
                <span className="opacity-60">Пока не выбран</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-base-100 p-5 shadow-md">
            <p className="text-sm opacity-60">Статус</p>
            <div className="mt-3">
              <span className={`badge ${lotteryFinished ? "badge-error" : "badge-success"}`}>
                {lotteryFinished ? "Завершена" : "Активна"}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-base-100 p-5 shadow-md">
            <p className="text-sm opacity-60">Участников</p>
            <p className="mt-2 text-3xl font-bold">{participantCount.toString()}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-base-100 p-6 shadow-md">
            <h2 className="text-xl font-bold">Вход в лотерею</h2>
            <p className="mt-2 text-sm opacity-70">
              Один адрес может участвовать только один раз. После завершения лотереи регистрация закрывается.
            </p>

            <button className="btn btn-primary mt-5 w-full md:w-auto" disabled={!canJoin} onClick={joinLottery}>
              {joinButtonText}
            </button>

            {connectedAddress && (
              <p className="mt-4 text-sm">
                Ваш статус:{" "}
                <span className={currentUserJoined ? "font-semibold text-success" : "font-semibold"}>
                  {currentUserJoined ? "участвуете" : "ещё не участвуете"}
                </span>
              </p>
            )}
          </div>

          <div className="rounded-3xl bg-base-100 p-6 shadow-md">
            <h2 className="text-xl font-bold">Выбор победителя</h2>
            <p className="mt-2 text-sm opacity-70">
              Эта форма доступна только владельцу контракта. Победителем можно выбрать только адрес из списка
              участников.
            </p>

            <input
              className="input input-bordered mt-5 w-full"
              disabled={!canSelectWinner}
              placeholder="0x..."
              value={winnerAddressInput}
              onChange={event => setWinnerAddressInput(event.target.value)}
            />

            <button className="btn btn-secondary mt-4 w-full" disabled={!canSelectWinner} onClick={selectWinner}>
              {isMining ? "Выполняется транзакция..." : "Выбрать победителя"}
            </button>

            {!connectedAddress && <p className="mt-3 text-sm opacity-60">Для выбора победителя подключите кошелёк.</p>}

            {connectedAddress && !isOwner && (
              <p className="mt-3 text-sm opacity-60">Текущий кошелёк не является владельцем контракта.</p>
            )}

            {lotteryFinished && <p className="mt-3 text-sm opacity-60">Лотерея уже завершена.</p>}
          </div>
        </section>

        <section className="rounded-3xl bg-base-100 p-6 shadow-md">
          <h2 className="text-xl font-bold">Статус транзакции</h2>
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm ${
              txState.type === "error"
                ? "border-error bg-error/10"
                : txState.type === "success"
                  ? "border-success bg-success/10"
                  : "border-base-300 bg-base-200"
            }`}
          >
            {txState.message}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-base-100 p-6 shadow-md">
            <h2 className="text-xl font-bold">Список участников</h2>

            {participants.length === 0 ? (
              <p className="mt-4 text-sm opacity-60">Пока нет участников.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {participants.map((participant, index) => (
                  <div
                    key={participant}
                    className="flex flex-col gap-2 rounded-2xl bg-base-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <span className="text-sm font-semibold">#{index + 1}</span>
                    <Address address={participant} chain={targetNetwork} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-base-100 p-6 shadow-md">
            <h2 className="text-xl font-bold">События контракта</h2>

            {events.length === 0 ? (
              <p className="mt-4 text-sm opacity-60">Событий пока нет.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {events.slice(0, 6).map(event => (
                  <div key={event.id} className="rounded-2xl bg-base-200 p-4 text-sm">
                    {event.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
