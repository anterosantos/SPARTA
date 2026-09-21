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
});
