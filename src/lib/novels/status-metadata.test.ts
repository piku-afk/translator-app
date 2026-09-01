import { describe, expect, it } from "vitest";
import { LIFECYCLE_STEPS, stepperStateFromStatus } from "./status-metadata";

/**
 * The stepper mapping's single test seam: given a NovelStatus, which coarse
 * step is active and which are completed. Asserts external behavior only —
 * never markup or icon implementation.
 */
describe("stepperStateFromStatus", () => {
  const noStepsCompleted = [false, false, false, false] as const;
  const parseCompleted = [true, false, false, false] as const;
  const parseAndExtractCompleted = [true, true, false, false] as const;
  const throughTranslateCompleted = [true, true, true, false] as const;

  it("has exactly the four coarse lifecycle steps in spine order", () => {
    expect(LIFECYCLE_STEPS).toEqual(["parse", "extract", "translate", "complete"]);
  });

  it("lands a brand-new draft novel on the Parse step with nothing completed", () => {
    expect(stepperStateFromStatus("draft")).toEqual({
      activeStep: 0,
      completed: noStepsCompleted,
      alert: null,
    });
  });

  it("keeps Parse active while parsing runs", () => {
    expect(stepperStateFromStatus("parsing")).toEqual({
      activeStep: 0,
      completed: noStepsCompleted,
      alert: null,
    });
  });

  it("collapses parsing failed onto the active Parse step with an alert", () => {
    expect(stepperStateFromStatus("parsing failed")).toEqual({
      activeStep: 0,
      completed: noStepsCompleted,
      alert: "parsing failed",
    });
  });

  it("collapses needs review onto the active Parse step with an alert", () => {
    expect(stepperStateFromStatus("needs review")).toEqual({
      activeStep: 0,
      completed: noStepsCompleted,
      alert: "needs review",
    });
  });

  it("moves to Extract once parsing is complete", () => {
    expect(stepperStateFromStatus("ready")).toEqual({
      activeStep: 1,
      completed: parseCompleted,
      alert: null,
    });
  });

  it("keeps Extract active while extraction runs", () => {
    expect(stepperStateFromStatus("extracting")).toEqual({
      activeStep: 1,
      completed: parseCompleted,
      alert: null,
    });
  });

  it("collapses extraction failed onto the active Extract step with an alert", () => {
    expect(stepperStateFromStatus("extraction failed")).toEqual({
      activeStep: 1,
      completed: parseCompleted,
      alert: "extraction failed",
    });
  });

  it("moves to Translate once names are extracted", () => {
    expect(stepperStateFromStatus("names extracted")).toEqual({
      activeStep: 2,
      completed: parseAndExtractCompleted,
      alert: null,
    });
  });

  it("keeps Translate active while translation runs", () => {
    expect(stepperStateFromStatus("translating")).toEqual({
      activeStep: 2,
      completed: parseAndExtractCompleted,
      alert: null,
    });
  });

  it("collapses translation failed onto the active Translate step with an alert", () => {
    expect(stepperStateFromStatus("translation failed")).toEqual({
      activeStep: 2,
      completed: parseAndExtractCompleted,
      alert: "translation failed",
    });
  });

  it("shows a completed novel with all three prior steps done and Complete active", () => {
    expect(stepperStateFromStatus("completed")).toEqual({
      activeStep: 3,
      completed: throughTranslateCompleted,
      alert: null,
    });
  });
});