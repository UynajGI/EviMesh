import { sha256Hex } from "./manifest.mjs";

export class MirrorError extends Error {
  constructor(message, code = "MIRROR_FAILED") {
    super(message);
    this.name = "MirrorError";
    this.code = code;
  }
}

/**
 * Minimal GitHub Release client for the public frontier mirror (M12-17/18).
 * Uses the REST API; the token only ever travels to api.github.com /
 * uploads.github.com.
 */
export function createGitHubMirrorClient({ token, owner, repo, apiBase = "https://api.github.com", uploadBase = "https://uploads.github.com", fetchImpl = fetch } = {}) {
  if (typeof token !== "string" || token.length === 0) throw new MirrorError("GitHub token is required", "MIRROR_TOKEN_MISSING");
  if (typeof owner !== "string" || typeof repo !== "string") throw new MirrorError("owner and repo are required");

  async function request(url, options) {
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(options.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw new MirrorError(`GitHub API ${options.method ?? "GET"} ${url} failed with ${response.status}`, "MIRROR_API_ERROR");
    return payload;
  }

  return Object.freeze({
    /** Create one release (M12-17). */
    async createRelease({ tag, name, body = "", draft = false, prerelease = true }) {
      const release = await request(`${apiBase}/repos/${owner}/${repo}/releases`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag_name: tag, name, body, draft, prerelease }),
      });
      return { releaseId: release.id, url: release.html_url };
    },
    /** Upload one bundle asset to a release (M12-18). */
    async uploadAsset({ releaseId, fileName, bytes }) {
      const response = await fetchImpl(`${uploadBase}/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/zip",
        },
        body: bytes,
      });
      if (!response.ok) throw new MirrorError(`asset upload failed with ${response.status}`, "MIRROR_UPLOAD_ERROR");
      const asset = await response.json();
      return { assetId: asset.id, url: asset.browser_download_url, sha256: sha256Hex(bytes), sizeBytes: bytes.length };
    },
  });
}
