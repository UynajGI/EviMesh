export class PreconditionFailedError extends Error {
  constructor(message = "If-Match does not match the current revision") {
    super(message);
    this.name = "PreconditionFailedError";
    this.code = "PRECONDITION_FAILED";
    this.status = 412;
  }
}

export function revisionEtag({ objectId, revision, contentHash }) {
  if (typeof objectId !== "string" || objectId.length === 0 || !Number.isInteger(revision) || revision < 1 || typeof contentHash !== "string" || contentHash.length === 0) {
    throw new TypeError("objectId, positive revision, and contentHash are required");
  }
  return 'W/"' + objectId + ":" + revision + ":" + contentHash + '"';
}

export function assertIfMatch(ifMatch, expectedEtag) {
  if (typeof ifMatch !== "string" || ifMatch.trim() !== expectedEtag) throw new PreconditionFailedError();
  return true;
}
