export function claimLayoutEndpoints({ source, target, sourceDepth, targetDepth, direction }) {
  const depthsDiffer =
    Number.isFinite(sourceDepth) && Number.isFinite(targetDepth) && sourceDepth !== targetDepth;
  let sourceIsLayoutParent;

  if (depthsDiffer) {
    sourceIsLayoutParent = direction === 'upstream' ? sourceDepth > targetDepth : sourceDepth < targetDepth;
  } else {
    sourceIsLayoutParent = source.localeCompare(target) <= 0;
  }

  return sourceIsLayoutParent
    ? { layoutSource: source, layoutTarget: target }
    : { layoutSource: target, layoutTarget: source };
}
