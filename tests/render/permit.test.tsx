import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermitScreen } from "@/components/permit/PermitScreen";
import { VerifyScreen } from "@/components/permit/VerifyScreen";
import { routes } from "@/lib/routes";
import { renderScreen } from "./harness";

const S1 = "PMT-27-0109";
const S5 = "PMT-27-0097";

describe("PermitScreen", () => {
  it("S1 shows the QR code, Shelter 3, Sat, May 22, 2027, 11 am to 4 pm and a $62.50 refund", async () => {
    await renderScreen(<PermitScreen />, { scenario: "S1" });

    expect(screen.getByRole("heading", { level: 1, name: "Maya Chen's 40th birthday picnic" })).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument(); // the QR code
    expect(screen.getByText(routes.verify(S1))).toBeInTheDocument();
    expect(screen.getAllByText(/Shelter 3/).length).toBeGreaterThan(0);
    expect(screen.getByText("Sat, May 22, 2027, 11 am to 4 pm")).toBeInTheDocument();
    expect(screen.getByText("$62.50")).toBeInTheDocument();
    expect(screen.getByText(/refund\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });

  it("S5 (no permit yet) explains why and links to the board", async () => {
    await renderScreen(<PermitScreen />, {
      role: "applicant",
      personaId: "riverfront-running-club",
      path: routes.permit(S5),
    });

    expect(screen.getByText("No permit has been issued for this event yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Back to your board" });
    for (const link of links) expect(link).toHaveAttribute("href", routes.event(S5));
  });

  it("an unknown case id shows CaseNotFound", async () => {
    await renderScreen(<PermitScreen />, {
      role: "applicant",
      path: "/events/PMT-00-0000/permit",
      params: { id: "PMT-00-0000" },
    });
    expect(screen.getByText("Case not found")).toBeInTheDocument();
  });
});

describe("VerifyScreen", () => {
  it("S1 reads Valid", async () => {
    await renderScreen(<VerifyScreen />, { path: routes.verify(S1), params: { id: S1 } });
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Maya Chen's 40th birthday picnic")).toBeInTheDocument();
  });

  it("S5 reads Not valid (not yet issued)", async () => {
    await renderScreen(<VerifyScreen />, { path: routes.verify(S5), params: { id: S5 } });
    expect(screen.getByText("Not valid")).toBeInTheDocument();
    expect(screen.getByText(/hasn't been issued/i)).toBeInTheDocument();
  });

  it("an unknown id reads Not valid: no such permit", async () => {
    await renderScreen(<VerifyScreen />, { path: "/verify/PMT-00-0000", params: { id: "PMT-00-0000" } });
    expect(screen.getByText("Not valid")).toBeInTheDocument();
    expect(screen.getByText(/no permit/i)).toBeInTheDocument();
  });
});
