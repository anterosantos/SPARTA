import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ZoneCell } from "@/components/domain/match-event-capture/zone-cell";
import { MATCH_ZONES, MATCH_ZONE_LABEL } from "@/lib/schemas/match-events";

describe("<ZoneCell>", () => {
  it.each(MATCH_ZONES)("renders zone %s", (zone) => {
    render(<ZoneCell zone={zone} />);
    const button = screen.getByRole("gridcell");
    expect(button).toBeInTheDocument();
  });

  it("has correct aria-label", () => {
    render(<ZoneCell zone="att_end_left" />);
    const cell = screen.getByRole("gridcell");
    expect(cell).toHaveAttribute("aria-label", "Ataque linha de fundo esquerda");
  });

  it.each(MATCH_ZONES)("displays correct label for zone %s", (zone) => {
    render(<ZoneCell zone={zone} />);
    const label = MATCH_ZONE_LABEL[zone];
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("calls onClick with zone when clicked", () => {
    const onClick = vi.fn();
    render(<ZoneCell zone="att_end_left" onClick={onClick} />);

    const cell = screen.getByRole("gridcell");
    cell.click();

    expect(onClick).toHaveBeenCalledWith("att_end_left");
  });

  it("has correct role attribute", () => {
    render(<ZoneCell zone="mid_off_midleft" />);
    const cell = screen.getByRole("gridcell");
    expect(cell).toHaveAttribute("role", "gridcell");
  });

  it("renders all 24 zones in a test suite", () => {
    const { container } = render(
      <div>
        {MATCH_ZONES.map((zone) => (
          <ZoneCell key={zone} zone={zone} />
        ))}
      </div>
    );
    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(24);
  });

  it("sem accentBorders, nenhum lado tem borda inline (só a borda cinzenta por omissão, via classe)", () => {
    render(<ZoneCell zone="att_end_left" />);
    const cell = screen.getByRole("gridcell");
    expect(cell.style.borderTopWidth).toBe("");
    expect(cell.style.borderLeftWidth).toBe("");
  });

  it("accentBorders aplica largura e cor via style inline, só nos lados indicados", () => {
    render(<ZoneCell zone="att_end_midleft" accentBorders={{ top: "green", left: "green" }} />);
    const cell = screen.getByRole("gridcell");
    expect(cell.style.borderTopWidth).toBe("4px");
    expect(cell.style.borderTopColor).toBe("rgb(34, 197, 94)");
    expect(cell.style.borderLeftWidth).toBe("4px");
    expect(cell.style.borderLeftColor).toBe("rgb(34, 197, 94)");
    // Lados sem destaque ficam só com a classe por omissão (sem largura inline)
    expect(cell.style.borderRightWidth).toBe("");
    expect(cell.style.borderBottomWidth).toBe("");
  });

  it("suporta as 3 cores de destaque (white/green/red)", () => {
    render(<ZoneCell zone="mid_back_left" accentBorders={{ top: "white" }} />);
    expect(screen.getByRole("gridcell").style.borderTopColor).toBe("rgb(255, 255, 255)");
  });

  it("suporta a cor vermelha de destaque", () => {
    render(<ZoneCell zone="def_end_left" accentBorders={{ bottom: "red" }} />);
    expect(screen.getByRole("gridcell").style.borderBottomColor).toBe("rgb(239, 68, 68)");
  });
});
