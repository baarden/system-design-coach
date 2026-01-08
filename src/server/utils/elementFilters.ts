import type { ServerElement } from "../../shared/types/excalidraw.js";

interface Connection {
  target_id: string;
  target_label?: string;
  arrow_label?: string;
}

interface SimplifiedElement {
  id: string;
  type: string;
  label?: string;
  iconName?: string;
  frameId?: string | null;
  connections_to?: Connection[];
}

/**
 * Bound element reference on an Excalidraw element
 */
interface BoundElement {
  type: "text" | "arrow";
  id: string;
}

/**
 * Arrow binding to another element
 */
interface ArrowBinding {
  elementId: string;
  focus?: number;
  gap?: number;
}

/**
 * Extended element with Excalidraw-specific properties not in ServerElement.
 * Uses intersection to add optional properties while preserving base types.
 */
type ExcalidrawElement = ServerElement & {
  text?: string;
  name?: string;
  boundElements?: readonly BoundElement[] | null;
  startBinding?: ArrowBinding | null;
  endBinding?: ArrowBinding | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  isDeleted?: boolean;
};

/**
 * Filters Excalidraw elements to only include properties relevant for Claude feedback.
 * Strips visual styling, arrows, and text objects. Moves text labels to parent elements
 * and converts arrow connections to connections_to arrays.
 */
export function filterElementsForClaude(
  elements: ServerElement[]
): SimplifiedElement[] {
  // Filter out deleted elements first
  const elArray = (elements as ExcalidrawElement[]).filter((el) => !el.isDeleted);

  // Step 1: Build lookup maps
  const elementById = new Map<string, ExcalidrawElement>();
  const textById = new Map<string, string>();
  const labelByElementId = new Map<string, string>();

  for (const el of elArray) {
    if (!el.id) continue;
    elementById.set(el.id, el);

    if (el.type === "text" && el.text) {
      textById.set(el.id, el.text);
    }
  }

  // Build labelByElementId from boundElements
  for (const el of elArray) {
    if (!el.id || !el.boundElements) continue;

    const textBindings = el.boundElements.filter(
      (be) => be?.type === "text"
    );
    for (const binding of textBindings) {
      const text = textById.get(binding.id);
      if (text) {
        labelByElementId.set(el.id, text);
        break; // Use first text binding as label
      }
    }
  }

  // Step 2: Build connections from arrows
  const connectionsByElementId = new Map<string, Connection[]>();

  function addConnection(sourceId: string, targetId: string, arrowLabel?: string) {
    const targetEl = elementById.get(targetId);
    const connection: Connection = {
      target_id: targetId,
    };

    // Get target label - check for frame type (which may not be in the type enum)
    const targetType = targetEl?.type as string;
    const targetLabel =
      targetType === "frame"
        ? targetEl?.name
        : labelByElementId.get(targetId);
    if (targetLabel) {
      connection.target_label = targetLabel;
    }

    if (arrowLabel) {
      connection.arrow_label = arrowLabel;
    }

    const existing = connectionsByElementId.get(sourceId) || [];
    existing.push(connection);
    connectionsByElementId.set(sourceId, existing);
  }

  for (const el of elArray) {
    if (el.type !== "arrow") continue;

    const startId = el.startBinding?.elementId;
    const endId = el.endBinding?.elementId;
    if (!startId || !endId) continue;

    // Get arrow's own label if it has bound text
    let arrowLabel: string | undefined;
    if (el.boundElements) {
      const textBinding = el.boundElements.find(
        (be) => be?.type === "text"
      );
      if (textBinding) {
        arrowLabel = textById.get(textBinding.id);
      }
    }

    const hasStartArrow = !!el.startArrowhead;
    const hasEndArrow = !!el.endArrowhead;
    const isBidirectional =
      (hasStartArrow && hasEndArrow) || (!hasStartArrow && !hasEndArrow);

    if (isBidirectional) {
      addConnection(startId, endId, arrowLabel);
      addConnection(endId, startId, arrowLabel);
    } else if (hasEndArrow) {
      addConnection(startId, endId, arrowLabel);
    } else if (hasStartArrow) {
      addConnection(endId, startId, arrowLabel);
    }
  }

  // Step 3: Filter and transform elements
  const result: SimplifiedElement[] = [];

  for (const el of elArray) {
    if (!el.id || !el.type) continue;
    if (el.type === "text" || el.type === "arrow") continue;

    const simplified: SimplifiedElement = {
      id: el.id,
      type: el.type,
    };

    // Add label: frame name or bound text
    const elType = el.type as string;
    const label =
      elType === "frame" ? el.name : labelByElementId.get(el.id);
    if (label) {
      simplified.label = label;
    }

    // Add iconName from customData if present
    if (el.customData && typeof el.customData === 'object' && 'iconName' in el.customData) {
      const iconName = el.customData.iconName;
      if (typeof iconName === 'string') {
        simplified.iconName = iconName;
      }
    }

    if (el.frameId) {
      simplified.frameId = el.frameId;
    }

    const connections = connectionsByElementId.get(el.id);
    if (connections && connections.length > 0) {
      simplified.connections_to = connections;
    }

    result.push(simplified);
  }

  return result;
}
