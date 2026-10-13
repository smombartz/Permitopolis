import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Truncate } from "@/components/ui/truncate";

const LONG_NAME =
  "The Permitopolis Riverside Community Spring Festival, Craft Fair and Family Picnic Celebration Day";

describe("Truncate", () => {
  it("clips to a single line by default, with the full text in `title`", () => {
    render(<Truncate text={LONG_NAME} />);
    const el = screen.getByText(LONG_NAME);
    expect(el).toHaveClass("truncate");
    expect(el).not.toHaveClass("line-clamp-2");
    expect(el).toHaveAttribute("title", LONG_NAME);
  });

  it("clips to two lines when asked, still with the full text in `title`", () => {
    render(<Truncate text={LONG_NAME} lines={2} />);
    const el = screen.getByText(LONG_NAME);
    expect(el).toHaveClass("line-clamp-2");
    expect(el).not.toHaveClass("truncate");
    expect(el).toHaveAttribute("title", LONG_NAME);
  });
});
