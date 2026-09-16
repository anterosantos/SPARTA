import { describe, it, expect } from "vitest"
import { sessionLabelWithOpponent, sessionCompactLabel } from "./session-colors"

describe("sessionLabelWithOpponent", () => {
  it("acrescenta ' vs adversário' para jogo com opponent_name", () => {
    expect(
      sessionLabelWithOpponent("Jogo", { type: "match", opponent_name: "O Elvas" })
    ).toBe("Jogo vs O Elvas")
  })

  it("acrescenta ' (C)' quando is_home=true", () => {
    expect(
      sessionLabelWithOpponent("Jogo", { type: "match", opponent_name: "O Elvas", is_home: true })
    ).toBe("Jogo vs O Elvas (C)")
  })

  it("acrescenta ' (F)' quando is_home=false", () => {
    expect(
      sessionLabelWithOpponent("Jogo", { type: "match", opponent_name: "O Elvas", is_home: false })
    ).toBe("Jogo vs O Elvas (F)")
  })

  it("sem sufixo quando is_home é null/undefined", () => {
    expect(
      sessionLabelWithOpponent("Jogo", { type: "match", opponent_name: "O Elvas", is_home: null })
    ).toBe("Jogo vs O Elvas")
  })

  it("devolve só o label quando não há opponent_name", () => {
    expect(sessionLabelWithOpponent("Jogo", { type: "match", opponent_name: null })).toBe("Jogo")
  })

  it("devolve só o label para treino, mesmo com opponent_name preenchido (não deveria acontecer, mas não deve aplicar 'vs')", () => {
    expect(
      sessionLabelWithOpponent("Treino", { type: "training", opponent_name: "O Elvas" })
    ).toBe("Treino")
  })

  it("funciona para jogo amigável", () => {
    expect(
      sessionLabelWithOpponent("Amigável", { type: "friendly", opponent_name: "Benfica", is_home: false })
    ).toBe("Amigável vs Benfica (F)")
  })
})

describe("sessionCompactLabel", () => {
  it("omite a palavra do tipo — só 'vs Adversário (C|F)'", () => {
    expect(
      sessionCompactLabel("Jogo", { type: "match", opponent_name: "O Elvas", is_home: true })
    ).toBe("vs O Elvas (C)")
    expect(
      sessionCompactLabel("Jogo", { type: "match", opponent_name: "O Elvas", is_home: false })
    ).toBe("vs O Elvas (F)")
  })

  it("cai de volta ao label quando não há opponent_name", () => {
    expect(sessionCompactLabel("Jogo", { type: "match", opponent_name: null })).toBe("Jogo")
  })

  it("cai de volta ao label para treino", () => {
    expect(sessionCompactLabel("Treino", { type: "training", opponent_name: null })).toBe("Treino")
  })
})
