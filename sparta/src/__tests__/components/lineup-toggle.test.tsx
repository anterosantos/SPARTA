import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LineupToggle } from "@/components/patterns/LineupToggle";

describe("LineupToggle", () => {
  const mockPlayer = {
    id: "player-1",
    full_name: "João Silva",
    jersey_num: 7,
    positions: [
      { position: "MID", is_primary: true },
      { position: "FWD", is_primary: false },
    ],
  };

  describe("Rendering", () => {
    it("should render player name and jersey number", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("João Silva")).toBeInTheDocument();
    });

    it("should render primary position", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("MID")).toBeInTheDocument();
    });

    it("should render two toggle buttons (Não / Convocado)", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
    });

    it("should render dash position if no positions", () => {
      const playerNoPos = { ...mockPlayer, positions: [] };
      render(
        <LineupToggle
          player={playerNoPos}
          selected={false}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("Selected state", () => {
    it("should show selected state for convocado", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      const convocadoButton = buttons[1]; // Second button is "Convocado"

      expect(convocadoButton).toHaveAttribute("aria-pressed", "true");
      expect(convocadoButton).toHaveClass("bg-primary");
    });

    it("should show unselected state", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      const unselectedButton = buttons[0]; // First button is "Não"

      expect(unselectedButton).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("Interactions", () => {
    it("should call onChange with true when convocado button clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={onChange}
        />
      );

      const buttons = container.querySelectorAll("button");
      const convocadoButton = buttons[1];

      fireEvent.click(convocadoButton);

      expect(onChange).toHaveBeenCalledWith(true, mockPlayer.jersey_num);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("should call onChange with false when unselected button clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={onChange}
        />
      );

      const buttons = container.querySelectorAll("button");
      const unselectedButton = buttons[0];

      fireEvent.click(unselectedButton);

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("should toggle between states on multiple clicks", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={onChange}
        />
      );

      let buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[1]); // Click convocado
      expect(onChange).toHaveBeenCalledWith(true, mockPlayer.jersey_num);

      rerender(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={onChange}
        />
      );

      buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[0]); // Click não
      expect(onChange).toHaveBeenCalledWith(false);

      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe("Shirt number input", () => {
    it("should show shirt number input when convocado is selected", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={vi.fn()}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "99");
    });

    it("should not show shirt number input when not convocado", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      expect(
        screen.queryByLabelText(`Número de camisola para ${mockPlayer.full_name}`)
      ).not.toBeInTheDocument();
    });

    it("should call onChange with shirt number when input changes", () => {
      const onChange = vi.fn();
      render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={onChange}
          shirtNum={null}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "7" } });

      expect(onChange).toHaveBeenCalledWith(true, 7);
    });

    it("should display existing shirt number", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={vi.fn()}
          shirtNum={10}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`) as HTMLInputElement;
      expect(input.value).toBe("10");
    });

    it("should call onChange with null when input is cleared", () => {
      const onChange = vi.fn();
      render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={onChange}
          shirtNum={7}
        />
      );

      const input = screen.getByLabelText(`Número de camisola para ${mockPlayer.full_name}`) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith(true, null);
    });
  });

  describe("Parental consent", () => {
    it("should show badge when parental consent not confirmed", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
          parentalConsentConfirmed={false}
        />
      );

      const badge = container.querySelector("span.text-orange-600");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-orange-50");
    });

    it("should not show badge when parental consent confirmed", () => {
      render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
          parentalConsentConfirmed={true}
        />
      );

      expect(screen.queryByText("Aguarda")).not.toBeInTheDocument();
    });
  });

  describe("Disabled state", () => {
    it("should disable all buttons when disabled=true", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("should not call onChange when disabled and clicked", () => {
      const onChange = vi.fn();
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={onChange}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[0]); // Click unselected button while disabled

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should show disabled styling", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("opacity-50", "cursor-not-allowed");
      });
    });

    it("should disable shirt number input when disabled=true", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      const input = container.querySelector('input[type="number"]');
      expect(input).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper aria-label for group", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      const group = container.querySelector('[role="group"]');
      expect(group).toHaveAttribute("aria-label", `Seleção para ${mockPlayer.full_name}`);
    });

    it("should have aria-pressed attribute on buttons", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={true}
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveAttribute("aria-pressed");
      });
    });

    it("should have min height for touch targets (44px)", () => {
      const { container } = render(
        <LineupToggle
          player={mockPlayer}
          selected={false}
          onChange={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("min-h-[44px]");
      });
    });
  });
});
