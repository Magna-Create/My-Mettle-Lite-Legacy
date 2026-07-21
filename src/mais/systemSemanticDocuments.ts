import type { MaisSystemSnapshot } from './systemState';
import type { MaisSemanticDocument } from './semanticMemory';

function text(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

function beliefDocuments(snapshot: MaisSystemSnapshot): MaisSemanticDocument[] {
  return snapshot.beliefs.beliefs.map((belief) => {
    const evidence = snapshot.beliefs.evidenceLinks.filter((link) => link.beliefId === belief.id);
    const questions = snapshot.beliefs.unresolvedQuestions.filter((question) => question.beliefIds.includes(belief.id));
    return {
      id: `semantic_belief_${belief.id}`,
      kind: 'belief',
      title: belief.claim,
      summary: `${belief.status} belief in ${belief.domain} with confidence ${belief.confidence.toFixed(2)}.`,
      updatedAt: belief.updatedAt,
      metadata: {
        beliefId: belief.id,
        domain: belief.domain,
        status: belief.status,
        confidence: belief.confidence,
      },
      sections: [
        {
          key: 'claim',
          heading: 'Belief and uncertainty',
          text: `Claim: ${belief.claim}. Status: ${belief.status}. Confidence: ${belief.confidence}. Created by task ${belief.createdByTaskId}.`,
          provenanceRefs: [belief.id, belief.createdByTaskId],
        },
        {
          key: 'evidence',
          heading: 'Support and counter-evidence',
          text: evidence.length
            ? evidence.map((link) => `${link.polarity}: ${link.summary}. Weight ${link.weight}. Observed ${link.observedAt ?? 'unknown'}.`).join('\n\n')
            : 'No linked evidence has been stored.',
          provenanceRefs: evidence.flatMap((link) => [link.id, link.sourceArtifactId, ...link.provenanceRefs]),
        },
        {
          key: 'questions',
          heading: 'Unresolved questions',
          text: questions.length
            ? questions.map((question) => `${question.question}. Priority ${question.priority}. Required evidence: ${question.requiredEvidence.join('; ') || 'unspecified'}.`).join('\n\n')
            : 'No unresolved question is linked.',
          provenanceRefs: questions.map((question) => question.id),
        },
      ],
    };
  });
}

function memoryDocuments(snapshot: MaisSystemSnapshot): MaisSemanticDocument[] {
  return snapshot.memories.records
    .filter((memory) => memory.status === 'active')
    .map((memory) => ({
      id: `semantic_memory_${memory.id}`,
      kind: 'system_note',
      title: `Memory for ${memory.entityRef}`,
      summary: memory.summary,
      updatedAt: memory.updatedAt,
      metadata: {
        memoryId: memory.id,
        entityRef: memory.entityRef,
        confidence: memory.confidence,
        tags: memory.tags.join(','),
      },
      sections: [{
        key: 'memory',
        heading: 'Provenance-linked memory',
        text: `${memory.summary}. Confidence type ${memory.confidence}. Tags ${memory.tags.join(', ') || 'none'}.`,
        provenanceRefs: [memory.id, memory.entityRef, memory.sourceArtifactId, ...memory.provenanceRefs],
      }],
    }));
}

function researchDocuments(snapshot: MaisSystemSnapshot): MaisSemanticDocument[] {
  return snapshot.research.reports.map((report) => ({
    id: `semantic_research_${report.id}`,
    kind: 'research_report',
    title: `External research report ${report.requestId}`,
    summary: report.summary,
    updatedAt: report.importedAt,
    metadata: {
      reportId: report.id,
      requestId: report.requestId,
      sourceCount: report.sources.length,
      expiresAt: report.expiresAt,
    },
    sections: [
      {
        key: 'claims',
        heading: 'Cited claims',
        text: report.claims.map((claim) => `${claim.claim}. Confidence ${claim.confidence}. Citations ${claim.sourceCitations.join('; ')}. Limitations ${claim.limitations.join('; ') || 'none recorded'}.`).join('\n\n'),
        provenanceRefs: [report.id, report.requestId],
      },
      {
        key: 'sources',
        heading: 'Sources',
        text: report.sources.map((source) => `${source.title}. ${source.publisher}. ${source.citation}. Accessed ${source.accessedAt}.`).join('\n\n'),
        provenanceRefs: [report.id],
      },
    ],
  }));
}

function analysisDocuments(snapshot: MaisSystemSnapshot): MaisSemanticDocument[] {
  return snapshot.analysisRuns
    .filter((run) => run.status === 'completed')
    .map((run) => {
      const program = snapshot.analysisPrograms.find((candidate) => candidate.id === run.programId);
      const input = snapshot.analysisInputs.find((candidate) => candidate.id === run.inputSnapshotId);
      return {
        id: `semantic_analysis_${run.id}`,
        kind: 'system_note',
        title: `Completed analysis ${program?.outputSchema ?? run.id}`,
        summary: `${input?.records.length ?? 0} immutable records analysed in ${run.executionMs.toFixed(1)} ms.`,
        updatedAt: run.completedAt ?? run.startedAt,
        metadata: {
          analysisRunId: run.id,
          programmeId: run.programId,
          inputSnapshotId: run.inputSnapshotId,
          outputSchema: program?.outputSchema ?? null,
        },
        sections: [{
          key: 'result',
          heading: 'Reproducible analysis result',
          text: `Output ${text(run.output)}. Diagnostics ${run.diagnostics.join('; ') || 'none'}.`,
          provenanceRefs: [run.id, run.programId, run.inputSnapshotId, ...(input?.provenanceRefs ?? [])],
        }],
      } satisfies MaisSemanticDocument;
    });
}

export function buildMaisKnowledgeSemanticDocuments(snapshot: MaisSystemSnapshot | null): MaisSemanticDocument[] {
  if (!snapshot) return [];
  return [
    ...beliefDocuments(snapshot),
    ...memoryDocuments(snapshot),
    ...researchDocuments(snapshot),
    ...analysisDocuments(snapshot),
  ];
}
