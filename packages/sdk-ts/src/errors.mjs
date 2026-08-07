export class EviMeshError extends Error {
  constructor(message, { code = "EVIMESH_ERROR", status = null, requestId = null, details = null } = {}) {
    super(message);
    this.name = "EviMeshError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

export class EviMeshApiError extends EviMeshError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshApiError";
  }
}

export class EviMeshAuthenticationError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshAuthenticationError";
  }
}

export class EviMeshForbiddenError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshForbiddenError";
  }
}

export class EviMeshNotFoundError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshNotFoundError";
  }
}

export class EviMeshValidationError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshValidationError";
  }
}

export class EviMeshConflictError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshConflictError";
  }
}

export class EviMeshPreconditionError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshPreconditionError";
  }
}

export class EviMeshUnprocessableError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshUnprocessableError";
  }
}

export class EviMeshUnavailableError extends EviMeshApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "EviMeshUnavailableError";
  }
}

const STATUS_ERRORS = Object.freeze({
  400: EviMeshValidationError,
  401: EviMeshAuthenticationError,
  403: EviMeshForbiddenError,
  404: EviMeshNotFoundError,
  409: EviMeshConflictError,
  412: EviMeshPreconditionError,
  422: EviMeshUnprocessableError,
  503: EviMeshUnavailableError,
});

/** Map one normalized API error body to the typed exception for its status. */
export function errorFromResponse({ status, body = {} } = {}) {
  const ErrorClass = STATUS_ERRORS[status] ?? EviMeshApiError;
  return new ErrorClass(body.message ?? `request failed with status ${status}`, {
    code: body.code ?? "unknown_error",
    status,
    requestId: body.request_id ?? null,
    details: body.issues ?? null,
  });
}
