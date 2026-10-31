import { findNode, GATE_SCREENS, screenSurface, type DocumentIssue, type TemplateDocumentV2, type ScreenId } from '../template-document';

export function issueLocation(document: TemplateDocumentV2, issue: DocumentIssue) {
  if (!issue.variant || !issue.nodeId) return;
  const variant = document.variants[issue.variant];
  for (const screen of ['portal', ...GATE_SCREENS] as ScreenId[]) {
    const section = screenSurface(variant, screen).sections.find(section => findNode(section.nodes, issue.nodeId!));
    if (section) return { device: issue.variant, screen, sectionId: section.id, nodeId: issue.nodeId };
  }
  for (const screen of GATE_SCREENS) {
    const controller = screen === 'video_gate' ? variant.flow.videoGate : screen === 'attendance_gate' ? variant.flow.attendanceGate : variant.flow.announcement;
    if (controller?.id !== issue.nodeId) continue;
    const section = screenSurface(variant, screen).sections.find(section => section.nodes.some(node => node.element.type === 'flow_content'));
    const core = section?.nodes.find(node => node.element.type === 'flow_content');
    if (section && core) return { device: issue.variant, screen, sectionId: section.id, nodeId: core.id };
  }
}
