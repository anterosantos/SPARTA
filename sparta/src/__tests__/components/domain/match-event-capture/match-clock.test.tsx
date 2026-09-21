import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MatchClock } from "@/components/domain/match-event-capture/match-clock";
import type { MatchPhaseMarkers } from "@/lib/utils/match-clock";

const NO_MARKERS: MatchPhaseMarkers = {
  matchStartAt: null,
  firstHalfEndAt: null,
  secondHalfStartAt: null,
};

const NOOP = { onStartMatch: vi.fn(), onEndFirstHalf: vi.fn(), onStartSecondHalf: vi.fn() };

describe("<MatchClock>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("por iniciar: mostra 'Jogo por iniciar' e botão 'Iniciar jogo'", () => {
    const onStartMatch = vi.fn();
    render(<MatchClock markers={NO_MARKERS} {...NOOP} onStartMatch={onStartMatch} />);

    expect(screen.getByText("Jogo por iniciar")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /iniciar jogo/i });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onStartMatch).toHaveBeenCalledTimes(1);
  });

  it("1ª parte: conta a subir a partir de matchStartAt e mostra 'Fim da 1ª parte'", () => {
    const markers: MatchPhaseMarkers = { ...NO_MARKERS, matchStartAt: "2026-09-21T10:00:00.000Z" };
    const onEndFirstHalf = vi.fn();
    render(<MatchClock markers={markers} {...NOOP} onEndFirstHalf={onEndFirstHalf} />);

    expect(screen.getByText("1ª parte")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:05");

    const btn = screen.getByRole("button", { name: /fim da 1ª parte/i });
    btn.click();
    expect(onEndFirstHalf).toHaveBeenCalledTimes(1);
  });

  it("intervalo: conta a descer a partir de 15:00 e mostra 'Iniciar 2ª parte'", () => {
    const markers: MatchPhaseMarkers = {
      matchStartAt: "2026-09-21T10:00:00.000Z",
      firstHalfEndAt: "2026-09-21T10:00:00.000Z", // = "now" no beforeEach
      secondHalfStartAt: null,
    };
    const onStartSecondHalf = vi.fn();
    render(<MatchClock markers={markers} {...NOOP} onStartSecondHalf={onStartSecondHalf} />);

    expect(screen.getByText("Intervalo")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("15:00");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("14:00");

    const btn = screen.getByRole("button", { name: /iniciar 2ª parte/i });
    btn.click();
    expect(onStartSecondHalf).toHaveBeenCalledTimes(1);
  });

  it("intervalo além dos 15 min: mostra '+mm:ss'", () => {
    const markers: MatchPhaseMarkers = {
      matchStartAt: "2026-09-21T10:00:00.000Z",
      firstHalfEndAt: "2026-09-21T10:00:00.000Z",
      secondHalfStartAt: null,
    };
    render(<MatchClock markers={markers} {...NOOP} />);

    act(() => {
      vi.advanceTimersByTime((15 * 60 + 30) * 1000); // 15min30s
    });
    expect(screen.getByRole("timer")).toHaveTextContent("+00:30");
  });

  it("2ª parte: conta a subir a partir de secondHalfStartAt, sem botão de fase", () => {
    const markers: MatchPhaseMarkers = {
      matchStartAt: "2026-09-21T09:00:00.000Z",
      firstHalfEndAt: "2026-09-21T09:35:00.000Z",
      secondHalfStartAt: "2026-09-21T10:00:00.000Z",
    };
    render(<MatchClock markers={markers} {...NOOP} />);

    expect(screen.getByText("2ª parte")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("isBusy desactiva o botão de fase visível", () => {
    render(<MatchClock markers={NO_MARKERS} {...NOOP} isBusy />);
    expect(screen.getByRole("button", { name: /iniciar jogo/i })).toBeDisabled();
  });
});
