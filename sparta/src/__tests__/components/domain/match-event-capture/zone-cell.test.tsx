import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ZoneCell } from "@/components/domain/match-event-capture/zone-cell";

const ZONES = [
  "def_left",
  "def_center",
  "def_right",
  "mid_def_left",
  "mid_def_center",
  "mid_def_right",
  "mid_att_left",
  "mid_att_center",
  "mid_att_right",
  "att_left",
  "att_center",
  "att_right",
] as const;

const ZONES_LABELS: Record<(typeof ZONES)[number], string> = {
  def_left: "Defesa esquerda",
  def_center: "Defesa centro",
  def_right: "Defesa direita",
  mid_def_left: "MC defensivo esq.",
  mid_def_center: "MC defensivo centro",
  mid_def_right: "MC defensivo dir.",
  mid_att_left: "MC ofensivo esq.",
  mid_att_center: "MC ofensivo centro",
  mid_att_right: "MC ofensivo dir.",
  att_left: "Ataque esquerda",
  att_center: "Ataque centro",
  att_right: "Ataque direita",
};

describe("<ZoneCell>", () => {
  it.each(ZONES)("renders zone %s", (zone) => {
    render(<ZoneCell zone={zone} />);
    const button = screen.getByRole("gridcell");
    expect(button).toBeInTheDocument();
  });

  it("has correct aria-label", () => {
    render(<ZoneCell zone="def_left" />);
    const cell = screen.getByRole("gridcell");
    expect(cell).toHaveAttribute("aria-label", "Defesa esquerda");
  });

  it.each(ZONES)("displays correct label for zone %s", (zone) => {
    render(<ZoneCell zone={zone} />);
    const label = ZONES_LABELS[zone];
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("calls onClick with zone when clicked", () => {
    const onClick = vi.fn();
    render(<ZoneCell zone="def_left" onClick={onClick} />);

    const cell = screen.getByRole("gridcell");
    cell.click();

    expect(onClick).toHaveBeenCalledWith("def_left");
  });

  it("has correct role attribute", () => {
    render(<ZoneCell zone="mid_def_center" />);
    const cell = screen.getByRole("gridcell");
    expect(cell).toHaveAttribute("role", "gridcell");
  });

  it("renders all 12 zones in a test suite", () => {
    const { container } = render(
      <div>
        {ZONES.map((zone) => (
          <ZoneCell key={zone} zone={zone} />
        ))}
      </div>
    );
    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(12);
  });
});
