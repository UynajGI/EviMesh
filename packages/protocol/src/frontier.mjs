function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer`);
  }
}

export function createFrontierSnapshot({ number, previous = null, revision, members = [] } = {}) {
  assertPositiveInteger(number, 'frontier number');
  assertPositiveInteger(revision, 'frontier revision');

  if (!Array.isArray(members)) {
    throw new TypeError('frontier members must be an array');
  }

  if (number === 1 && previous !== null) {
    throw new RangeError('genesis frontier cannot reference a previous snapshot');
  }

  if (number > 1 && previous !== number - 1) {
    throw new RangeError('frontier snapshot must reference the immediately previous snapshot');
  }

  return Object.freeze({
    number,
    previous,
    revision,
    members: Object.freeze([...members]),
  });
}

export function nextFrontier(previous, { revision, members = [] } = {}) {
  if (!previous || !Number.isInteger(previous.number)) {
    throw new TypeError('previous frontier snapshot is required');
  }

  return createFrontierSnapshot({
    number: previous.number + 1,
    previous: previous.number,
    revision,
    members,
  });
}

export function assertFrontierChain(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new TypeError('frontier chain must contain at least one snapshot');
  }

  snapshots.forEach((snapshot, index) => {
    if (snapshot?.number !== index + 1 || snapshot?.previous !== (index === 0 ? null : index)) {
      throw new RangeError('frontier chain must be contiguous and append-only');
    }
    assertPositiveInteger(snapshot.revision, 'frontier revision');
  });

  return true;
}
