// ---------------------------------------------------------------------------
// Visualization graph builder (Shield Lens 3.0 data source).
// Derives nodes + edges from the VALIDATED replay stages — never a fixed
// frontend template. Observed stages must reference evidence; hypothetical
// branches (safe vs risky) are labeled separately.
// ---------------------------------------------------------------------------

import type { ReplayStage, VisualizationGraph, GraphNode, GraphEdge } from "./types";

export function buildGraph(replay: ReplayStage[]): VisualizationGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  let branchCounter = 0;
  for (let i = 0; i < replay.length; i++) {
    const stage = replay[i];
    nodes.push({
      id: stage.id,
      kind: "stage",
      label: stage.title,
      nature: stage.type,
      evidenceRefs: stage.evidenceRefs,
    });
    if (i > 0) {
      edges.push({ from: replay[i - 1].id, to: stage.id, relation: "next" });
    }

    // A hypothetical stage with an intervention spawns the two outcome
    // branches — both clearly hypothetical, never "observed events".
    if (stage.type === "hypothetical" && stage.intervention) {
      branchCounter += 1;
      const safeId = `BR-SAFE-${branchCounter}`;
      const riskId = `BR-RISK-${branchCounter}`;
      nodes.push({
        id: safeId,
        kind: "safe_branch",
        label: { bn: "থেমে যাচাই করার পথ", en: "Stop & verify path" },
        nature: "hypothetical",
        evidenceRefs: [],
      });
      nodes.push({
        id: riskId,
        kind: "risky_branch",
        label: {
          bn: "না যাচাই করে এগোনোর পথ",
          en: "Proceeding without verification",
        },
        nature: "hypothetical",
        evidenceRefs: [],
      });
      edges.push({ from: stage.id, to: safeId, relation: "safe_path" });
      edges.push({ from: stage.id, to: riskId, relation: "risky_path" });
    }
  }

  return { nodes, edges };
}
