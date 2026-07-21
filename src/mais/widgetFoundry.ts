import { createId } from '../domain/ids';

export type MaisWidgetSurface = 'brief.extended' | 'progress.extended' | 'lab.extended' | 'exercise.details' | 'developer.activity';
export type MaisWidgetStatus = 'draft' | 'suggested' | 'installed' | 'disabled' | 'removed';
export type MaisWidgetNodeType = 'stack' | 'text' | 'metric' | 'mini_chart' | 'comparison' | 'evidence_link' | 'action' | 'divider';

export interface MaisWidgetNode {
  id: string;
  type: MaisWidgetNodeType;
  text?: string | undefined;
  binding?: string | undefined;
  actionCapabilityId?: string | undefined;
  children?: MaisWidgetNode[] | undefined;
  options?: Record<string, string | number | boolean> | undefined;
}

export interface MaisGeneratedWidget {
  id: string;
  name: string;
  purpose: string;
  surface: MaisWidgetSurface;
  status: MaisWidgetStatus;
  version: number;
  createdByTaskId: string;
  sourceArtifactIds: string[];
  permissionCapabilityIds: string[];
  root: MaisWidgetNode;
  createdAt: string;
  updatedAt: string;
}

export interface MaisWidgetState {
  widgets: MaisGeneratedWidget[];
  blockedFingerprints: string[];
  safeMode: boolean;
}

const ALLOWED_NODE_TYPES = new Set<MaisWidgetNodeType>([
  'stack', 'text', 'metric', 'mini_chart', 'comparison', 'evidence_link', 'action', 'divider',
]);

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function fingerprintWidget(name: string, surface: MaisWidgetSurface, purpose: string): string {
  const input = `${name.trim().toLowerCase()}|${surface}|${purpose.trim().toLowerCase()}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `widget-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateNode(node: MaisWidgetNode, path = 'root'): string[] {
  const errors: string[] = [];
  if (!ALLOWED_NODE_TYPES.has(node.type)) errors.push(`${path} uses unsupported node type ${node.type}.`);
  if (node.type === 'action' && !node.actionCapabilityId) errors.push(`${path} action requires a capability ID.`);
  if (node.children && !['stack'].includes(node.type)) errors.push(`${path} cannot contain child nodes.`);
  for (const [index, child] of (node.children ?? []).entries()) errors.push(...validateNode(child, `${path}.children[${index}]`));
  return errors;
}

export function createMaisWidgetState(): MaisWidgetState {
  return { widgets: [], blockedFingerprints: [], safeMode: false };
}

export class MaisWidgetFoundry {
  private state: MaisWidgetState;

  constructor(initialState: MaisWidgetState = createMaisWidgetState()) {
    this.state = structuredClone(initialState);
  }

  snapshot(): MaisWidgetState {
    return structuredClone(this.state);
  }

  createDraft(input: Omit<MaisGeneratedWidget, 'id' | 'status' | 'version' | 'createdAt' | 'updatedAt'>, now?: string): MaisGeneratedWidget {
    const errors = validateNode(input.root);
    if (errors.length > 0) throw new Error(`Widget validation failed: ${errors.join('; ')}`);
    const fingerprint = fingerprintWidget(input.name, input.surface, input.purpose);
    if (this.state.blockedFingerprints.includes(fingerprint)) throw new Error('This widget concept was blocked by the user.');
    const createdAt = timestamp(now);
    const widget: MaisGeneratedWidget = {
      ...structuredClone(input),
      id: createId('mais_widget'),
      status: 'draft',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    };
    this.state.widgets.push(widget);
    return structuredClone(widget);
  }

  suggest(widgetId: string, now?: string): MaisGeneratedWidget {
    return this.transition(widgetId, ['draft'], 'suggested', now);
  }

  install(widgetId: string, now?: string): MaisGeneratedWidget {
    if (this.state.safeMode) throw new Error('AI-created UI is disabled by MAIS safe mode.');
    return this.transition(widgetId, ['draft', 'suggested', 'disabled'], 'installed', now);
  }

  disable(widgetId: string, now?: string): MaisGeneratedWidget {
    return this.transition(widgetId, ['installed', 'suggested'], 'disabled', now);
  }

  remove(widgetId: string, options: { blockRecreation?: boolean; now?: string } = {}): MaisGeneratedWidget {
    const widget = this.requireWidget(widgetId);
    widget.status = 'removed';
    widget.updatedAt = timestamp(options.now);
    if (options.blockRecreation) {
      const fingerprint = fingerprintWidget(widget.name, widget.surface, widget.purpose);
      if (!this.state.blockedFingerprints.includes(fingerprint)) this.state.blockedFingerprints.push(fingerprint);
    }
    return structuredClone(widget);
  }

  update(widgetId: string, patch: Pick<MaisGeneratedWidget, 'root' | 'purpose' | 'permissionCapabilityIds'>, now?: string): MaisGeneratedWidget {
    const widget = this.requireWidget(widgetId);
    if (widget.status === 'removed') throw new Error('Removed widget cannot be updated.');
    const errors = validateNode(patch.root);
    if (errors.length > 0) throw new Error(`Widget validation failed: ${errors.join('; ')}`);
    widget.root = structuredClone(patch.root);
    widget.purpose = patch.purpose;
    widget.permissionCapabilityIds = [...patch.permissionCapabilityIds];
    widget.version += 1;
    widget.status = 'draft';
    widget.updatedAt = timestamp(now);
    return structuredClone(widget);
  }

  setSafeMode(enabled: boolean): MaisWidgetState {
    this.state.safeMode = enabled;
    return this.snapshot();
  }

  visible(surface: MaisWidgetSurface): MaisGeneratedWidget[] {
    if (this.state.safeMode) return [];
    return this.state.widgets
      .filter((widget) => widget.surface === surface && widget.status === 'installed')
      .map((widget) => structuredClone(widget));
  }

  private transition(widgetId: string, allowed: MaisWidgetStatus[], next: MaisWidgetStatus, now?: string): MaisGeneratedWidget {
    const widget = this.requireWidget(widgetId);
    if (!allowed.includes(widget.status)) throw new Error(`Widget cannot move from ${widget.status} to ${next}.`);
    widget.status = next;
    widget.updatedAt = timestamp(now);
    return structuredClone(widget);
  }

  private requireWidget(widgetId: string): MaisGeneratedWidget {
    const widget = this.state.widgets.find((candidate) => candidate.id === widgetId);
    if (!widget) throw new Error('MAIS widget not found.');
    return widget;
  }
}
