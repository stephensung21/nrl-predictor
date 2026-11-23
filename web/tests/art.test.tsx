// The drawn kit (components/art): every pictogram and spot draws, decorative ones are hidden from
// screen readers, and diagrams carry their words as real text.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlowDiagram, RuleStrip } from "../components/art/diagrams";
import { Pictogram, PICTOGRAMS } from "../components/art/pictogram";
import { Spot, SPOT_NAMES } from "../components/art/spot";

describe("the drawn kit", () => {
  it("draws every pictogram, hidden unless it's given a label", () => {
    for (const name of PICTOGRAMS) {
      const svg = renderToStaticMarkup(<Pictogram name={name} />);
      expect(svg, name).toMatch(/<(path|circle|ellipse|rect)/);
      expect(svg, name).toContain('aria-hidden="true"');
    }
    const labelled = renderToStaticMarkup(<Pictogram name="tick" label="Right" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Right"');
    expect(labelled).not.toContain("aria-hidden");
  });

  it("draws every spot illustration, always decorative", () => {
    for (const name of SPOT_NAMES) {
      const svg = renderToStaticMarkup(<Spot name={name} />);
      expect(svg, name).toMatch(/<(path|circle|ellipse|rect)/);
      expect(svg, name).toContain('aria-hidden="true"');
    }
  });

  it("keeps a diagram's words as text", () => {
    const strip = renderToStaticMarkup(<RuleStrip label="The rules" steps={[{ icon: "ball", title: "Pick one team", note: "Never twice" }]} />);
    expect(strip).toContain("Pick one team");
    expect(strip).toContain("Never twice");
    const flow = renderToStaticMarkup(
      <FlowDiagram label="Flow" inputs={[{ icon: "tag", title: "Opening prices" }]} centre={{ title: "The Model" }} outputs={[{ icon: "tick", title: "Its tip" }]} />,
    );
    for (const word of ["Opening prices", "The Model", "Its tip"]) expect(flow).toContain(word);
  });
});
