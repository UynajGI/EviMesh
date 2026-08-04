const REVISION_ERROR = 'revision must be a positive integer';

function assertRevisionNumber(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(REVISION_ERROR);
  }
}

export function createRevision({ revision, supersedes = null } = {}) {
  assertRevisionNumber(revision);

  if (revision === 1 && supersedes !== null) {
    throw new RangeError('revision 1 cannot supersede another revision');
  }

  if (revision > 1 && supersedes !== revision - 1) {
    throw new RangeError('a revision must supersede its immediately preceding revision');
  }

  return Object.freeze({ revision, supersedes });
}

export function nextRevision(previous) {
  if (!previous || !Number.isInteger(previous.revision)) {
    throw new TypeError('previous revision is required');
  }

  return createRevision({
    revision: previous.revision + 1,
    supersedes: previous.revision,
  });
}

export function isRevision(value) {
  try {
    createRevision(value);
    return true;
  } catch {
    return false;
  }
}

export function assertRevisionSequence(revisions) {
  if (!Array.isArray(revisions) || revisions.length === 0) {
    throw new TypeError('revision sequence must contain at least one revision');
  }

  revisions.forEach((revision, index) => {
    const expected = createRevision({
      revision: index + 1,
      supersedes: index === 0 ? null : index,
    });

    if (revision?.revision !== expected.revision || revision?.supersedes !== expected.supersedes) {
      throw new RangeError('revision sequence must be contiguous and append-only');
    }
  });

  return true;
}
